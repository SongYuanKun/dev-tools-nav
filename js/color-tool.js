(function () {
  "use strict";

  var syncing = false;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function padHex(n) {
    return clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  }

  // HEX → RGB
  function parseHex(raw) {
    var s = String(raw || "").trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(s)) {
      s = s.split("").map(function (c) { return c + c; }).join("");
    }
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }

  function rgbToHex(rgb) {
    return "#" + padHex(rgb.r) + padHex(rgb.g) + padHex(rgb.b);
  }

  // RGB → HSL
  function rgbToHsl(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  // HSL → RGB
  function hslToRgb(hsl) {
    var h = ((hsl.h % 360) + 360) % 360 / 360;
    var s = clamp(hsl.s, 0, 100) / 100;
    var l = clamp(hsl.l, 0, 100) / 100;
    if (s === 0) {
      var v = Math.round(l * 255);
      return { r: v, g: v, b: v };
    }
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    return {
      r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      g: Math.round(hue2rgb(p, q, h) * 255),
      b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
  }

  // RGB → HWB（CSS 色彩空间）
  function rgbToHwb(rgb) {
    var r = rgb.r / 255;
    var g = rgb.g / 255;
    var b = rgb.b / 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var w = min * 100;
    var bl = (1 - max) * 100;
    var h = 0;
    if (max !== min) {
      if (max === r) h = ((g - b) / (max - min)) * 60;
      else if (max === g) h = ((b - r) / (max - min) + 2) * 60;
      else h = ((r - g) / (max - min) + 4) * 60;
      if (h < 0) h += 360;
    }
    return { h: Math.round(h), w: Math.round(w), b: Math.round(bl) };
  }

  // HWB → RGB
  function hwbToRgb(hwb) {
    var h = ((hwb.h % 360) + 360) % 360;
    var w = clamp(hwb.w, 0, 100) / 100;
    var bl = clamp(hwb.b, 0, 100) / 100;
    if (w + bl >= 1) {
      var gray = Math.round(w / (w + bl) * 255);
      return { r: gray, g: gray, b: gray };
    }
    var rgb = hslToRgb({ h: h, s: 100, l: 50 });
    for (var i = 0; i < 3; i++) {
      var key = i === 0 ? "r" : i === 1 ? "g" : "b";
      rgb[key] = Math.round(rgb[key] * (1 - w - bl) + 255 * w);
    }
    return rgb;
  }

  function parseRgb(str) {
    var m = String(str || "").trim().match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3] };
  }

  function parseHsl(str) {
    var m = String(str || "").trim().match(/^hsl\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/i);
    if (!m) return null;
    return { h: +m[1], s: +m[2], l: +m[3] };
  }

  function parseHwb(str) {
    var m = String(str || "").trim().match(/^hwb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/i);
    if (!m) return null;
    return { h: +m[1], w: +m[2], b: +m[3] };
  }

  // sRGB 相对亮度（WCAG）
  function relLuminance(rgb) {
    function lin(c) {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  }

  function contrastRatio(fg, bg) {
    var l1 = relLuminance(fg);
    var l2 = relLuminance(bg);
    var lighter = Math.max(l1, l2);
    var darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function wcagLevel(ratio, large) {
    if (ratio >= 7) return "AAA";
    if (ratio >= 4.5 && !large) return "AA";
    if (ratio >= 3 && large) return "AA（大字）";
    if (ratio >= 3) return "AA Large";
    return "未达标";
  }

  function setPreview(rgb) {
    var preview = document.getElementById("colorPreview");
    if (preview) preview.style.background = rgbToHex(rgb);
  }

  function syncFromRgb(rgb) {
    syncing = true;
    var hexEl = document.getElementById("hexInput");
    var rgbEl = document.getElementById("rgbInput");
    var hslEl = document.getElementById("hslInput");
    var hwbEl = document.getElementById("hwbInput");
    var hsl = rgbToHsl(rgb);
    var hwb = rgbToHwb(rgb);
    if (hexEl) hexEl.value = rgbToHex(rgb);
    if (rgbEl) rgbEl.value = "rgb(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ")";
    if (hslEl) hslEl.value = "hsl(" + hsl.h + ", " + hsl.s + "%, " + hsl.l + "%)";
    if (hwbEl) hwbEl.value = "hwb(" + hwb.h + " " + hwb.w + "% " + hwb.b + "%)";
    setPreview(rgb);
    syncing = false;
    updateContrast();
  }

  function updateContrast() {
    var fgEl = document.getElementById("fgColor");
    var bgEl = document.getElementById("bgColor");
    var out = document.getElementById("contrastResult");
    if (!out) return;

    var fg = fgEl ? parseHex(fgEl.value) : null;
    var bg = bgEl ? parseHex(bgEl.value) : null;
    if (!fg || !bg) {
      out.textContent = "请输入有效的前景色与背景色 HEX 值。";
      return;
    }

    var ratio = contrastRatio(fg, bg);
    var rounded = Math.round(ratio * 100) / 100;
    out.innerHTML =
      "对比度 <strong>" + rounded + ":1</strong> · " +
      "正文 " + wcagLevel(ratio, false) + " · " +
      "大字 " + wcagLevel(ratio, true);

    if (fgEl) fgEl.style.background = rgbToHex(fg);
    if (bgEl) bgEl.style.background = rgbToHex(bg);
  }

  function bindInput(id, parser) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", function () {
      if (syncing) return;
      var rgb = parser(el.value);
      if (rgb) syncFromRgb(rgb);
    });
  }

  function init() {
    var hexEl = document.getElementById("hexInput");
    if (!hexEl) return;

    bindInput("hexInput", parseHex);
    bindInput("rgbInput", parseRgb);
    bindInput("hslInput", function (v) { return hslToRgb(parseHsl(v) || { h: 0, s: 0, l: 0 }); });
    bindInput("hwbInput", function (v) { return hwbToRgb(parseHwb(v) || { h: 0, w: 0, b: 0 }); });

    var fgEl = document.getElementById("fgColor");
    var bgEl = document.getElementById("bgColor");
    if (fgEl) fgEl.addEventListener("input", updateContrast);
    if (bgEl) bgEl.addEventListener("input", updateContrast);

    var btnCopy = document.getElementById("btnCopyCssVar");
    if (btnCopy) {
      btnCopy.addEventListener("click", function () {
        var rgb = parseHex(hexEl.value);
        if (!rgb) {
          if (ToolChrome && ToolChrome.showToast) ToolChrome.showToast("请先输入有效颜色");
          return;
        }
        var nameEl = document.getElementById("cssVarName");
        var varName = nameEl && nameEl.value.trim() ? nameEl.value.trim() : "--brand-color";
        if (!varName.startsWith("--")) varName = "--" + varName;
        var text = varName + ": " + rgbToHex(rgb) + ";";
        var copyFn = ToolChrome && ToolChrome.copyText ? ToolChrome.copyText : function (t) {
          return navigator.clipboard.writeText(t);
        };
        copyFn(text, "CSS 变量已复制").catch(function () {
          if (ToolChrome && ToolChrome.showToast) ToolChrome.showToast("复制失败");
        });
      });
    }

    var picker = document.getElementById("colorPicker");
    if (picker) {
      picker.addEventListener("input", function () {
        var rgb = parseHex(picker.value);
        if (rgb) syncFromRgb(rgb);
      });
    }

    var initial = parseHex(hexEl.value) || { r: 99, g: 102, b: 241 };
    syncFromRgb(initial);
  }

  var ready = window.ToolChrome && ToolChrome.ready ? ToolChrome.ready : function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };
  ready(init);
})();
