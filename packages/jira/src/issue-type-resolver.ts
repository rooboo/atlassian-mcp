import type { CreateMetaIssueTypeBean } from './jira-client/index.js';
import { resolveUniqueId } from './name-resolver.js';

export function resolveIssueTypeId(issueTypes: CreateMetaIssueTypeBean[], query: string): string {
  return resolveUniqueId(issueTypes, query, {
    label: 'issue type',
    names: [(issueType) => issueType.name],
    id: (issueType) => issueType.id,
    describe: (issueType) => `id=${issueType.id} name="${issueType.name}"`,
  });
}
