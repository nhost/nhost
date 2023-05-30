/**
 * Calls all the functions in the array with the given arguments.
 */
export default function callAll(...fns: ((...args: any[]) => any)[]) {
  return (...args: any[]) => {
    fns.forEach((fn) => fn?.(...args));
  };
}
