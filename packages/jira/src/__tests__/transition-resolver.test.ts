import { resolveTransitionId } from '../transition-resolver.js';

const transitions = [
  { id: '11', name: 'Start Progress', to: { name: 'In Progress' } },
  { id: '21', name: 'Resolve', to: { name: 'Done' } },
  { id: '31', name: 'Close', to: { name: 'Closed' } },
];

describe('resolveTransitionId', () => {
  it('matches by transition name', () => {
    expect(resolveTransitionId(transitions, 'Start Progress')).toBe('11');
  });

  it('matches by target status name', () => {
    expect(resolveTransitionId(transitions, 'Done')).toBe('21');
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(resolveTransitionId(transitions, '  in progress ')).toBe('11');
  });

  it('lists available transitions when nothing matches', () => {
    expect(() => resolveTransitionId(transitions, 'Reopen')).toThrow(
      'No transition matches "Reopen". Available: id=11 name="Start Progress" to="In Progress"; ' +
        'id=21 name="Resolve" to="Done"; id=31 name="Close" to="Closed"',
    );
  });

  it('rejects ambiguous matches with different ids', () => {
    const ambiguous = [...transitions, { id: '41', name: 'Done', to: { name: 'Done' } }];
    expect(() => resolveTransitionId(ambiguous, 'done')).toThrow(/Ambiguous transition "done"\. Available: .*id=41/);
  });

  it('treats several matches with the same id as one', () => {
    const duplicated = [...transitions, { id: '21', name: 'Done', to: { name: 'Done' } }];
    expect(resolveTransitionId(duplicated, 'Done')).toBe('21');
  });

  it('rejects an empty query', () => {
    expect(() => resolveTransitionId(transitions, '  ')).toThrow('Missing transition name');
  });

  it('reports "none" when the issue has no transitions', () => {
    expect(() => resolveTransitionId([], 'Done')).toThrow('No transition matches "Done". Available: none');
  });
});
