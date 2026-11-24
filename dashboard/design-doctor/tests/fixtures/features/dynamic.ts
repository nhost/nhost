const moduleName = '@radix-ui/react-dialog';
const unrelated = '@radix-ui/react-dialog';

// expect: no-direct-radix-imports "'@radix-ui/react-select'"
export const literal = () => import('@radix-ui/react-select');
export const slot = () => import('@radix-ui/react-slot');
export const variable = () => import(moduleName);
export const template = () => import(`@radix-ui/react-dialog`);
export const interpolated = (name: string) => import(`@radix-ui/react-${name}`);
void unrelated;
