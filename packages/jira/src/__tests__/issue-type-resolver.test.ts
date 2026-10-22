import { resolveIssueTypeId } from '../issue-type-resolver.js';

const issueTypes = [
  { id: '10001', name: 'Task', subtask: false },
  { id: '10002', name: 'Bug', subtask: false },
  { id: '10003', name: 'Sub-task', subtask: true },
];

describe('resolveIssueTypeId', () => {
  it('matches by name', () => {
    expect(resolveIssueTypeId(issueTypes, 'Bug')).toBe('10002');
  });

  it('matches case-insensitively', () => {
    expect(resolveIssueTypeId(issueTypes, 'sub-TASK')).toBe('10003');
  });

  it('lists valid issue types when nothing matches', () => {
    expect(() => resolveIssueTypeId(issueTypes, 'Story')).toThrow(
      'No issue type matches "Story". Available: id=10001 name="Task"; id=10002 name="Bug"; id=10003 name="Sub-task"',
    );
  });

  it('rejects ambiguous names with different ids', () => {
    const ambiguous = [...issueTypes, { id: '10004', name: 'task' }];
    expect(() => resolveIssueTypeId(ambiguous, 'Task')).toThrow(/Ambiguous issue type "Task"/);
  });

  it('treats duplicate entries with the same id as one', () => {
    expect(resolveIssueTypeId([...issueTypes, { id: '10001', name: 'Task' }], 'task')).toBe('10001');
  });

  it('rejects an empty query', () => {
    expect(() => resolveIssueTypeId(issueTypes, '')).toThrow('Missing issue type name');
  });
});
