/** Coerce API / Mongo date fields to a millisecond timestamp, or null if missing/invalid. */
export function toTimestamp(value: unknown): number | null {
  if (value == null) return null;

  try {
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
      if (record != null && '$date' in record) {
        return toTimestamp(record.$date);
      }
      const getTime = record?.getTime;
      if (typeof getTime === 'function') {
        const t = (getTime as () => number).call(record);
        return Number.isNaN(t) ? null : t;
      }
    }
  } catch {
    return null;
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
  try {
    const ta = toTimestamp(fieldA) ?? 0;
    const tb = toTimestamp(fieldB) ?? 0;
    return tb - ta;
  } catch {
    return 0;
  }
}

/** Sort a copy by date field without throwing when individual items have bad dates. */
export function sortByDateDesc<T>(
  items: T[],
  getDate: (item: T) => unknown = (item) =>
    (item as { createdAt?: unknown }).createdAt,
): T[] {
  try {
    return [...items].sort((a, b) => compareByDateDesc(getDate(a), getDate(b)));
  } catch {
    return [...items];
  }
}
