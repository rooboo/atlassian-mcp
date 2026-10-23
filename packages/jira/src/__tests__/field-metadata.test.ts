import { compactFieldMap, compactFields, DEFAULT_MAX_FIELDS, searchFieldList, toCompactField } from '../field-metadata.js';

const options = Array.from({ length: 25 }, (_, i) => ({ id: `${i}`, value: `Option ${i}`, self: 'http://x', disabled: false }));

describe('field metadata mapping', () => {
  it('maps a field without allowedValues', () => {
    expect(toCompactField({ fieldId: 'summary', name: 'Summary', required: true, schema: { type: 'string' }, operations: ['set'] })).toEqual({
      fieldId: 'summary',
      name: 'Summary',
      required: true,
      type: 'string',
      hasDefaultValue: false,
    });
  });

  it('keeps only id and name/value of allowed values', () => {
    const field = toCompactField({
      fieldId: 'priority',
      required: false,
      hasDefaultValue: true,
      allowedValues: [{ id: '1', name: 'High', iconUrl: 'x', self: 'y' }],
    });

    expect(field.allowedValues).toEqual([{ id: '1', name: 'High' }]);
    expect(field.hasDefaultValue).toBe(true);
    expect(field.truncated).toBeUndefined();
  });

  it('keeps cascading select children with id and value only', () => {
    const field = toCompactField({
      fieldId: 'customfield_2',
      allowedValues: [
        { id: '1', value: 'Europe', self: 'x', children: [{ id: '11', value: 'Germany', self: 'y' }, { id: '12', value: 'France' }] },
        { id: '2', value: 'Asia' },
      ],
    });

    expect(field.allowedValues).toEqual([
      { id: '1', value: 'Europe', children: [{ id: '11', value: 'Germany' }, { id: '12', value: 'France' }] },
      { id: '2', value: 'Asia' },
    ]);
  });

  it('limits children per parent and flags the parent as truncated', () => {
    const children = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, value: `Child ${i}` }));
    const field = toCompactField({ fieldId: 'customfield_2', allowedValues: [{ id: '1', value: 'Parent', children }] }, 3);

    expect(field.allowedValues?.[0].children).toHaveLength(3);
    expect(field.allowedValues?.[0].truncated).toBe(true);
    expect(field.truncated).toBeUndefined();
  });

  it('truncates allowedValues to 20 entries by default', () => {
    const field = toCompactField({ fieldId: 'customfield_1', allowedValues: options });

    expect(field.allowedValues).toHaveLength(20);
    expect(field.allowedValues?.[0]).toEqual({ id: '0', value: 'Option 0' });
    expect(field.truncated).toBe(true);
  });

  it('honors a custom allowedValues limit', () => {
    const fields = compactFields([{ fieldId: 'customfield_1', allowedValues: options }], { maxAllowedValues: 3 });

    expect(fields[0].allowedValues).toHaveLength(3);
    expect(fields[0].truncated).toBe(true);
  });

  it('filters required fields', () => {
    const fields = compactFields(
      [
        { fieldId: 'summary', required: true },
        { fieldId: 'labels', required: false },
        { fieldId: 'components' },
      ],
      { onlyRequired: true },
    );

    expect(fields.map((field) => field.fieldId)).toEqual(['summary']);
  });

  it('takes the field id from the editmeta key', () => {
    const fields = compactFieldMap({ customfield_10016: { name: 'Story Points', required: false, schema: { type: 'number' } } });

    expect(fields).toEqual([
      { fieldId: 'customfield_10016', name: 'Story Points', required: false, type: 'number', hasDefaultValue: false },
    ]);
  });

  it('searches fields by name or id, case-insensitively', () => {
    const fields = [
      { id: 'summary', name: 'Summary', custom: false, schema: { type: 'string' } },
      { id: 'customfield_10016', name: 'Story Points', custom: true, schema: { type: 'number' } },
    ];

    expect(searchFieldList(fields, 'story').fields).toEqual([{ id: 'customfield_10016', name: 'Story Points', custom: true, type: 'number' }]);
    expect(searchFieldList(fields, 'SUMMARY').fields.map((field) => field.id)).toEqual(['summary']);
    expect(searchFieldList(fields).fields).toHaveLength(2);
  });

  it('caps the field list and reports the total and truncation', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ id: `customfield_${i}`, name: `Field ${i}` }));

    const result = searchFieldList(many, '   ');

    expect(result.fields).toHaveLength(DEFAULT_MAX_FIELDS);
    expect(result).toMatchObject({ total: 120, truncated: true });
  });

  it('honors an explicit limit and does not flag complete results', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `f${i}`, name: `Field ${i}` }));

    expect(searchFieldList(many, 'field', 2)).toMatchObject({ total: 5, truncated: true });
    expect(searchFieldList(many, 'field', 5).truncated).toBeUndefined();
  });
});
