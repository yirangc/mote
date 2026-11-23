import { useCallback, useEffect, useState } from 'react';

/**
 * Storage for Mote. Everything stays in this browser's localStorage, as one
 * versioned object keyed by the local date (PRD §5):
 *
 *   { "version": 1, "entries": { "2026-11-20": { responses, createdAt, updatedAt } } }
 *
 * Every write re-reads the latest stored object first, so a stale in-memory copy
 * can never bring back a deleted entry or replace another day. If the stored data
 * can't be read or parsed, writes are refused rather than overwriting it.
 */

export type Responses = [string, string, string];

export interface Entry {
  responses: Responses;
  /** UTC ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type Entries = Record<string, Entry>;

interface StoreV1 {
  version: 1;
  entries: Entries;
}

/** The shareable preview build (`npm run build:preview`) starts with sample entries, kept apart from real data. */
export const PREVIEW = import.meta.env.VITE_PREVIEW === '1';
const STORAGE_KEY = PREVIEW ? 'mote.preview' : 'mote';

// ---------- dates (always the device's local calendar) ----------

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayKey = () => toKey(new Date());

/** "Friday, November 20" */
export const longDate = (key: string) =>
  fromKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** "November 20" */
export const monthDay = (key: string) => fromKey(key).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

/** "November 2026" */
export const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

// ---------- the store ----------

export type ReadResult = { ok: true; entries: Entries } | { ok: false; reason: 'unavailable' | 'invalid' };
export type SaveOutcome = 'saved' | 'failed' | 'exists';
export type WriteResult = { ok: true; entries: Entries } | { ok: false };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isEntry(v: unknown): v is Entry {
  const e = v as Entry;
  return (
    !!e &&
    Array.isArray(e.responses) &&
    e.responses.length === 3 &&
    e.responses.every((r) => typeof r === 'string') &&
    typeof e.createdAt === 'string' &&
    typeof e.updatedAt === 'string'
  );
}

function parse(raw: string): Entries | null {
  try {
    const data = JSON.parse(raw) as StoreV1;
    if (!data || data.version !== 1 || typeof data.entries !== 'object' || data.entries === null) return null;
    for (const [k, v] of Object.entries(data.entries)) if (!DATE_KEY.test(k) || !isEntry(v)) return null;
    return data.entries;
  } catch {
    return null;
  }
}

export function readStore(): ReadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (raw === null) return { ok: true, entries: PREVIEW ? sampleEntries() : {} };
  const entries = parse(raw);
  return entries ? { ok: true, entries } : { ok: false, reason: 'invalid' };
}

/** Re-read, apply `change`, write, then read back to confirm. Never reports success without a confirmed write. */
function update(change: (entries: Entries) => Entries): WriteResult {
  const current = readStore();
  if (!current.ok) return { ok: false };
  const next = change({ ...current.entries });
  try {
    const raw = JSON.stringify({ version: 1, entries: next } satisfies StoreV1);
    localStorage.setItem(STORAGE_KEY, raw);
    if (localStorage.getItem(STORAGE_KEY) !== raw) return { ok: false };
  } catch {
    return { ok: false };
  }
  return { ok: true, entries: next };
}

export function saveEntry(date: string, responses: Responses): WriteResult {
  return update((entries) => {
    const now = new Date().toISOString();
    entries[date] = {
      responses: responses.map((r) => r.trim()) as Responses,
      createdAt: entries[date]?.createdAt ?? now,
      updatedAt: now,
    };
    return entries;
  });
}

export function deleteEntry(date: string): WriteResult {
  return update((entries) => {
    delete entries[date];
    return entries;
  });
}

/** Sample entries from the designs, used only by the preview build. */
function sampleEntries(): Entries {
  const now = new Date();
  const ago = (n: number) => toKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  const ts = now.toISOString();
  const e = (responses: Responses): Entry => ({ responses, createdAt: ts, updatedAt: ts });
  return {
    [ago(3)]: e(['The sun finally reached my desk.', 'A friend sent me a photo of her dog.', 'I had time for a walk after work.']),
    [ago(4)]: e(['Dinner with my sister.', 'I finally watered the plants.', 'The kitchen smelled like toast.']),
    [ago(7)]: e(['Fresh sheets after a long day.', 'My neighbor brought me tea.', 'I got to sleep early.']),
  };
}

// ---------- React hook ----------

export function useJournal() {
  const [state, setState] = useState<ReadResult>(readStore);

  // Pick up changes made in other tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setState(readStore());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * `asNew` refuses to replace an entry that already exists in storage for that
   * date (for example one saved from another tab), so a new draft never overwrites it.
   */
  const save = useCallback((date: string, responses: Responses, asNew: boolean): SaveOutcome => {
    if (asNew) {
      const fresh = readStore();
      if (fresh.ok && fresh.entries[date]) {
        setState(fresh);
        return 'exists';
      }
    }
    const r = saveEntry(date, responses);
    if (r.ok) setState({ ok: true, entries: r.entries });
    return r.ok ? 'saved' : 'failed';
  }, []);

  const remove = useCallback((date: string) => {
    const r = deleteEntry(date);
    if (r.ok) setState({ ok: true, entries: r.entries });
    return r.ok;
  }, []);

  const reload = useCallback(() => setState(readStore()), []);

  return {
    entries: state.ok ? state.entries : {},
    storageError: state.ok ? null : state.reason,
    save,
    remove,
    reload,
  };
}
