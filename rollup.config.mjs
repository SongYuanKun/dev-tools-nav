import { nodeResolve } from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { buildLicenseBanner } from "./scripts/bundle-license-banner.mjs";

export default {
  input: "js/json-workbench.mjs",
  output: {
    file: "js/json-workbench.bundle.js",
    format: "es",
    sourcemap: false,
    generatedCode: "es2015",
    banner: buildLicenseBanner(),
  },
  plugins: [
    nodeResolve({ browser: true }),
    terser({
      // 只保留 /*! */ 形式的署名 banner，其余注释仍然全部剥离。
      format: { comments: /^!/ },
      module: true,
    }),
  ],
};
