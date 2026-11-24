// expect: no-direct-radix-imports "'@radix-ui/react-label'"
import "@radix-ui/react-label";
// expect: no-direct-radix-imports "'@radix-ui/react-dialog'"
export * from "@radix-ui/react-dialog";
// expect: no-direct-radix-imports "'@radix-ui/react-tooltip'"
export const load = () => import("@radix-ui/react-tooltip");
