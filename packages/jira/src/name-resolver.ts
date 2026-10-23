export interface NameResolverOptions<T> {
  label: string;
  // Ordered by priority: a later accessor is only consulted when an earlier one matched nothing.
  names: Array<(item: T) => string | undefined>;
  id: (item: T) => string | undefined;
  describe: (item: T) => string;
}

function matchingIds<T>(items: T[], needle: string, name: (item: T) => string | undefined, id: (item: T) => string | undefined) {
  const ids = new Set<string>();
  for (const item of items) {
    const itemId = id(item);
    if (itemId && name(item)?.trim().toLowerCase() === needle) {
      ids.add(itemId);
    }
  }
  return ids;
}

// Several matches sharing one id are not ambiguous; only distinct ids within the same priority level are.
export function resolveUniqueId<T>(items: T[], query: string, options: NameResolverOptions<T>): string {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    throw new Error(`Missing ${options.label} name`);
  }
  let ids = new Set<string>();
  for (const name of options.names) {
    ids = matchingIds(items, needle, name, options.id);
    if (ids.size > 0) {
      break;
    }
  }
  if (ids.size === 1) {
    return [...ids][0];
  }
  const reason = ids.size === 0 ? `No ${options.label} matches "${query}"` : `Ambiguous ${options.label} "${query}"`;
  const available = items.map(options.describe).join('; ') || 'none';
  throw new Error(`${reason}. Available: ${available}`);
}
