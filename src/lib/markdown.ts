// Markdown rendering for the journal widget. marked → DOMPurify → links open
// in a new tab. Falls back to escaped plain text if anything throws.

import { marked } from 'marked';
import DOMPurify from 'dompurify';

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML.replace(/\n/g, '<br>');
}

export function renderMarkdown(src: string): string {
  let html: string;
  try {
    html = marked.parse(src, { breaks: true, gfm: true, async: false });
  } catch {
    return escapeHtml(src);
  }
  // Explicitly allow <img> (journal inline images, src=/api/images/<uuid>).
  // Relative URLs already pass DOMPurify's default URI policy; this just
  // pins the intent so a version bump can't silently drop images.
  html = DOMPurify.sanitize(html, { ADD_TAGS: ['img'], ADD_ATTR: ['src', 'alt', 'title'] });
  // Force links to open in a new tab so a stray click never replaces the
  // dashboard. DOMPurify's output never pre-stamps target/rel on <a>.
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}
