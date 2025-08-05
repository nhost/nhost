import type { FormatParamArgs } from '../types';
import checkIsEnum from './checkIsEnum';
import serialiseArgs from './serialiseArgs';

export default function formatArg({
  argName,
  arg,
}: FormatParamArgs): string | undefined {
  const isEnum = checkIsEnum(argName, arg.type);

  if (typeof argName === 'object') {
    if (Array.isArray(argName)) {
      const argList = argName.map((argListItem) =>
        formatArg({ arg, argName: argListItem }),
      );

      return `[${argList.join(',')}]`;
    }
    return serialiseArgs(argName, arg);
  }

  if (typeof argName === 'number' || isEnum) {
    return `${argName}`;
  }

  return `"${argName}"`;
}
