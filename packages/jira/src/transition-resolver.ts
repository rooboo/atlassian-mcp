import type { TransitionBean } from './jira-client/index.js';
import { resolveUniqueId } from './name-resolver.js';

export function resolveTransitionId(transitions: TransitionBean[], query: string): string {
  return resolveUniqueId(transitions, query, {
    label: 'transition',
    names: [(transition) => transition.name, (transition) => transition.to?.name],
    id: (transition) => transition.id,
    describe: (transition) => `id=${transition.id} name="${transition.name}" to="${transition.to?.name}"`,
  });
}
