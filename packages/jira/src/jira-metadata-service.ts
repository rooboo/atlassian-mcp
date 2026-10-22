import { handleApiOperation } from '@atlassian-dc-mcp/common';
import { FieldService, IssueService, type CreateMetaIssueTypeBean, type FieldBean, type FieldMetaBean } from './jira-client/index.js';
import { compactFieldMap, compactFields, searchFieldList, toCompactIssueType, type FieldFilter } from './field-metadata.js';
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

export interface IssueTypeRef {
  issueTypeId?: string;
  issueType?: string;
}

function pageInfo<T>(page: MetaPage<T>) {
  return { startAt: page.startAt, maxResults: page.maxResults, total: page.total, isLast: page.isLast };
}

// The generated client types the paged createmeta responses as a single bean.
function asPage<T>(response: unknown): MetaPage<T> {
  return response as MetaPage<T>;
}

export class JiraMetadataService {
  constructor(private readonly getPageSize: () => number) {}

  private pageArgs(page: PageParams): [string, string | undefined] {
    return [String(page.maxResults ?? this.getPageSize()), page.startAt?.toString()];
  }

  async fetchIssueTypes(projectKey: string, page: PageParams = {}): Promise<MetaPage<CreateMetaIssueTypeBean>> {
    return asPage(await IssueService.getCreateIssueMetaProjectIssueTypes(projectKey, ...this.pageArgs(page)));
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

  async getIssueTypes(projectKey: string, page: PageParams = {}) {
    return handleApiOperation(async () => {
      const result = await this.fetchIssueTypes(projectKey, page);
      return { ...pageInfo(result), issueTypes: (result.values ?? []).map(toCompactIssueType) };
    }, 'Error getting issue types');
  }

  async getCreateFields(projectKey: string, type: IssueTypeRef, filter: FieldFilter = {}, page: PageParams = {}) {
    return handleApiOperation(async () => {
      const issueTypeId = await this.resolveIssueTypeId(projectKey, type.issueTypeId, type.issueType);
      const result = asPage<FieldMetaBean>(
        await IssueService.getCreateIssueMetaFields(issueTypeId, projectKey, ...this.pageArgs(page)),
      );
      return { ...pageInfo(result), issueTypeId, fields: compactFields(result.values ?? [], filter) };
    }, 'Error getting create fields');
  }

  async getEditFields(issueKey: string, filter: FieldFilter = {}) {
    return handleApiOperation(async () => {
      const editMeta = await IssueService.getEditIssueMeta(issueKey);
      const fields = (editMeta.fields ?? {}) as Record<string, FieldMetaBean>;
      return { fields: compactFieldMap(fields, filter) };
    }, 'Error getting edit fields');
  }

  async searchFields(query?: string) {
    return handleApiOperation(async () => {
      // The generated client types this list response as a single bean.
      const fields = (await FieldService.getFields()) as unknown as FieldBean[];
      return { fields: searchFieldList(fields, query) };
    }, 'Error searching fields');
  }
}
