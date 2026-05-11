import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInputObjectType,
  type GraphQLInputType,
  GraphQLInt,
  GraphQLList,
} from 'graphql';
import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';
import { isSessionVariable } from '@/features/orgs/projects/remote-schemas/utils/constants';
import unwrapNamedType from '@/features/orgs/projects/remote-schemas/utils/unwrapNamedType';
import { isJSONString } from '@/lib/utils';
import type { PresetExpression } from './types';

function tryParseJSONArray(value: string): unknown[] | null {
  if (!isJSONString(value)) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function tryParseJSONObject(value: string): Record<string, unknown> | null {
  if (!isJSONString(value)) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function parsePresetValue(
  rawValue: unknown,
  argType: GraphQLInputType,
): PresetExpression {
  if (rawValue === null) {
    return { kind: 'null' };
  }

  if (Array.isArray(rawValue)) {
    return {
      kind: 'list',
      items: rawValue.map((item) => parsePresetValue(item, argType)),
    };
  }

  if (typeof rawValue === 'object') {
    return { kind: 'object', entries: rawValue as ArgTreeType };
  }

  if (typeof rawValue === 'string' && isSessionVariable(rawValue)) {
    return { kind: 'sessionVariable', key: rawValue };
  }

  if (typeof rawValue === 'string' && argType instanceof GraphQLList) {
    const items = tryParseJSONArray(rawValue);
    if (items) {
      const inner = argType.ofType as GraphQLInputType;
      return {
        kind: 'list',
        items: items.map((item) => parsePresetValue(item, inner)),
      };
    }
  }

  const baseType = unwrapNamedType(argType);

  if (
    typeof rawValue === 'string' &&
    baseType instanceof GraphQLInputObjectType
  ) {
    const entries = tryParseJSONObject(rawValue);
    if (entries) {
      return { kind: 'object', entries: entries as ArgTreeType };
    }
  }

  if (baseType === GraphQLBoolean) {
    if (typeof rawValue === 'boolean') {
      return { kind: 'boolean', value: rawValue };
    }
    if (rawValue === 'true' || rawValue === 'false') {
      return { kind: 'boolean', value: rawValue === 'true' };
    }
  }

  if (baseType === GraphQLInt || baseType === GraphQLFloat) {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return { kind: 'number', value: rawValue };
    }
    if (typeof rawValue === 'string' && rawValue.trim() !== '') {
      const n = Number(rawValue);
      const isValid =
        baseType === GraphQLInt ? Number.isInteger(n) : Number.isFinite(n);
      if (isValid) {
        return { kind: 'number', value: n };
      }
    }
  }

  if (baseType instanceof GraphQLEnumType && typeof rawValue === 'string') {
    return { kind: 'enum', value: rawValue };
  }

  return { kind: 'string', value: String(rawValue) };
}
