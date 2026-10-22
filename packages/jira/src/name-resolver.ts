export interface NameResolverOptions<T> {
  label: string;
  names: (item: T) => Array<string | undefined>;
  id: (item: T) => string | undefined;
  describe: (item: T) => string;
}

// Several matches sharing one id are not ambiguous; only distinct ids are.
export function resolveUniqueId<T>(items: T[], query: string, options: NameResolverOptions<T>): string {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    throw new Error(`Missing ${options.label} name`);
  }
  const ids = new Set<string>();
  for (const item of items) {
    const id = options.id(item);
    if (id && options.names(item).some((name) => name?.trim().toLowerCase() === needle)) {
      ids.add(id);
    }
  }
  if (ids.size === 1) {
    return [...ids][0];
  }
  const reason = ids.size === 0 ? `No ${options.label} matches "${query}"` : `Ambiguous ${options.label} "${query}"`;
  const available = items.map(options.describe).join('; ') || 'none';
  throw new Error(`${reason}. Available: ${available}`);
}
