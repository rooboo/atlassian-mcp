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

  it('prefers an exact transition name over target status matches', () => {
    const both = [
      { id: '31', name: 'Done', to: { name: 'Done' } },
      { id: '41', name: "Won't Do", to: { name: 'Done' } },
    ];
    expect(resolveTransitionId(both, 'Done')).toBe('31');
  });

  it('falls back to the target status when no transition name matches', () => {
    expect(resolveTransitionId([{ id: '41', name: "Won't Do", to: { name: 'Done' } }], 'Done')).toBe('41');
  });

  it('rejects ambiguous transition names with different ids', () => {
    const ambiguous = [...transitions, { id: '41', name: 'Resolve', to: { name: 'Closed' } }];
    expect(() => resolveTransitionId(ambiguous, 'resolve')).toThrow(/Ambiguous transition "resolve"\. Available: .*id=41/);
  });

  it('rejects ambiguous target statuses when no name matches', () => {
    const ambiguous = [...transitions, { id: '41', name: "Won't Do", to: { name: 'Done' } }];
    expect(() => resolveTransitionId(ambiguous, 'done')).toThrow(/Ambiguous transition "done"\. Available: .*id=41/);
  });


  it('treats several matches with the same id as one', () => {
    const duplicated = [...transitions, { id: '21', name: 'Done', to: { name: 'Done' } }];
    expect(resolveTransitionId(duplicated, 'Done')).toBe('21');
  });

  it('omits the target in the listing when a transition has none', () => {
    expect(() => resolveTransitionId([{ id: '51', name: 'Archive' }], 'Reopen')).toThrow(
      /^No transition matches "Reopen"\. Available: id=51 name="Archive"$/,
    );
  });

  it('rejects an empty query', () => {
    expect(() => resolveTransitionId(transitions, '  ')).toThrow('Missing transition name');
  });

  it('reports "none" when the issue has no transitions', () => {
    expect(() => resolveTransitionId([], 'Done')).toThrow('No transition matches "Done". Available: none');
  });
});
