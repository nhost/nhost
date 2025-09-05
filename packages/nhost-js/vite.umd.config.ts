import { resolve } from "node:path";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "NhostJs",
      formats: ["umd"],
      fileName: () => "nhost-js.umd.js",
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    target: ["es2022"],
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: true,
    minify: "terser",
    cssCodeSplit: true,
  },
  plugins: [
    peerDepsExternal(),
    nodeResolve({
      browser: true,
      preferBuiltins: true,
    }),
  ],
});
