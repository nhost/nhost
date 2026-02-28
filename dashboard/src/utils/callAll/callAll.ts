/**
 * Calls all the functions in the array with the given arguments.
 */
const callAll =
  <Args extends readonly unknown[]>(
    ...fns: readonly (((...args: Args) => void) | undefined)[]
  ) =>
  (...args: Args): void =>
    fns.forEach((fn) => {
      fn?.(...args);
    });

export default callAll;
