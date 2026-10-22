import { JiraService } from '../jira-service.js';
import { IssueService } from '../jira-client/index.js';

jest.mock('../jira-client/core/request.js', () => ({
  request: jest.fn(),
}));

jest.mock('../jira-client/index.js', () => ({
  IssueService: {
    getTransitions: jest.fn(),
    doTransition: jest.fn(),
    createIssue: jest.fn(),
    getCreateIssueMetaProjectIssueTypes: jest.fn(),
    getCreateIssueMetaFields: jest.fn(),
    getEditIssueMeta: jest.fn(),
  },
  FieldService: {
    getFields: jest.fn(),
  },
  OpenAPI: {
    BASE: '',
    TOKEN: '',
    VERSION: '',
  },
}));

const issueTypesPage = {
  startAt: 0,
  maxResults: 100,
  total: 2,
  isLast: true,
  values: [
    { id: '10001', name: 'Task', subtask: false, iconUrl: 'x' },
    { id: '10003', name: 'Sub-task', subtask: true, iconUrl: 'y' },
  ],
};

describe('JiraService name resolution', () => {
  let jiraService: JiraService;

  beforeEach(() => {
    jiraService = new JiraService('test-host', 'test-token', undefined, () => 25);
    jest.clearAllMocks();
  });

  describe('transitionIssue', () => {
    it('resolves the transition name before transitioning', async () => {
      (IssueService.getTransitions as jest.Mock).mockResolvedValue({
        transitions: [
          { id: '11', name: 'Start Progress', to: { name: 'In Progress' } },
          { id: '21', name: 'Resolve', to: { name: 'Done' } },
        ],
      });
      (IssueService.doTransition as jest.Mock).mockResolvedValue(undefined);

      const result = await jiraService.transitionIssue({ issueKey: 'PROJ-1', transition: 'done' });

      expect(result.success).toBe(true);
      expect(IssueService.getTransitions).toHaveBeenCalledWith('PROJ-1');
      expect(IssueService.doTransition).toHaveBeenCalledWith('PROJ-1', { transition: { id: '21' } });
    });

    it('uses transitionId without looking up transitions', async () => {
      (IssueService.doTransition as jest.Mock).mockResolvedValue(undefined);

      const result = await jiraService.transitionIssue({ issueKey: 'PROJ-1', transitionId: '31', transition: 'Done' });

      expect(result.success).toBe(true);
      expect(IssueService.getTransitions).not.toHaveBeenCalled();
      expect(IssueService.doTransition).toHaveBeenCalledWith('PROJ-1', { transition: { id: '31' } });
    });

    it('fails with the available transitions when the name is unknown', async () => {
      (IssueService.getTransitions as jest.Mock).mockResolvedValue({
        transitions: [{ id: '11', name: 'Start Progress', to: { name: 'In Progress' } }],
      });

      const result = await jiraService.transitionIssue({ issueKey: 'PROJ-1', transition: 'Reopen' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('id=11 name="Start Progress" to="In Progress"');
      expect(IssueService.doTransition).not.toHaveBeenCalled();
    });

    it('requires transitionId or transition', async () => {
      const result = await jiraService.transitionIssue({ issueKey: 'PROJ-1' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Either transitionId or transition must be provided');
      expect(IssueService.doTransition).not.toHaveBeenCalled();
    });
  });

  describe('createIssue', () => {
    const baseParams = { projectId: 'PROJ', summary: 'S', description: 'D' };

    it('resolves the issue type name within the project', async () => {
      (IssueService.getCreateIssueMetaProjectIssueTypes as jest.Mock).mockResolvedValue(issueTypesPage);
      (IssueService.createIssue as jest.Mock).mockResolvedValue({ key: 'PROJ-2' });

      const result = await jiraService.createIssue({ ...baseParams, issueType: 'task' });

      expect(result.success).toBe(true);
      expect(IssueService.getCreateIssueMetaProjectIssueTypes).toHaveBeenCalledWith('PROJ', '100', undefined);
      expect(IssueService.createIssue).toHaveBeenCalledWith(true, {
        fields: { project: { key: 'PROJ' }, summary: 'S', description: 'D', issuetype: { id: '10001' } },
      });
    });

    it('uses issueTypeId without looking up issue types', async () => {
      (IssueService.createIssue as jest.Mock).mockResolvedValue({ key: 'PROJ-2' });

      await jiraService.createIssue({ ...baseParams, issueTypeId: '10002' });

      expect(IssueService.getCreateIssueMetaProjectIssueTypes).not.toHaveBeenCalled();
      expect(IssueService.createIssue).toHaveBeenCalledWith(true, {
        fields: { project: { key: 'PROJ' }, summary: 'S', description: 'D', issuetype: { id: '10002' } },
      });
    });

    it('fails with the valid issue types when the name is unknown', async () => {
      (IssueService.getCreateIssueMetaProjectIssueTypes as jest.Mock).mockResolvedValue(issueTypesPage);

      const result = await jiraService.createIssue({ ...baseParams, issueType: 'Story' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No issue type matches "Story". Available: id=10001 name="Task"; id=10003 name="Sub-task"');
      expect(IssueService.createIssue).not.toHaveBeenCalled();
    });

    it('requires issueTypeId or issueType', async () => {
      const result = await jiraService.createIssue(baseParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Either issueTypeId or issueType must be provided');
    });
  });
});
