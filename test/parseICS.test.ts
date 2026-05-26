// Unit tests for the ICS parser in functions/api/calendar.ts.

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseICS, parseICSDate } from '../functions/api/calendar';

test('parseICS: empty input → []', () => {
  assert.deepEqual(parseICS(''), []);
});

test('parseICS: single timed event', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Design Review
DTSTART:20260428T140000Z
DTEND:20260428T150000Z
LOCATION:Zoom
END:VEVENT
END:VCALENDAR`;
  const ev = parseICS(ics);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].title, 'Design Review');
  assert.equal(ev[0].start, '2026-04-28T14:00:00.000Z');
  assert.equal(ev[0].end, '2026-04-28T15:00:00.000Z');
  assert.equal(ev[0].location, 'Zoom');
  assert.equal(ev[0].allDay, false);
});

test('parseICS: multiple events', () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:First
DTSTART:20260428T100000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Second
DTSTART:20260428T120000Z
END:VEVENT
END:VCALENDAR`;
  const ev = parseICS(ics);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].title, 'First');
  assert.equal(ev[1].title, 'Second');
});

test('parseICS: line folding (RFC 5545 §3.1) is unfolded', () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:A really long title that spans
 multiple lines because someone wrote
 their event name as an essay
DTSTART:20260428T100000Z
END:VEVENT
END:VCALENDAR`;
  const ev = parseICS(ics);
  assert.equal(ev.length, 1);
  assert.match(ev[0].title, /spans.*multiple lines.*essay/);
});

test('parseICS: all-day event (VALUE=DATE)', () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Holiday
DTSTART;VALUE=DATE:20260501
DTEND;VALUE=DATE:20260502
END:VEVENT
END:VCALENDAR`;
  const ev = parseICS(ics);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].allDay, true);
  assert.equal(ev[0].start, '2026-05-01T00:00:00.000Z');
});

test('parseICS: TZID-prefixed DTSTART still parses (TZ ignored, treated as UTC)', () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:With timezone
DTSTART;TZID=America/Los_Angeles:20260428T090000
DTEND;TZID=America/Los_Angeles:20260428T100000
END:VEVENT
END:VCALENDAR`;
  const ev = parseICS(ics);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].title, 'With timezone');
  // We currently treat naive timestamps as UTC. Document this in the parser
  // if a user complains (unlikely for personal use).
  assert.equal(ev[0].start, '2026-04-28T09:00:00.000Z');
});

test('parseICS: SUMMARY with escaped chars', () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Lunch with Bob\\, Alice\\; followup\\nat 2pm
DTSTART:20260428T120000Z
END:VEVENT
END:VCALENDAR`;
  const ev = parseICS(ics);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].title, 'Lunch with Bob, Alice; followup\nat 2pm');
});

test('parseICS: skips events without DTSTART', () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:No date
END:VEVENT
BEGIN:VEVENT
SUMMARY:Has date
DTSTART:20260428T100000Z
END:VEVENT
END:VCALENDAR`;
  const ev = parseICS(ics);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].title, 'Has date');
});

test('parseICSDate: UTC form', () => {
  const d = parseICSDate('20260428T140000Z');
  assert.equal(d?.toISOString(), '2026-04-28T14:00:00.000Z');
});

test('parseICSDate: date-only form', () => {
  const d = parseICSDate('20260428');
  assert.equal(d?.toISOString(), '2026-04-28T00:00:00.000Z');
});

test('parseICSDate: naive (no Z) — treated as UTC for sort stability', () => {
  const d = parseICSDate('20260428T140000');
  assert.equal(d?.toISOString(), '2026-04-28T14:00:00.000Z');
});

test('parseICSDate: invalid input → null', () => {
  assert.equal(parseICSDate(''), null);
  assert.equal(parseICSDate(null), null);
  assert.equal(parseICSDate('not a date'), null);
});
