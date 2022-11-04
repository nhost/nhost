const _console = { ...console }

type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type ConsoleLevel = LogLevel | 'log'

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const CONSOLE_LEVELS: ConsoleLevel[] = ['debug', 'log', 'info', 'warn', 'error']

const getLogLevel = (level: ConsoleLevel): LogLevel => (level === 'log' ? 'info' : level)

const GLOBAL_LOG_LEVEL =
  (process.env.FUNCTIONS_LOG_LEVEL &&
    LOG_LEVELS.find((l) => l === process.env.FUNCTIONS_LOG_LEVEL) &&
    process.env.FUNCTIONS_LOG_LEVEL) ||
  'debug'

const shouldLog = (level: ConsoleLevel) => {
  const logLevel = getLogLevel(level)
  const globalLogLevelIndex = LOG_LEVELS.findIndex((l) => l === GLOBAL_LOG_LEVEL)
  const logLevelIndex = LOG_LEVELS.findIndex((l) => l === logLevel)
  return logLevelIndex >= globalLogLevelIndex
}

const jsonOutput =
  (level: ConsoleLevel) =>
  (...args: any[]) =>
    shouldLog(level) &&
    _console[level](
      JSON.stringify({
        level: getLogLevel(level),
        message: args?.length === 1 && typeof args[0] === 'object' ? args[0] : args?.join(' ')
      })
    )

const plainOutput =
  (level: ConsoleLevel) =>
  (...args: any[]) =>
    shouldLog(level) && _console[level](...args)

export const setLoggerType = (loggerType: string = 'json') => {
  if (loggerType === 'plain') {
    for (const level of CONSOLE_LEVELS as LogLevel[]) {
      console[level] = plainOutput(level)
    }
  } else {
    for (const level of CONSOLE_LEVELS as LogLevel[]) {
      console[level] = jsonOutput(level)
    }
  }
}
