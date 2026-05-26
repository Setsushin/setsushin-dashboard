// Unit tests for the RSS/Atom parser in functions/api/feed.ts.
// Run with: npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseFeed, extract, cleanText } from '../functions/api/feed';

const SRC_RSS = { name: 'Example RSS', type: 'rss' };
const SRC_YT  = { name: 'Example YT', type: 'youtube' };

test('parseFeed: empty input → []', () => {
  assert.deepEqual(parseFeed('', SRC_RSS), []);
});

test('parseFeed: Atom (YouTube-style) entries', () => {
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Channel Title</title>
  <entry>
    <title>First video</title>
    <link rel="alternate" href="https://youtube.com/watch?v=abc"/>
    <published>2026-04-23T10:00:00+00:00</published>
  </entry>
  <entry>
    <title>Second video</title>
    <link rel="alternate" href="https://youtube.com/watch?v=def"/>
    <published>2026-04-22T12:00:00+00:00</published>
  </entry>
</feed>`;
  const items = parseFeed(xml, SRC_YT);
  assert.equal(items.length, 2);
  assert.equal(items[0].source, 'Example YT');
  assert.equal(items[0].kind, 'youtube');
  assert.equal(items[0].title, 'First video');
  assert.equal(items[0].link, 'https://youtube.com/watch?v=abc');
  assert.equal(items[0].published, '2026-04-23T10:00:00+00:00');
});

test('parseFeed: Atom prefers <published> but falls back to <updated>', () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>No published</title>
    <link rel="alternate" href="https://x.example"/>
    <updated>2026-04-20T00:00:00Z</updated>
  </entry>
</feed>`;
  const items = parseFeed(xml, SRC_YT);
  assert.equal(items.length, 1);
  assert.equal(items[0].published, '2026-04-20T00:00:00Z');
});

test('parseFeed: RSS 2.0 items', () => {
  const xml = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>HN clone</title>
    <item>
      <title>Show HN: Thing</title>
      <link>https://news.ycombinator.com/item?id=1</link>
      <pubDate>Mon, 27 Apr 2026 16:00:00 +0000</pubDate>
    </item>
    <item>
      <title>Ask HN: Something</title>
      <link>https://news.ycombinator.com/item?id=2</link>
      <pubDate>Mon, 27 Apr 2026 15:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;
  const items = parseFeed(xml, SRC_RSS);
  assert.equal(items.length, 2);
  assert.equal(items[0].kind, 'rss');
  assert.equal(items[0].title, 'Show HN: Thing');
  assert.equal(items[0].link, 'https://news.ycombinator.com/item?id=1');
  assert.equal(items[0].published, 'Mon, 27 Apr 2026 16:00:00 +0000');
});

test('parseFeed: RSS title with CDATA', () => {
  const xml = `<rss><channel>
  <item>
    <title><![CDATA[Title with <em>HTML</em> & ampersand]]></title>
    <link>https://x.example</link>
    <pubDate>Mon, 27 Apr 2026 00:00:00 +0000</pubDate>
  </item>
</channel></rss>`;
  const items = parseFeed(xml, SRC_RSS);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Title with HTML & ampersand');
});

test('parseFeed: RSS prefers Atom when both present (Atom is checked first)', () => {
  // Some hybrid feeds include both; Atom takes precedence in our parser.
  const xml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom one</title>
    <link rel="alternate" href="https://atom.example"/>
    <published>2026-04-27T00:00:00Z</published>
  </entry>
</feed>
<rss><channel>
  <item>
    <title>RSS shadowed</title>
    <link>https://rss.example</link>
    <pubDate>Mon, 27 Apr 2026 00:00:00 +0000</pubDate>
  </item>
</channel></rss>`;
  const items = parseFeed(xml, SRC_RSS);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Atom one');
});

test('parseFeed: malformed entries are skipped silently (no throw)', () => {
  const xml = `<rss><channel>
  <item>
    <title>OK item</title>
    <link>https://x.example</link>
    <pubDate>Mon, 27 Apr 2026 00:00:00 +0000</pubDate>
  </item>
  <item>
    <link>https://nofield.example</link>
  </item>
</channel></rss>`;
  // The second item has no <title> — parser still emits it with empty title.
  // The Function-level filter (x => x.title) drops it before returning.
  const items = parseFeed(xml, SRC_RSS).filter(x => x.title);
  assert.equal(items.length, 1);
});

test('extract: returns "" when no match', () => {
  assert.equal(extract('hello', /<title>(.+?)<\/title>/), '');
});

test('cleanText: strips HTML, decodes entities, unwraps CDATA', () => {
  assert.equal(cleanText('<p>Hello &amp; <b>world</b></p>'), 'Hello & world');
  assert.equal(cleanText('<![CDATA[5 &lt; 10]]>'), '5 < 10');
  assert.equal(cleanText('plain'), 'plain');
  assert.equal(cleanText(''), '');
});
