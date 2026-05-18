import { Injectable, signal } from '@angular/core';
import { TauriIpcService } from './tauri-ipc.service';
import { TxAction } from './transaction.service';

export interface AbiField {
  name: string;
  type: string;
}

export interface AbiStruct {
  name: string;
  base?: string;
  fields: AbiField[];
}

export interface AbiAction {
  name: string;
  type: string;
  ricardian_contract?: string;
}

export interface AbiTypeAlias {
  new_type_name: string;
  type: string;
}

export interface AbiVariant {
  name: string;
  types: string[];
}

export interface AbiDefinition {
  version?: string;
  types?: AbiTypeAlias[];
  structs: AbiStruct[];
  actions: AbiAction[];
  variants?: AbiVariant[];
}

export type AbiSource = 'chain' | 'cache' | 'pasted';
export type BuilderActionMode = 'guided' | 'raw';

export interface LoadedAbi {
  account: string;
  abi: AbiDefinition;
  source: AbiSource;
  cachedAt?: number;
}

export interface BuilderAuthorization {
  actor: string;
  permission: string;
}

export interface BuilderActionDraft {
  id: string;
  account: string;
  name: string;
  authorization: BuilderAuthorization[];
  data: Record<string, any>;
  mode: BuilderActionMode;
  abiStructName: string;
  rawJson: string;
}

export interface BuiltTransactionExport {
  chainId: string;
  account: string;
  actions: TxAction[];
  createdAt: string;
  abiSource: AbiSource | 'mixed';
}

export interface ParsedAbiType {
  raw: string;
  baseType: string;
  resolvedType: string;
  isArray: boolean;
  isOptional: boolean;
  isBinaryExtension: boolean;
  variant?: AbiVariant;
}

export type AbiFieldKind =
  | 'text'
  | 'number'
  | 'boolean'
  | 'asset'
  | 'name'
  | 'publicKey'
  | 'checksum'
  | 'bytes'
  | 'object'
  | 'array'
  | 'variant'
  | 'json';

export interface AbiFormField {
  id: string;
  name: string;
  label: string;
  path: string[];
  type: string;
  resolvedType: string;
  kind: AbiFieldKind;
  optional: boolean;
  binaryExtension: boolean;
  placeholder: string;
  children: AbiFormField[];
  itemType?: string;
  variantTypes?: string[];
}

const INTEGER_TYPES = new Set([
  'int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'varint32', 'varuint32',
]);

const BIG_INTEGER_TYPES = new Set([
  'int64', 'uint64', 'int128', 'uint128',
]);

const FLOAT_TYPES = new Set(['float32', 'float64']);
const NAME_TYPES = new Set(['name', 'account_name', 'permission_name', 'action_name', 'scope_name', 'table_name']);
const PUBLIC_KEY_TYPES = new Set(['public_key', 'signature']);
const CHECKSUM_TYPES = new Set(['checksum160', 'checksum256', 'checksum512', 'transaction_id_type', 'block_id_type']);
const ASSET_TYPES = new Set(['asset', 'extended_asset', 'symbol', 'symbol_code']);
const BYTES_TYPES = new Set(['bytes']);

@Injectable({ providedIn: 'root' })
export class AbiTransactionBuilderService {
  readonly recentContracts = signal<string[]>([]);

  constructor(private ipc: TauriIpcService) {}

  async loadRecentContracts(chainId: string): Promise<void> {
    const contracts = await this.ipc.storeGet<string[]>(`recentContracts:${chainId}`);
    this.recentContracts.set(contracts ?? []);
  }

  async rememberContract(chainId: string, contract: string): Promise<void> {
    const normalized = contract.trim();
    if (!normalized) return;
    const next = [normalized, ...this.recentContracts().filter(c => c !== normalized)].slice(0, 12);
    this.recentContracts.set(next);
    await this.ipc.storeSet(`recentContracts:${chainId}`, next);
  }

  async fetchAbi(chainId: string, contract: string, refresh = false): Promise<LoadedAbi> {
    const account = contract.trim();
    if (!account) throw new Error('Enter a contract account');
    const key = abiCacheKey(chainId, account);

    if (!refresh) {
      const cached = await this.ipc.storeGet<{ abi: AbiDefinition; cachedAt: number }>(key);
      if (cached?.abi && isValidAbi(cached.abi)) {
        return { account, abi: cached.abi, source: 'cache', cachedAt: cached.cachedAt };
      }
    }

    try {
      const result = await this.ipc.getAbi(chainId, account);
      const abi = normalizeAbi(result?.abi ?? result);
      await this.ipc.storeSet(key, { abi, cachedAt: Date.now() });
      await this.rememberContract(chainId, account);
      return { account, abi, source: 'chain' };
    } catch (error) {
      const cached = await this.ipc.storeGet<{ abi: AbiDefinition; cachedAt: number }>(key);
      if (cached?.abi && isValidAbi(cached.abi)) {
        return { account, abi: cached.abi, source: 'cache', cachedAt: cached.cachedAt };
      }
      throw error;
    }
  }

  async importPastedAbi(chainId: string, contract: string, raw: string): Promise<LoadedAbi> {
    const account = contract.trim();
    const parsed = JSON.parse(raw);
    const abi = normalizeAbi(parsed?.abi ?? parsed);
    await this.ipc.storeSet(abiCacheKey(chainId, account), { abi, cachedAt: Date.now() });
    await this.rememberContract(chainId, account);
    return { account, abi, source: 'pasted' };
  }

  createActionDraft(abi: AbiDefinition, contract: string, action: AbiAction, actor: string): BuilderActionDraft {
    const model = createModelForAction(abi, action);
    return {
      id: `${contract}:${action.name}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      account: contract,
      name: action.name,
      authorization: [{ actor, permission: 'active' }],
      data: model,
      mode: 'guided',
      abiStructName: action.type,
      rawJson: JSON.stringify(model, null, 2),
    };
  }

  createFieldTree(abi: AbiDefinition, structName: string): AbiFormField[] {
    return createFieldsForStruct(abi, structName, []);
  }

  toTxAction(draft: BuilderActionDraft): TxAction {
    const data = draft.mode === 'raw' ? parseJsonObject(draft.rawJson) : normalizeActionData(draft.data);
    return {
      account: draft.account,
      name: draft.name,
      authorization: draft.authorization
        .filter(auth => auth.actor.trim() && auth.permission.trim())
        .map(auth => ({ actor: auth.actor.trim(), permission: auth.permission.trim() })),
      data,
    };
  }
}

export function normalizeAbi(input: any): AbiDefinition {
  const abi: AbiDefinition = {
    version: input?.version,
    types: Array.isArray(input?.types) ? input.types : [],
    structs: Array.isArray(input?.structs) ? input.structs : [],
    actions: Array.isArray(input?.actions) ? input.actions : [],
    variants: Array.isArray(input?.variants) ? input.variants : [],
  };

  if (!isValidAbi(abi)) {
    throw new Error('ABI must contain actions and structs arrays');
  }

  return abi;
}

export function isValidAbi(abi: any): abi is AbiDefinition {
  return !!abi && Array.isArray(abi.actions) && Array.isArray(abi.structs);
}

export function parseAbiType(abi: AbiDefinition, rawType: string): ParsedAbiType {
  const raw = rawType.trim();
  let type = raw;
  let isBinaryExtension = false;
  let isOptional = false;
  let isArray = false;

  if (type.endsWith('$')) {
    isBinaryExtension = true;
    type = type.slice(0, -1);
  }
  if (type.endsWith('?')) {
    isOptional = true;
    type = type.slice(0, -1);
  }
  if (type.endsWith('[]')) {
    isArray = true;
    type = type.slice(0, -2);
  }

  const resolvedType = resolveAlias(abi, type);
  const variant = abi.variants?.find(v => v.name === resolvedType);

  return { raw, baseType: type, resolvedType, isArray, isOptional, isBinaryExtension, variant };
}

export function resolveAlias(abi: AbiDefinition, type: string): string {
  const aliases = new Map((abi.types ?? []).map(alias => [alias.new_type_name, alias.type]));
  let current = type;
  const seen = new Set<string>();

  while (aliases.has(current) && !seen.has(current)) {
    seen.add(current);
    current = aliases.get(current)!;
  }

  return current;
}

export function createModelForAction(abi: AbiDefinition, action: AbiAction): Record<string, any> {
  return createModelForStruct(abi, action.type);
}

export function createModelForStruct(abi: AbiDefinition, structName: string): Record<string, any> {
  const struct = findStruct(abi, structName);
  if (!struct) return {};

  const model = struct.base ? createModelForStruct(abi, struct.base) : {};
  for (const field of struct.fields ?? []) {
    model[field.name] = initialValueForType(abi, field.type);
  }
  return model;
}

export function initialValueForType(abi: AbiDefinition, type: string): any {
  const parsed = parseAbiType(abi, type);

  if (parsed.isArray) return [];
  if (parsed.isOptional || parsed.isBinaryExtension) return null;
  if (parsed.variant) return {};

  if (parsed.resolvedType === 'bool') return false;
  if (INTEGER_TYPES.has(parsed.resolvedType) || FLOAT_TYPES.has(parsed.resolvedType)) return 0;
  if (BIG_INTEGER_TYPES.has(parsed.resolvedType)) return '';
  if (findStruct(abi, parsed.resolvedType)) return createModelForStruct(abi, parsed.resolvedType);
  return '';
}

export function createFieldsForStruct(abi: AbiDefinition, structName: string, pathPrefix: string[]): AbiFormField[] {
  const struct = findStruct(abi, structName);
  if (!struct) return [];

  const inherited = struct.base ? createFieldsForStruct(abi, struct.base, pathPrefix) : [];
  const own = (struct.fields ?? []).map(field => createFieldDescriptor(abi, field, pathPrefix));
  return [...inherited, ...own];
}

export function createFieldDescriptor(abi: AbiDefinition, field: AbiField, pathPrefix: string[]): AbiFormField {
  const parsed = parseAbiType(abi, field.type);
  const path = [...pathPrefix, field.name];
  const nestedStruct = findStruct(abi, parsed.resolvedType);
  const kind = fieldKind(parsed, nestedStruct);

  return {
    id: path.join('.'),
    name: field.name,
    label: labelForField(field.name),
    path,
    type: field.type,
    resolvedType: parsed.resolvedType,
    kind,
    optional: parsed.isOptional,
    binaryExtension: parsed.isBinaryExtension,
    placeholder: placeholderForType(parsed.resolvedType, kind),
    children: kind === 'object' && nestedStruct ? createFieldsForStruct(abi, parsed.resolvedType, path) : [],
    itemType: parsed.isArray ? parsed.resolvedType : undefined,
    variantTypes: parsed.variant?.types,
  };
}

export function normalizeActionData(value: Record<string, any>): Record<string, any> {
  return JSON.parse(JSON.stringify(value, (_key, nested) => nested === undefined ? null : nested));
}

export function parseJsonObject(raw: string): Record<string, any> {
  const parsed = JSON.parse(raw || '{}');
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Action data JSON must be an object');
  }
  return parsed;
}

function fieldKind(parsed: ParsedAbiType, nestedStruct?: AbiStruct): AbiFieldKind {
  if (parsed.isArray) return 'array';
  if (parsed.variant) return 'variant';
  if (nestedStruct) return 'object';
  if (parsed.resolvedType === 'bool') return 'boolean';
  if (INTEGER_TYPES.has(parsed.resolvedType) || FLOAT_TYPES.has(parsed.resolvedType)) return 'number';
  if (ASSET_TYPES.has(parsed.resolvedType)) return 'asset';
  if (NAME_TYPES.has(parsed.resolvedType)) return 'name';
  if (PUBLIC_KEY_TYPES.has(parsed.resolvedType)) return 'publicKey';
  if (CHECKSUM_TYPES.has(parsed.resolvedType)) return 'checksum';
  if (BYTES_TYPES.has(parsed.resolvedType)) return 'bytes';
  return 'text';
}

function placeholderForType(type: string, kind: AbiFieldKind): string {
  switch (kind) {
    case 'asset': return type === 'symbol' ? '4,EOS' : '0.0000 EOS';
    case 'name': return 'accountname';
    case 'publicKey': return 'EOS... or PUB_K1_...';
    case 'checksum': return '64 character hex';
    case 'bytes': return 'hex or base64 bytes';
    case 'number': return '0';
    case 'array': return '[]';
    case 'variant': return '{}';
    default: return type;
  }
}

function labelForField(name: string): string {
  return name.replace(/_/g, ' ');
}

function findStruct(abi: AbiDefinition, name: string): AbiStruct | undefined {
  return abi.structs.find(struct => struct.name === name);
}

function abiCacheKey(chainId: string, contract: string): string {
  return `contractAbi:${chainId}:${contract}`;
}
