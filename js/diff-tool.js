(function () {
  "use strict";

  function html(s) {
    if (window.ToolChrome && ToolChrome.html) return ToolChrome.html(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 计算两行文本 LCS 表
  function buildLcsTable(a, b) {
    var m = a.length;
    var n = b.length;
    var dp = new Array(m + 1);
    for (var i = 0; i <= m; i++) {
      dp[i] = new Array(n + 1).fill(0);
    }
    for (var ri = 1; ri <= m; ri++) {
      for (var cj = 1; cj <= n; cj++) {
        if (a[ri - 1] === b[cj - 1]) dp[ri][cj] = dp[ri - 1][cj - 1] + 1;
        else dp[ri][cj] = Math.max(dp[ri - 1][cj], dp[ri][cj - 1]);
      }
    }
    return dp;
  }

  // 基于 LCS 回溯生成 diff 操作序列
  function diffLines(leftText, rightText) {
    var left = leftText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var right = rightText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var dp = buildLcsTable(left, right);
    var ops = [];
    var i = left.length;
    var j = right.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
        ops.unshift({ type: "same", text: left[i - 1] });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.unshift({ type: "add", text: right[j - 1] });
        j--;
      } else {
        ops.unshift({ type: "del", text: left[i - 1] });
        i--;
      }
    }
    return ops;
  }

  // 渲染高亮 diff 结果
  function renderResult(ops) {
    return ops.map(function (op) {
      var cls = op.type === "add" ? "diff-line-add" : op.type === "del" ? "diff-line-del" : "diff-line-same";
      var prefix = op.type === "add" ? "+ " : op.type === "del" ? "- " : "  ";
      return '<div class="' + cls + '">' + html(prefix + op.text) + "</div>";
    }).join("");
  }

  // 统计增删行数
  function computeStats(ops) {
    var added = 0;
    var removed = 0;
    var same = 0;
    ops.forEach(function (op) {
      if (op.type === "add") added++;
      else if (op.type === "del") removed++;
      else same++;
    });
    return { added: added, removed: removed, same: same };
  }

  // 导出 unified diff 格式
  function toUnifiedDiff(leftText, rightText, ops) {
    var left = leftText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var right = rightText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var lines = ["--- left", "+++ right", "@@ -1," + left.length + " +1," + right.length + " @@"];
    ops.forEach(function (op) {
      if (op.type === "same") lines.push(" " + op.text);
      else if (op.type === "del") lines.push("-" + op.text);
      else lines.push("+" + op.text);
    });
    return lines.join("\n");
  }

  function runDiff() {
    var leftEl = document.getElementById("diffLeft");
    var rightEl = document.getElementById("diffRight");
    var resultEl = document.getElementById("diffResult");
    var statsEl = document.getElementById("diffStats");
    var unifiedEl = document.getElementById("diffUnified");
    if (!leftEl || !rightEl) return;

    var leftText = leftEl.value;
    var rightText = rightEl.value;
    var ops = diffLines(leftText, rightText);
    var stats = computeStats(ops);

    if (resultEl) resultEl.innerHTML = renderResult(ops);

    if (statsEl) {
      if (!leftText && !rightText) {
        statsEl.textContent = "就绪：在左右两侧输入文本进行逐行对比。";
      } else if (stats.added === 0 && stats.removed === 0) {
        statsEl.textContent = "两侧文本完全一致（" + stats.same + " 行）。";
        statsEl.className = "tool-status tool-status-success";
      } else {
        statsEl.className = "tool-status tool-status-info";
        statsEl.textContent =
          "对比完成：+" + stats.added + " 行 / -" + stats.removed + " 行 / 相同 " + stats.same + " 行";
      }
    }

    if (unifiedEl) {
      unifiedEl.textContent = leftText || rightText ? toUnifiedDiff(leftText, rightText, ops) : "";
    }
  }

  function init() {
    var leftEl = document.getElementById("diffLeft");
    if (!leftEl) return;

    var timer;
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(runDiff, 180);
    }

    leftEl.addEventListener("input", schedule);
    var rightEl = document.getElementById("diffRight");
    if (rightEl) rightEl.addEventListener("input", schedule);

    var btnRun = document.getElementById("btnDiffRun");
    if (btnRun) btnRun.addEventListener("click", function () {
      runDiff();
      window.umamiTrack?.("tool_used", { tool: "diff", action: "run" });
    });

    var btnSwap = document.getElementById("btnDiffSwap");
    if (btnSwap && rightEl) {
      btnSwap.addEventListener("click", function () {
        var tmp = leftEl.value;
        leftEl.value = rightEl.value;
        rightEl.value = tmp;
        runDiff();
      });
    }

    var btnClear = document.getElementById("btnDiffClear");
    if (btnClear) {
      btnClear.addEventListener("click", function () {
        leftEl.value = "";
        if (rightEl) rightEl.value = "";
        runDiff();
      });
    }

    runDiff();
  }

  var ready = window.ToolChrome && ToolChrome.ready ? ToolChrome.ready : function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };
  ready(init);
})();
