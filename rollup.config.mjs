import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "js/json-workbench.mjs",
  output: {
    file: "js/json-workbench.bundle.js",
    format: "es",
    sourcemap: false,
    generatedCode: "es2015",
  },
  plugins: [
    nodeResolve({ browser: true }),
    terser({
      format: { comments: false },
      module: true,
    }),
  ],
};
