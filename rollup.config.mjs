import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import {
  buildLicenseBanner,
  QRCODE_BUNDLED_PACKAGES,
} from "./scripts/bundle-license-banner.mjs";

const sharedPlugins = [
  nodeResolve({ browser: true }),
  commonjs(),
  terser({
    // 只保留 /*! */ 形式的署名 banner，其余注释仍然全部剥离。
    format: { comments: /^!/ },
    module: true,
  }),
];

export default [
  {
    input: "js/json-workbench.mjs",
    output: {
      file: "js/json-workbench.bundle.js",
      format: "es",
      sourcemap: false,
      generatedCode: "es2015",
      banner: buildLicenseBanner(),
    },
    plugins: sharedPlugins,
  },
  {
    input: "js/qrcode-workbench.mjs",
    output: {
      file: "js/qrcode-tool.bundle.js",
      format: "iife",
      name: "QrcodeTool",
      sourcemap: false,
      generatedCode: "es2015",
      banner: buildLicenseBanner({
        title: "二维码工具构建产物",
        packages: QRCODE_BUNDLED_PACKAGES,
      }),
    },
    plugins: sharedPlugins,
  },
];
