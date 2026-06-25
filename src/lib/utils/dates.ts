/** Coerce API / Mongo date fields to a millisecond timestamp, or null if missing/invalid. */
export function toTimestamp(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const t = new Date(trimmed).getTime();
    return Number.isNaN(t) ? null : t;
  }

  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('$date' in record) {
      return toTimestamp(record.$date);
    }
    if (typeof record.getTime === 'function') {
      const t = (record.getTime as () => number)();
      return Number.isNaN(t) ? null : t;
    }
  }

  return null;
}

export function parseApiDate(value: unknown): string | undefined {
  const ts = toTimestamp(value);
  return ts != null ? new Date(ts).toISOString() : undefined;
}

export function formatApiDate(value: unknown, fallback = '—'): string {
  const ts = toTimestamp(value);
  if (ts == null) return fallback;
  return new Date(ts).toLocaleString();
}

export function formatApiDateShort(value: unknown): string | null {
  const ts = toTimestamp(value);
  if (ts == null) return null;
  return new Date(ts).toLocaleDateString();
}

export function compareByDateDesc(
  a: unknown,
  b: unknown,
  fieldA: unknown = a,
  fieldB: unknown = b,
): number {
  const ta = toTimestamp(fieldA) ?? 0;
  const tb = toTimestamp(fieldB) ?? 0;
  return tb - ta;
}
