import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';

interface NullExpression {
  kind: 'null';
}

interface BooleanExpression {
  kind: 'boolean';
  value: boolean;
}

interface NumberExpression {
  kind: 'number';
  value: number;
}

interface EnumExpression {
  kind: 'enum';
  value: string;
}

interface SessionVariableExpression {
  kind: 'sessionVariable';
  key: string;
}

interface StringExpression {
  kind: 'string';
  value: string;
}

interface ListExpression {
  kind: 'list';
  items: PresetExpression[];
}

interface ObjectExpression {
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
