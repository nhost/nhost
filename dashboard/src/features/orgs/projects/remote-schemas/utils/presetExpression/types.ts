import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';

export interface NullExpression {
  kind: 'null';
}

export interface BooleanExpression {
  kind: 'boolean';
  value: boolean;
}

export interface NumberExpression {
  kind: 'number';
  value: number;
}

export interface EnumExpression {
  kind: 'enum';
  value: string;
}

export interface SessionVariableExpression {
  kind: 'sessionVariable';
  key: string;
}

export interface StringExpression {
  kind: 'string';
  value: string;
}

export interface ListExpression {
  kind: 'list';
  items: PresetExpression[];
}

export interface ObjectExpression {
  kind: 'object';
  entries: ArgTreeType;
}

export type PresetExpression =
  | NullExpression
  | BooleanExpression
  | NumberExpression
  | EnumExpression
  | SessionVariableExpression
  | StringExpression
  | ListExpression
  | ObjectExpression;

export function isNullExpression(
  expr: PresetExpression,
): expr is NullExpression {
  return expr.kind === 'null';
}

export function isBooleanExpression(
  expr: PresetExpression,
): expr is BooleanExpression {
  return expr.kind === 'boolean';
}

export function isNumberExpression(
  expr: PresetExpression,
): expr is NumberExpression {
  return expr.kind === 'number';
}

export function isEnumExpression(
  expr: PresetExpression,
): expr is EnumExpression {
  return expr.kind === 'enum';
}

export function isSessionVariableExpression(
  expr: PresetExpression,
): expr is SessionVariableExpression {
  return expr.kind === 'sessionVariable';
}

export function isStringExpression(
  expr: PresetExpression,
): expr is StringExpression {
  return expr.kind === 'string';
}

export function isListExpression(
  expr: PresetExpression,
): expr is ListExpression {
  return expr.kind === 'list';
}

export function isObjectExpression(
  expr: PresetExpression,
): expr is ObjectExpression {
  return expr.kind === 'object';
}
