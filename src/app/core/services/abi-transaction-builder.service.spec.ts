import {
  AbiDefinition,
  createFieldsForStruct,
  createModelForAction,
  initialValueForType,
  parseAbiType,
  resolveAlias,
} from './abi-transaction-builder.service';
import { describe, expect, it } from 'vitest';

const ABI: AbiDefinition = {
  version: 'eosio::abi/1.2',
  types: [
    { new_type_name: 'account_name', type: 'name' },
    { new_type_name: 'custom_int', type: 'uint64' },
  ],
  variants: [
    { name: 'thing_variant', types: ['name', 'asset'] },
  ],
  structs: [
    {
      name: 'nested',
      fields: [
        { name: 'owner', type: 'account_name' },
        { name: 'enabled', type: 'bool' },
      ],
    },
    {
      name: 'transfer',
      fields: [
        { name: 'from', type: 'account_name' },
        { name: 'to', type: 'name' },
        { name: 'quantity', type: 'asset' },
        { name: 'memo', type: 'string' },
        { name: 'tags', type: 'string[]' },
        { name: 'maybe', type: 'custom_int?' },
        { name: 'extra', type: 'nested' },
        { name: 'extension', type: 'checksum256$' },
        { name: 'choice', type: 'thing_variant' },
      ],
    },
  ],
  actions: [
    { name: 'transfer', type: 'transfer' },
  ],
};

describe('ABI transaction builder helpers', () => {
  it('resolves aliases recursively', () => {
    expect(resolveAlias(ABI, 'account_name')).toBe('name');
    expect(resolveAlias(ABI, 'custom_int')).toBe('uint64');
  });

  it('parses arrays, optionals, binary extensions, and variants', () => {
    expect(parseAbiType(ABI, 'string[]')).toEqual(expect.objectContaining({
      resolvedType: 'string',
      isArray: true,
    }));
    expect(parseAbiType(ABI, 'custom_int?')).toEqual(expect.objectContaining({
      resolvedType: 'uint64',
      isOptional: true,
    }));
    expect(parseAbiType(ABI, 'checksum256$')).toEqual(expect.objectContaining({
      resolvedType: 'checksum256',
      isBinaryExtension: true,
    }));
    expect(parseAbiType(ABI, 'thing_variant').variant?.types).toEqual(['name', 'asset']);
  });

  it('creates initialized plain form models for action structs', () => {
    const model = createModelForAction(ABI, ABI.actions[0]);
    expect(model).toEqual({
      from: '',
      to: '',
      quantity: '',
      memo: '',
      tags: [],
      maybe: null,
      extra: {
        owner: '',
        enabled: false,
      },
      extension: null,
      choice: {},
    });
  });

  it('creates field descriptors for nested ABI shapes', () => {
    const fields = createFieldsForStruct(ABI, 'transfer', []);
    expect(fields.find(f => f.name === 'from')?.kind).toBe('name');
    expect(fields.find(f => f.name === 'tags')?.kind).toBe('array');
    expect(fields.find(f => f.name === 'choice')?.kind).toBe('variant');
    expect(fields.find(f => f.name === 'extra')?.children.map(f => f.name)).toEqual(['owner', 'enabled']);
  });

  it('uses null for optional and binary-extension initial values', () => {
    expect(initialValueForType(ABI, 'custom_int?')).toBeNull();
    expect(initialValueForType(ABI, 'checksum256$')).toBeNull();
  });
});
