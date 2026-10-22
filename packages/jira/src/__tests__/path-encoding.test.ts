import { JiraService } from '../jira-service.js';

describe('JiraService path parameter encoding', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let jiraService: JiraService;

  beforeEach(() => {
    fetchMock = jest.fn(async () => new Response(null, { status: 204 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    jiraService = new JiraService('jira.example.com', 'test-token', undefined, () => 25);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function requestedUrl(): string {
    return String(fetchMock.mock.calls[0][0]);
  }

  it('keeps a traversal attempt inside the addressed path segment', async () => {
    await jiraService.unlinkIssues('../../issue/ABC-1');

    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
    expect(requestedUrl()).toBe('https://jira.example.com/rest/api/2/issueLink/..%2F..%2Fissue%2FABC-1');
  });

  it('encodes query and fragment delimiters in path parameters', async () => {
    await jiraService.watchIssue('PROJ-1?x=1#y');

    expect(requestedUrl()).toBe('https://jira.example.com/rest/api/2/issue/PROJ-1%3Fx%3D1%23y/watchers');
  });

  it('leaves regular issue keys and numeric ids unchanged', async () => {
    await jiraService.getTransitions('PROJ-123');
    await jiraService.unlinkIssues('10042');

    expect(requestedUrl()).toBe('https://jira.example.com/rest/api/2/issue/PROJ-123/transitions');
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://jira.example.com/rest/api/2/issueLink/10042');
  });
});
