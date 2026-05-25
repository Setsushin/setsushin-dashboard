// PageHeader — page title (or brand) + date stamp. `title` sets the H1;
// `subtitle` renders below as a quiet caption.

export interface PageHeaderProps {
  name: string;
  dateStr: string;
  weekday: string;
  title?: string;
  subtitle?: string;
}

export function PageHeader({ name, dateStr, weekday, title, subtitle }: PageHeaderProps) {
  const h1 = title || name;
  const sub = title ? subtitle : null;
  return (
    <div className="page-head">
      <div className="page-head-title">
        <h1>{h1}</h1>
        {sub && <div className="page-head-sub">{sub}</div>}
      </div>
      <div className="page-head-date">
        <div className="page-head-date-w">{weekday}</div>
        <div className="page-head-date-d">{dateStr}</div>
      </div>
    </div>
  );
}
