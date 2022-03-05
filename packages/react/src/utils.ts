export const suppressConsoleMessage = (message, method) => {
  const nativeConsoleMethod = console[method]
  console[method] = (nativeMessage) => {
    if (!RegExp(message, 'gi').test(nativeMessage)) {
      nativeConsoleMethod(nativeMessage)
    }
  }
}
