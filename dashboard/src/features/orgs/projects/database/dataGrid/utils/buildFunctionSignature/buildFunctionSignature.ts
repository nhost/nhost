import { format } from 'node-pg-format';
import type { FunctionParameter } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery/fetchFunctionDefinition';

function formatParameterType(param: FunctionParameter): string {
  return param.schema
    ? format('%I.%I', param.schema, param.type)
    : format('%I', param.type);
}

export default function buildFunctionSignature(
  schema: string,
  name: string,
  inputArgTypes: FunctionParameter[],
): string {
  const qualifiedName = format('%I.%I', schema, name);
  const parameterTypes = inputArgTypes.map(formatParameterType).join(', ');
  return parameterTypes ? `${qualifiedName}(${parameterTypes})` : qualifiedName;
}
