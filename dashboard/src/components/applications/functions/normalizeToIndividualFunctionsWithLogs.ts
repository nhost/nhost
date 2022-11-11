import { format, parseISO } from 'date-fns';
import type { FunctionLog } from './FunctionLog';
import type { FunctionResponseLog } from './FunctionResponseLog';

export const normalizeToIndividualFunctionsWithLogs = (
  functionLogs: FunctionResponseLog[],
) => {
  const arrayOfFunctions: FunctionLog[] = [];
  const sortedFunctions = [...functionLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  sortedFunctions.forEach((functionLog) => {
    const funcName = functionLog.functionPath;
    const logMessage = {
      createdAt: functionLog.createdAt,
      date: `${format(parseISO(functionLog.createdAt), 'yyyy-MM-dd HH:mm:ss')}`,
      message: functionLog.message,
    };
    const newFunc = {
      name: funcName,
      language: functionLog.functionPath.split('.')[1],
      logs: [logMessage],
    };
    // If the function is already in the array of functions to log, just add the new log message to the existing object...
    if (arrayOfFunctions.some((obj) => obj.name === funcName)) {
      const index = arrayOfFunctions.findIndex((obj) => obj.name === funcName);
      const currentFunction = arrayOfFunctions[index];
      currentFunction.logs.push(logMessage);
    } else {
      // If the function is not in the array of functions, add it with the log message to it.
      arrayOfFunctions.push(newFunc);
    }
  });

  return arrayOfFunctions;
};

export default normalizeToIndividualFunctionsWithLogs;
