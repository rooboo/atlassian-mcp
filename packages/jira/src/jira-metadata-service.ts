import { IssueService, type CreateMetaIssueTypeBean } from './jira-client/index.js';
import { resolveIssueTypeId } from './issue-type-resolver.js';
import { resolveTransitionId } from './transition-resolver.js';

const ISSUE_TYPE_LOOKUP_LIMIT = 100;

export interface PageParams {
  maxResults?: number;
  startAt?: number;
}

export interface MetaPage<T> {
  values?: T[];
  startAt?: number;
  maxResults?: number;
  total?: number;
  isLast?: boolean;
}

export class JiraMetadataService {
  constructor(private readonly getPageSize: () => number) {}

  async fetchIssueTypes(projectKey: string, page: PageParams = {}): Promise<MetaPage<CreateMetaIssueTypeBean>> {
    const result = await IssueService.getCreateIssueMetaProjectIssueTypes(
      projectKey,
      String(page.maxResults ?? this.getPageSize()),
      page.startAt?.toString(),
    );
    // The generated client types this paged response as a single bean.
    return result as unknown as MetaPage<CreateMetaIssueTypeBean>;
  }

  async resolveIssueTypeId(projectKey: string, issueTypeId?: string, issueType?: string): Promise<string> {
    if (issueTypeId) {
      return issueTypeId;
    }
    if (!issueType) {
      throw new Error('Either issueTypeId or issueType must be provided');
    }
    const { values } = await this.fetchIssueTypes(projectKey, { maxResults: ISSUE_TYPE_LOOKUP_LIMIT });
    return resolveIssueTypeId(values ?? [], issueType);
  }

  async resolveTransitionId(issueKey: string, transitionId?: string, transition?: string): Promise<string> {
    if (transitionId) {
      return transitionId;
    }
    if (!transition) {
      throw new Error('Either transitionId or transition must be provided');
    }
    const { transitions } = await IssueService.getTransitions(issueKey);
    return resolveTransitionId(transitions ?? [], transition);
  }
}
