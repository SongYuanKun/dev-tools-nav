// 打包产物内嵌的第三方署名。MIT/ISC 均要求分发副本时附带版权声明与许可正文，
// 而上游 dist 文件本身不带 @license 注释，所以只能在 Rollup 输出阶段注入。

export const BUNDLED_PACKAGES = [
  {
    name: "@codemirror/autocomplete",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@codemirror/commands",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@codemirror/lang-json",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@codemirror/language",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@codemirror/lint",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@codemirror/merge",
    license: "MIT",
    copyright: "Copyright (C) 2018-2022 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@codemirror/search",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@codemirror/state",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@codemirror/view",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@lezer/common",
    license: "MIT",
    copyright: "Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@lezer/highlight",
    license: "MIT",
    copyright: "Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@lezer/json",
    license: "MIT",
    copyright:
      "Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin>, Arun Srinivasan <rulfzid@gmail.com>, and others",
  },
  {
    name: "@lezer/lr",
    license: "MIT",
    copyright: "Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "@marijn/find-cluster-break",
    license: "MIT",
    copyright: "Copyright (C) 2024 by Marijn Haverbeke <marijn@haverbeke.berlin>",
  },
  {
    name: "codemirror",
    license: "MIT",
    copyright: "Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "crelt",
    license: "MIT",
    copyright: "Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin>",
  },
  {
    name: "style-mod",
    license: "MIT",
    copyright: "Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "w3c-keyname",
    license: "MIT",
    copyright: "Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> and others",
  },
  {
    name: "yaml",
    license: "ISC",
    copyright: "Copyright Eemeli Aro <eemeli@gmail.com>",
  },
];

export const MIT_LICENSE_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy
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
THE SOFTWARE.`;

export const ISC_LICENSE_TEXT = `Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.`;

function uniqueCopyrights(license) {
  const lines = BUNDLED_PACKAGES.filter((pkg) => pkg.license === license).map((pkg) => pkg.copyright);
  return [...new Set(lines)];
}

export function buildLicenseBanner() {
  const mitPackages = BUNDLED_PACKAGES.filter((pkg) => pkg.license === "MIT").map((pkg) => pkg.name);
  const iscPackages = BUNDLED_PACKAGES.filter((pkg) => pkg.license === "ISC").map((pkg) => pkg.name);

  const sections = [
    "Koen's 工具箱 (dev-tools-nav) — JSON 工作台构建产物",
    "Copyright (c) 2026 SongYuanKun — MIT License, see LICENSE",
    "",
    "本文件由 Rollup 打包，内含以下第三方开源组件。完整清单见 THIRD-PARTY-NOTICES.md。",
    "This bundle contains third-party open source software listed below.",
    "",
    `=== MIT License — ${mitPackages.join(", ")} ===`,
    "",
    ...uniqueCopyrights("MIT"),
    "",
    MIT_LICENSE_TEXT,
    "",
    `=== ISC License — ${iscPackages.join(", ")} ===`,
    "",
    ...uniqueCopyrights("ISC"),
    "",
    ISC_LICENSE_TEXT,
  ];

  return `/*!\n${sections.map((line) => (line ? ` * ${line}` : " *")).join("\n")}\n */`;
}
