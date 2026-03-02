import type { FunctionParameter } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery/fetchFunctionDefinition';

function formatParameterType(param: FunctionParameter): string {
  return param.schema ? `"${param.schema}"."${param.type}"` : `"${param.type}"`;
}

export default function buildFunctionSignature(
  schema: string,
  name: string,
  inputArgTypes: FunctionParameter[],
): string {
  const parameterTypes = inputArgTypes.map(formatParameterType).join(', ');
  return parameterTypes
    ? `"${schema}"."${name}"(${parameterTypes})`
    : `"${schema}"."${name}"`;
}
