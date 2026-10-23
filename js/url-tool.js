(function () {
  "use strict";

  function encodeComponent(text) {
    return encodeURIComponent(String(text ?? ""));
  }

  function decodeComponent(text) {
    var raw = String(text ?? "");
    try {
      return decodeURIComponent(raw.replace(/\+/g, "%20"));
    } catch (_) {
      throw new Error("无法解码：包含非法百分号编码");
    }
  }

  function encodeUri(text) {
    return encodeURI(String(text ?? ""));
  }

  function decodeUri(text) {
    var raw = String(text ?? "");
    try {
      return decodeURI(raw);
    } catch (_) {
      throw new Error("无法解码：包含非法百分号编码");
    }
  }

  function encodeForm(text) {
    return encodeURIComponent(String(text ?? "")).replace(/%20/g, "+");
  }

  function decodeForm(text) {
    return decodeComponent(String(text ?? "").replace(/\+/g, "%20"));
  }

  function apply(mode, text) {
    switch (mode) {
      case "encode-component": return encodeComponent(text);
      case "decode-component": return decodeComponent(text);
      case "encode-uri": return encodeUri(text);
      case "decode-uri": return decodeUri(text);
      case "encode-form": return encodeForm(text);
      case "decode-form": return decodeForm(text);
      default: throw new Error("未知模式");
    }
  }

  function init() {
    var input = document.getElementById("urlInput");
    var output = document.getElementById("urlOutput");
    var modeEl = document.getElementById("urlMode");
    var status = document.getElementById("urlStatus");
    var btnRun = document.getElementById("btnUrlRun");
    var btnSwap = document.getElementById("btnUrlSwap");
    var btnCopy = document.getElementById("btnUrlCopy");
    if (!input || !output || !modeEl) return;

    function setStatus(msg, isError) {
      if (!status) return;
      status.textContent = msg || "";
      status.classList.toggle("is-error", !!isError);
    }

    function run() {
      try {
        var mode = modeEl.value;
        var result = apply(mode, input.value);
        output.value = result;
        setStatus("完成 · 输入 " + input.value.length + " 字符 → 输出 " + result.length + " 字符");
        window.umamiTrack?.("tool_used", { tool: "url-encode", action: mode });
      } catch (err) {
        output.value = "";
        setStatus(err && err.message ? err.message : "处理失败", true);
      }
    }

    if (btnRun) btnRun.addEventListener("click", run);
    modeEl.addEventListener("change", run);
    input.addEventListener("input", function () {
      clearTimeout(input._urlTimer);
      input._urlTimer = setTimeout(run, 200);
    });

    if (btnSwap) {
      btnSwap.addEventListener("click", function () {
        input.value = output.value;
        var map = {
          "encode-component": "decode-component",
          "decode-component": "encode-component",
          "encode-uri": "decode-uri",
          "decode-uri": "encode-uri",
          "encode-form": "decode-form",
          "decode-form": "encode-form",
        };
        modeEl.value = map[modeEl.value] || modeEl.value;
        run();
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener("click", function () {
        var text = output.value;
        if (!text) {
          window.ToolChrome?.showToast?.("没有可复制的内容");
          return;
        }
        var copyFn = window.ToolChrome?.copyText
          ? function (t) { return window.ToolChrome.copyText(t, "已复制"); }
          : function (t) { return navigator.clipboard.writeText(t); };
        copyFn(text).catch(function () {
          window.ToolChrome?.showToast?.("复制失败");
        });
      });
    }

    if (!input.value) input.value = "https://tools.songyuankun.top/tools/?q=JSON 格式化";
    run();
  }

  var ready = window.ToolChrome && ToolChrome.ready ? ToolChrome.ready : function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };
  ready(init);
})();
