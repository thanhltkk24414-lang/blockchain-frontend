/** Extract a MongoDB ObjectId string from API fields (plain id or populated job). */
export function resolveMongoJobId(value: unknown): string | undefined {
  if (value == null) return undefined;

  if (typeof value === 'string') {
    return /^[a-f\d]{24}$/i.test(value) ? value : undefined;
  }

  if (typeof value === 'object' && '_id' in value) {
    const id = (value as { _id?: unknown })._id;
    if (typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)) return id;
    if (id != null && typeof id === 'object' && 'toString' in id) {
      const asString = String(id);
      return /^[a-f\d]{24}$/i.test(asString) ? asString : undefined;
    }
  }

  return undefined;
}

export function jobDetailPath(mongoJobId?: string, onchainJobId?: number): string | undefined {
  if (mongoJobId) return `/jobs/${mongoJobId}`;
  if (onchainJobId != null && onchainJobId > 0) return `/jobs/onchain/${onchainJobId}`;
  return undefined;
}
