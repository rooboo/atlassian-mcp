import type { CreateMetaIssueTypeBean, FieldBean, FieldMetaBean } from './jira-client/index.js';

export const DEFAULT_MAX_ALLOWED_VALUES = 20;

export interface FieldFilter {
  onlyRequired?: boolean;
  maxAllowedValues?: number;
}

export interface CompactAllowedValue {
  id?: string;
  name?: string;
  value?: string;
  children?: CompactAllowedValue[];
  truncated?: true;
}

export interface CompactField {
  fieldId?: string;
  name?: string;
  required: boolean;
  type?: string;
  hasDefaultValue: boolean;
  allowedValues?: CompactAllowedValue[];
  truncated?: true;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

function toCompactAllowedValue(raw: Record<string, unknown>, limit: number): CompactAllowedValue {
  const compact: CompactAllowedValue = { id: optionalString(raw.id) };
  const name = optionalString(raw.name);
  const value = optionalString(raw.value);
  if (name !== undefined) {
    compact.name = name;
  }
  if (value !== undefined) {
    compact.value = value;
  }
  if (Array.isArray(raw.children)) {
    const children = raw.children as Array<Record<string, unknown>>;
    compact.children = children.slice(0, limit).map((child) => toCompactAllowedValue(child, limit));
    if (children.length > limit) {
      compact.truncated = true;
    }
  }
  return compact;
}

export function toCompactField(field: FieldMetaBean, maxAllowedValues = DEFAULT_MAX_ALLOWED_VALUES): CompactField {
  const compact: CompactField = {
    fieldId: field.fieldId,
    name: field.name,
    required: field.required === true,
    type: field.schema?.type,
    hasDefaultValue: field.hasDefaultValue === true,
  };
  if (field.allowedValues) {
    compact.allowedValues = field.allowedValues.slice(0, maxAllowedValues).map((raw) => toCompactAllowedValue(raw, maxAllowedValues));
    if (field.allowedValues.length > maxAllowedValues) {
      compact.truncated = true;
    }
  }
  return compact;
}

export function compactFields(fields: FieldMetaBean[], filter: FieldFilter = {}): CompactField[] {
  return fields
    .filter((field) => !filter.onlyRequired || field.required === true)
    .map((field) => toCompactField(field, filter.maxAllowedValues));
}

// editmeta keys fields by id and does not repeat the id inside each entry.
export function compactFieldMap(fields: Record<string, FieldMetaBean>, filter: FieldFilter = {}): CompactField[] {
  return compactFields(Object.entries(fields).map(([fieldId, field]) => ({ fieldId, ...field })), filter);
}

export function toCompactIssueType(issueType: CreateMetaIssueTypeBean) {
  return { id: issueType.id, name: issueType.name, subtask: issueType.subtask === true };
}

export function searchFieldList(fields: FieldBean[], query?: string) {
  const needle = query?.trim().toLowerCase();
  return fields
    .filter((field) => !needle || [field.name, field.id].some((text) => text?.toLowerCase().includes(needle)))
    .map((field) => ({ id: field.id, name: field.name, custom: field.custom === true, type: field.schema?.type }));
}
