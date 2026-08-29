# 第三方开源组件声明 / Third-Party Notices

本项目（Koen's 工具箱 / dev-tools-nav）以 [MIT 协议](LICENSE) 发布。

除项目自身代码外，构建产物 `js/json-workbench.bundle.js` 中打包（redistribute）了下列第三方开源组件。MIT 与 ISC 许可证都要求在分发副本时保留原始版权声明与许可正文，因此本文件列出全部组件及其版权归属，同一份声明也会以 `/*! ... */` 注释形式内嵌在打包产物开头（见 `scripts/bundle-license-banner.mjs`）。

This project is released under the [MIT License](LICENSE). The generated bundle `js/json-workbench.bundle.js` redistributes the third-party components listed below; their copyright notices and license texts are reproduced here and are also embedded in the bundle itself.

## 组件清单 / Bundled components

| 组件 | 许可证 | 版权声明 |
|------|--------|----------|
| [`@codemirror/autocomplete`](https://github.com/codemirror/autocomplete) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@codemirror/commands`](https://github.com/codemirror/commands) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@codemirror/lang-json`](https://github.com/codemirror/lang-json) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@codemirror/language`](https://github.com/codemirror/language) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@codemirror/lint`](https://github.com/codemirror/lint) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@codemirror/merge`](https://github.com/codemirror/merge) | MIT | Copyright (C) 2018-2022 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@codemirror/search`](https://github.com/codemirror/search) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@codemirror/state`](https://github.com/codemirror/state) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@codemirror/view`](https://github.com/codemirror/view) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@lezer/common`](https://github.com/lezer-parser/common) | MIT | Copyright (C) 2018 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@lezer/highlight`](https://github.com/lezer-parser/highlight) | MIT | Copyright (C) 2018 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@lezer/json`](https://github.com/lezer-parser/json) | MIT | Copyright (C) 2020 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt;, Arun Srinivasan &lt;rulfzid@gmail.com&gt;, and others |
| [`@lezer/lr`](https://github.com/lezer-parser/lr) | MIT | Copyright (C) 2018 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`@marijn/find-cluster-break`](https://github.com/marijnh/find-cluster-break) | MIT | Copyright (C) 2024 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; |
| [`codemirror`](https://github.com/codemirror/basic-setup) | MIT | Copyright (C) 2018-2021 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`crelt`](https://github.com/marijnh/crelt) | MIT | Copyright (C) 2020 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; |
| [`style-mod`](https://github.com/marijnh/style-mod) | MIT | Copyright (C) 2018 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`w3c-keyname`](https://github.com/marijnh/w3c-keyname) | MIT | Copyright (C) 2016 by Marijn Haverbeke &lt;marijn@haverbeke.berlin&gt; and others |
| [`yaml`](https://github.com/eemeli/yaml) | ISC | Copyright Eemeli Aro &lt;eemeli@gmail.com&gt; |

仅用于本地开发、不进入任何分发产物的构建依赖（`rollup`、`@rollup/plugin-node-resolve`、`@rollup/plugin-terser`、`playwright`）不在上表内，因为它们不会被再分发。

## MIT License 全文

适用于上表中所有标注 MIT 的组件，版权声明见上表对应行。

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## ISC License 全文

适用于上表中标注 ISC 的组件（`yaml`）。

```
Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

## 维护约定

- 新增或移除会进入 `js/json-workbench.bundle.js` 的运行时依赖时，必须同步更新本文件与 `scripts/bundle-license-banner.mjs`。
- `scripts/json-build.test.mjs` 会校验两者与 `package.json` 依赖、`node_modules` 中的实际许可证保持一致，并校验打包产物开头确实带有署名 banner。
- 修改后需执行 `npm run build` 重新生成产物并提交，否则 `npm run check:generated` 会报漂移。
