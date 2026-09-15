// Journal inline-image upload: paste / drop / file-picker → R2 (via
// /api/images) → markdown `![](/api/images/<uuid>)` spliced into the body.
// Demo mode has no backend, so uploads are blocked with a toast instead.

import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, RefObject } from 'react';
import { apiFetch } from '../lib/api';
import { showToast } from '../lib/events';
import { isDemoMode } from '../demo';

// Sentinel thrown when demo mode swallows the upload; callers ignore it (the
// user already saw the "not available" toast) instead of re-surfacing it.
const DEMO_BLOCKED = 'demo-blocked';

export async function uploadImage(file: File | Blob): Promise<string> {
  if (isDemoMode()) {
    showToast('图片上传在 demo 模式下不可用', 'info');
    throw new Error(DEMO_BLOCKED);
  }
  const r = await apiFetch('/api/images', {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  });
  return ((await r.json()) as { url: string }).url;
}

export interface JournalImages {
  uploading: boolean;
  dragOver: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDragOver: (e: DragEvent<HTMLTextAreaElement>) => void;
  onDragLeave: (e: DragEvent<HTMLTextAreaElement>) => void;
  openPicker: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function useJournalImages(
  taRef: RefObject<HTMLTextAreaElement>,
  body: string,
  setBody: (v: string) => void,
): JournalImages {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Splice `\n![](url)\n` at the caret, reading the live textarea value so
  // sequential inserts (multiple files) stack correctly, then restore the
  // caret past the snippet on the next frame.
  const insertImage = useCallback(
    (url: string) => {
      const ta = taRef.current;
      const snippet = `\n![](${url})\n`;
      const src = ta ? ta.value : body;
      const start = ta ? ta.selectionStart : src.length;
      const end = ta ? ta.selectionEnd : src.length;
      setBody(src.slice(0, start) + snippet + src.slice(end));
      const caret = start + snippet.length;
      requestAnimationFrame(() => {
        if (!ta) return;
        ta.focus();
        ta.setSelectionRange(caret, caret);
      });
    },
    [taRef, body, setBody],
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith('image/'));
      if (imgs.length === 0) return;
      setUploading(true);
      try {
        for (const f of imgs) insertImage(await uploadImage(f));
      } catch (err) {
        if ((err as Error).message !== DEMO_BLOCKED) showToast((err as Error).message, 'error');
      } finally {
        setUploading(false);
      }
    },
    [insertImage],
  );

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(e.clipboardData.items)
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);
      if (files.length === 0) return; // let normal text paste through
      e.preventDefault();
      void handleFiles(files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback((e: DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);
  const onDrop = useCallback(
    (e: DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) void handleFiles(files);
    },
    [handleFiles],
  );

  const openPicker = useCallback(() => fileInputRef.current?.click(), []);
  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = ''; // allow re-picking the same file
      if (files.length) void handleFiles(files);
    },
    [handleFiles],
  );

  return {
    uploading,
    dragOver,
    fileInputRef,
    onPaste,
    onDrop,
    onDragOver,
    onDragLeave,
    openPicker,
    onFileChange,
  };
}
