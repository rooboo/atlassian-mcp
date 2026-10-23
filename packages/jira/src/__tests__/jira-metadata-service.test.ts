import { JiraService } from '../jira-service.js';
import { FieldService, IssueService } from '../jira-client/index.js';

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
      expect(IssueService.getCreateIssueMetaProjectIssueTypes).toHaveBeenCalledWith('PROJ', '100', '0');
      expect(IssueService.createIssue).toHaveBeenCalledWith(true, {
        fields: { project: { key: 'PROJ' }, summary: 'S', description: 'D', issuetype: { id: '10001' } },
      });
    });

    it('pages through the project issue types until the name is found', async () => {
      (IssueService.getCreateIssueMetaProjectIssueTypes as jest.Mock)
        .mockResolvedValueOnce({ startAt: 0, total: 3, isLast: false, values: [{ id: '10001', name: 'Task' }, { id: '10002', name: 'Bug' }] })
        .mockResolvedValueOnce({ startAt: 2, total: 3, isLast: true, values: [{ id: '10003', name: 'Story' }] });
      (IssueService.createIssue as jest.Mock).mockResolvedValue({ key: 'PROJ-2' });

      const result = await jiraService.createIssue({ ...baseParams, issueType: 'story' });

      expect(result.success).toBe(true);
      expect(IssueService.getCreateIssueMetaProjectIssueTypes).toHaveBeenNthCalledWith(2, 'PROJ', '100', '2');
      expect(IssueService.createIssue).toHaveBeenCalledWith(true, {
        fields: expect.objectContaining({ issuetype: { id: '10003' } }),
      });
    });

    it('lists issue types of all pages when the name is unknown', async () => {
      (IssueService.getCreateIssueMetaProjectIssueTypes as jest.Mock)
        .mockResolvedValueOnce({ total: 2, isLast: false, values: [{ id: '1', name: 'Task' }] })
        .mockResolvedValueOnce({ total: 2, isLast: true, values: [{ id: '2', name: 'Bug' }] });

      const result = await jiraService.createIssue({ ...baseParams, issueType: 'Epic' });

      expect(result.error).toBe('No issue type matches "Epic". Available: id=1 name="Task"; id=2 name="Bug"');
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

describe('JiraService field discovery', () => {
  let jiraService: JiraService;

  beforeEach(() => {
    jiraService = new JiraService('test-host', 'test-token', undefined, () => 25);
    jest.clearAllMocks();
  });

  it('lists compact issue types with the default page size', async () => {
    (IssueService.getCreateIssueMetaProjectIssueTypes as jest.Mock).mockResolvedValue(issueTypesPage);

    const result = await jiraService.metadata.getIssueTypes('PROJ');

    expect(IssueService.getCreateIssueMetaProjectIssueTypes).toHaveBeenCalledWith('PROJ', '25', undefined);
    expect(result.data).toEqual({
      startAt: 0,
      maxResults: 100,
      total: 2,
      isLast: true,
      issueTypes: [
        { id: '10001', name: 'Task', subtask: false },
        { id: '10003', name: 'Sub-task', subtask: true },
      ],
    });
  });

  it('resolves the issue type name and returns only required create fields', async () => {
    (IssueService.getCreateIssueMetaProjectIssueTypes as jest.Mock).mockResolvedValue(issueTypesPage);
    (IssueService.getCreateIssueMetaFields as jest.Mock).mockResolvedValue({
      isLast: true,
      values: [
        { fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' } },
        { fieldId: 'labels', name: 'Labels', required: false, schema: { type: 'array' } },
      ],
    });

    const result = await jiraService.metadata.getCreateFields('PROJ', { issueType: 'Task' }, { onlyRequired: true });

    expect(IssueService.getCreateIssueMetaFields).toHaveBeenCalledWith('10001', 'PROJ', '100', '0');
    expect(result.data?.issueTypeId).toBe('10001');
    expect(result.data?.fields).toEqual([{ fieldId: 'summary', name: 'Summary', required: true, type: 'string', hasDefaultValue: false }]);
  });

  it('collects required fields across all pages when onlyRequired is set', async () => {
    (IssueService.getCreateIssueMetaFields as jest.Mock)
      .mockResolvedValueOnce({ startAt: 0, total: 3, isLast: false, values: [{ fieldId: 'summary', required: true }, { fieldId: 'labels', required: false }] })
      .mockResolvedValueOnce({ startAt: 2, total: 3, isLast: true, values: [{ fieldId: 'customfield_1', required: true }] });

    const result = await jiraService.metadata.getCreateFields('PROJ', { issueTypeId: '10001' }, { onlyRequired: true });

    expect(IssueService.getCreateIssueMetaFields).toHaveBeenNthCalledWith(1, '10001', 'PROJ', '100', '0');
    expect(IssueService.getCreateIssueMetaFields).toHaveBeenNthCalledWith(2, '10001', 'PROJ', '100', '2');
    expect(result.data).toMatchObject({ startAt: 0, maxResults: 2, total: 2, isLast: true });
    expect(result.data?.fields.map((field) => field.fieldId)).toEqual(['summary', 'customfield_1']);
  });

  it('flags the result when the page cap is hit while collecting required fields', async () => {
    (IssueService.getCreateIssueMetaFields as jest.Mock).mockResolvedValue({
      total: 10000,
      isLast: false,
      values: [{ fieldId: 'summary', required: true }],
    });

    const result = await jiraService.metadata.getCreateFields('PROJ', { issueTypeId: '10001' }, { onlyRequired: true });

    expect(IssueService.getCreateIssueMetaFields).toHaveBeenCalledTimes(20);
    expect(result.data).toMatchObject({ isLast: false, truncated: true });
  });

  it('forwards explicit pagination when onlyRequired is not set', async () => {
    (IssueService.getCreateIssueMetaFields as jest.Mock).mockResolvedValue({ values: [] });

    await jiraService.metadata.getCreateFields('PROJ', { issueTypeId: '10001' }, {}, { maxResults: 50, startAt: 10 });

    expect(IssueService.getCreateIssueMetaFields).toHaveBeenCalledWith('10001', 'PROJ', '50', '10');
  });

  it('uses issueTypeId for create fields without looking up issue types', async () => {
    (IssueService.getCreateIssueMetaFields as jest.Mock).mockResolvedValue({ values: [] });

    await jiraService.metadata.getCreateFields('PROJ', { issueTypeId: '10002' });

    expect(IssueService.getCreateIssueMetaProjectIssueTypes).not.toHaveBeenCalled();
    expect(IssueService.getCreateIssueMetaFields).toHaveBeenCalledWith('10002', 'PROJ', '25', undefined);
  });

  it('maps editmeta fields keyed by field id', async () => {
    (IssueService.getEditIssueMeta as jest.Mock).mockResolvedValue({
      fields: { customfield_10016: { name: 'Story Points', required: false, schema: { type: 'number' } } },
    });

    const result = await jiraService.metadata.getEditFields('PROJ-1');

    expect(IssueService.getEditIssueMeta).toHaveBeenCalledWith('PROJ-1');
    expect(result.data).toEqual({
      fields: [{ fieldId: 'customfield_10016', name: 'Story Points', required: false, type: 'number', hasDefaultValue: false }],
    });
  });

  it('filters the field list by query', async () => {
    (FieldService.getFields as jest.Mock).mockResolvedValue([
      { id: 'summary', name: 'Summary', custom: false, schema: { type: 'string' } },
      { id: 'customfield_10016', name: 'Story Points', custom: true, schema: { type: 'number' } },
    ]);

    const result = await jiraService.metadata.searchFields('story points');

    expect(result.data).toEqual({ total: 1, fields: [{ id: 'customfield_10016', name: 'Story Points', custom: true, type: 'number' }] });
  });

  it('reports API errors through handleApiOperation', async () => {
    (FieldService.getFields as jest.Mock).mockRejectedValue({ status: 401, statusText: 'Unauthorized', body: {} });

    const result = await jiraService.metadata.searchFields();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Error searching fields: 401 Unauthorized');
  });
});
