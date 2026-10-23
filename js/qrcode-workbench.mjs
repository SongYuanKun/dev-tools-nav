/**
 * 二维码工具页入口（由 Rollup 打包为 qrcode-tool.bundle.js）
 */
import { encodeQrSvg, QR_LEVELS } from "./qrcode-core.mjs";

function ready(fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
}

ready(function init() {
  const input = document.getElementById("qrInput");
  const levelEl = document.getElementById("qrLevel");
  const preview = document.getElementById("qrPreview");
  const status = document.getElementById("qrStatus");
  const btnGenerate = document.getElementById("btnQrGenerate");
  const btnDownload = document.getElementById("btnQrDownload");
  const btnCopy = document.getElementById("btnQrCopySvg");
  if (!input || !preview) return;

  let lastSvg = "";

  function setStatus(msg, isError) {
    if (!status) return;
    status.textContent = msg || "";
    status.classList.toggle("is-error", !!isError);
  }

  async function generate() {
    const text = input.value;
    const level = levelEl ? levelEl.value : "M";
    try {
      lastSvg = await encodeQrSvg(text, { level, width: 280, margin: 2 });
      preview.innerHTML = lastSvg;
      const svg = preview.querySelector("svg");
      if (svg) {
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "二维码预览");
      }
      setStatus("已生成（纠错 " + level + "）· " + new TextEncoder().encode(text).length + " 字节");
      window.umamiTrack?.("tool_used", { tool: "qrcode", action: "generate", level });
    } catch (err) {
      lastSvg = "";
      preview.innerHTML = "";
      setStatus(err && err.message ? err.message : "生成失败", true);
    }
  }

  if (btnGenerate) btnGenerate.addEventListener("click", generate);
  input.addEventListener("input", function () {
    clearTimeout(input._qrTimer);
    input._qrTimer = setTimeout(generate, 280);
  });
  if (levelEl) levelEl.addEventListener("change", generate);

  if (btnDownload) {
    btnDownload.addEventListener("click", function () {
      if (!lastSvg) {
        window.ToolChrome?.showToast?.("请先生成二维码");
        return;
      }
      const blob = new Blob([lastSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qrcode.svg";
      a.click();
      URL.revokeObjectURL(url);
      window.ToolChrome?.showToast?.("已下载 SVG");
    });
  }

  if (btnCopy) {
    btnCopy.addEventListener("click", function () {
      if (!lastSvg) {
        window.ToolChrome?.showToast?.("请先生成二维码");
        return;
      }
      const copyFn = window.ToolChrome?.copyText
        ? (t) => window.ToolChrome.copyText(t, "已复制 SVG")
        : (t) => navigator.clipboard.writeText(t);
      copyFn(lastSvg).catch(function () {
        window.ToolChrome?.showToast?.("复制失败");
      });
    });
  }

  if (levelEl && !levelEl.options.length) {
    QR_LEVELS.forEach(function (lv) {
      const opt = document.createElement("option");
      opt.value = lv;
      opt.textContent = lv;
      if (lv === "M") opt.selected = true;
      levelEl.appendChild(opt);
    });
  }

  if (input.value.trim()) generate();
  else {
    input.value = "https://tools.songyuankun.top/";
    generate();
  }
});
