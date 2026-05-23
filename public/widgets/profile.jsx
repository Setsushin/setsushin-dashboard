// widgets/profile.jsx — personal reference items backed by D1 (/api/profile).
//
// Stuff you look up rarely but need fast: passport number, glasses Rx,
// company phone… Grouped by free-form `category`; value is plaintext and
// selectable, with a one-click copy chip. Inline add/edit (no modal),
// optimistic-then-reconcile like the assets widget.

const PROFILE_OTHER = 'Other';

// Stable category order: keep first-seen order from the (category-sorted)
// API list; null/empty bucket renders last under "Other".
function groupByCategory(items) {
  const order = [];
  const map = new Map();
  for (const it of items) {
    const cat = (it.category || '').trim() || PROFILE_OTHER;
    if (!map.has(cat)) { map.set(cat, []); order.push(cat); }
    map.get(cat).push(it);
  }
  // Push "Other" to the end if present alongside named categories.
  order.sort((a, b) => (a === PROFILE_OTHER) - (b === PROFILE_OTHER));
  return order.map(cat => ({ cat, items: map.get(cat) }));
}

function ProfileForm({ initial, categories, onSave, onCancel }) {
  const [category, setCategory] = useState(initial?.category ?? '');
  const [label,    setLabel]    = useState(initial?.label ?? '');
  const [value,    setValue]    = useState(initial?.value ?? '');
  const [note,     setNote]     = useState(initial?.note ?? '');
  const labelRef = React.useRef(null);

  React.useEffect(() => { labelRef.current?.focus(); labelRef.current?.select(); }, []);

  const submit = () => {
    if (!label.trim()) return;
    onSave({
      category: category.trim() || null,
      label: label.trim(),
      value,
      note: note.trim() || null,
    });
  };
  // Single-line inputs submit on Enter; the value textarea keeps Enter for
  // newlines and submits on Cmd/Ctrl+Enter. Esc always cancels.
  const onKeyLine = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };
  const onKeyArea = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div className="profile-form">
      <div className="profile-form-grid">
        <input className="af-input" list="profile-cat-presets"
               placeholder="Category" value={category}
               onChange={e => setCategory(e.target.value)} onKeyDown={onKeyLine} />
        <input ref={labelRef} className="af-input"
               placeholder="Label *" value={label}
               onChange={e => setLabel(e.target.value)} onKeyDown={onKeyLine} />
      </div>
      <textarea className="af-input profile-form-value"
                placeholder="Value" rows={2} value={value}
                onChange={e => setValue(e.target.value)} onKeyDown={onKeyArea} />
      <input className="af-input"
             placeholder="Note (optional)" value={note}
             onChange={e => setNote(e.target.value)} onKeyDown={onKeyLine} />
      <datalist id="profile-cat-presets">
        {categories.map(c => <option key={c} value={c} />)}
      </datalist>
      <div className="profile-form-foot">
        <span className="profile-form-hint">⌘↵ to save · Esc to cancel</span>
        <button className="panel-action" onClick={onCancel}>Cancel</button>
        <button className="panel-action edit-save" disabled={!label.trim()} onClick={submit}>Save</button>
      </div>
    </div>
  );
}

function ProfileRow({ item, onEditStart, onDelete }) {
  const [copied, setCopied] = useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    if (!item.value) return;
    try { await navigator.clipboard.writeText(item.value); setCopied(true); }
    catch (err) { alert('Copy failed: ' + err.message); }
  };

  return (
    <div className="profile-row">
      <div className="profile-row-label">{item.label}</div>
      <div className="profile-row-value">
        {item.value
          ? <span className="profile-value-text" title="Click copy to grab it">{item.value}</span>
          : <span className="muted">—</span>}
        {item.note && <span className="profile-row-note muted">{item.note}</span>}
      </div>
      <div className="profile-row-actions">
        {item.value && (
          <button className="profile-row-act" onClick={copy} data-ack={copied ? '1' : '0'}
                  title="Copy value">{copied ? '✓' : 'copy'}</button>
        )}
        <button className="profile-row-act" onClick={onEditStart} title="Edit">✎</button>
        <button className="profile-row-act profile-row-del" onClick={onDelete} title="Delete">×</button>
      </div>
    </div>
  );
}

function ProfileWidget() {
  const [items, setItems] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

  const reload = React.useCallback(() => {
    return fetch('/api/profile')
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const list = items || [];
  const categories = [...new Set(list.map(i => (i.category || '').trim()).filter(Boolean))];

  // Optimistic mutate (mirrors assets): apply locally, then call server.
  // POST reloads to pick up the server id; PATCH/DELETE only reload on error.
  const mutate = async (label, optimistic, doFetch, { reloadOnSuccess = false } = {}) => {
    optimistic();
    try {
      const r = await doFetch();
      if (!r.ok) throw new Error(`${label} failed: HTTP ${r.status}`);
      if (reloadOnSuccess) reload();
    } catch (err) {
      console.error(err);
      alert(`${err.message}\nReverting.`);
      reload();
    }
  };

  const create = (form) => mutate(
    'POST',
    () => { setAdding(false); setItems(a => [...(a || []), { ...form, id: -Date.now() }]); },
    () => fetch('/api/profile', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    }),
    { reloadOnSuccess: true },
  );

  const update = (id, patch) => mutate(
    'PATCH',
    () => { setEditingId(null); setItems(a => (a || []).map(it => it.id === id ? { ...it, ...patch } : it)); },
    () => fetch(`/api/profile/${id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  );

  const remove = (id, label) => {
    if (!window.confirm(`Delete "${label}"?`)) return;
    return mutate(
      'DELETE',
      () => setItems(a => (a || []).filter(it => it.id !== id)),
      () => fetch(`/api/profile/${id}`, { method: 'DELETE' }),
    );
  };

  const action = !adding && (
    <button className="panel-action" onClick={() => { setEditingId(null); setAdding(true); }}>
      <PlusIcon /> Add
    </button>
  );

  if (items === null) {
    return <Panel title="Profile" action={action} className="panel-wide">
      <div className="muted" style={{padding: 16}}>Loading…</div>
    </Panel>;
  }

  const groups = groupByCategory(list);

  return (
    <Panel title="Profile" action={action} className="panel-wide">
      <div className="profile-body">
        {adding && (
          <ProfileForm initial={null} categories={categories}
                       onSave={create} onCancel={() => setAdding(false)} />
        )}

        {groups.map(g => (
          <div key={g.cat} className="profile-group">
            <div className="profile-group-head">{g.cat}</div>
            <div className="profile-group-body">
              {g.items.map(it => editingId === it.id
                ? <ProfileForm key={it.id} initial={it} categories={categories}
                               onSave={(form) => update(it.id, form)}
                               onCancel={() => setEditingId(null)} />
                : <ProfileRow key={it.id} item={it}
                              onEditStart={() => { setAdding(false); setEditingId(it.id); }}
                              onDelete={() => remove(it.id, it.label)} />
              )}
            </div>
          </div>
        ))}

        {list.length === 0 && !adding && (
          <div className="muted" style={{padding: 16}}>
            Nothing here yet — click + Add to stash a number you always forget.
          </div>
        )}
      </div>
    </Panel>
  );
}

// Full-width, owns its page (matches the assets widget's footprint).
ProfileWidget.fixedSize = { rowSpan: 3, full: true };

registerWidget('profile', ProfileWidget);
