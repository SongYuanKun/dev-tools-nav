(function () {
  "use strict";

  var TC = window.ToolChrome || {};
  var showToast = TC.showToast || function (msg) { alert(msg); };
  var copyText = TC.copyText || function (text) {
    return navigator.clipboard.writeText(text).then(function () {
      showToast("已复制到剪贴板");
    });
  };

  // 方言差异：在标准关键字基础上追加
  var DIALECT_KEYWORDS = {
    standard: [],
    mysql: ["AUTO_INCREMENT", "IFNULL", "REGEXP", "UNSIGNED", "TINYINT", "MEDIUMINT", "LONGTEXT"],
    postgresql: ["ILIKE", "RETURNING", "SERIAL", "BIGSERIAL", "JSONB", "TEXT[]"],
  };

  var BASE_NEWLINE_KEYWORDS = [
    "SELECT", "FROM", "WHERE", "GROUP BY", "HAVING", "ORDER BY", "LIMIT",
    "OFFSET", "UNION ALL", "UNION", "INTERSECT", "EXCEPT",
    "LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN", "INNER JOIN", "CROSS JOIN",
    "LEFT OUTER JOIN", "RIGHT OUTER JOIN", "JOIN",
    "INSERT INTO", "VALUES",
    "UPDATE", "SET",
    "DELETE FROM", "DELETE",
    "CREATE TABLE", "CREATE INDEX", "CREATE VIEW", "CREATE OR REPLACE VIEW",
    "ALTER TABLE", "DROP TABLE", "DROP INDEX",
    "ON", "AND", "OR",
    "CASE", "WHEN", "THEN", "ELSE", "END",
    "WITH", "RETURNING",
  ];

  var BASE_ALL_KEYWORDS = BASE_NEWLINE_KEYWORDS.concat([
    "AS", "IN", "NOT IN", "IS NULL", "IS NOT NULL", "NOT", "BETWEEN",
    "LIKE", "ILIKE", "EXISTS", "NOT EXISTS", "DISTINCT", "ALL", "ANY",
    "ASC", "DESC", "NULLS FIRST", "NULLS LAST",
    "PRIMARY KEY", "FOREIGN KEY", "REFERENCES", "NOT NULL", "UNIQUE",
    "DEFAULT", "AUTO_INCREMENT", "AUTOINCREMENT",
    "INT", "INTEGER", "BIGINT", "VARCHAR", "TEXT", "CHAR", "BOOLEAN",
    "FLOAT", "DOUBLE", "DECIMAL", "DATE", "DATETIME", "TIMESTAMP",
    "IF NOT EXISTS", "IF EXISTS",
    "COUNT", "SUM", "AVG", "MAX", "MIN", "COALESCE", "NULLIF", "CAST",
    "CONCAT", "LENGTH", "TRIM", "UPPER", "LOWER", "SUBSTRING", "NOW",
    "TRUE", "FALSE", "NULL",
    "BY", "INTO", "TABLE", "INDEX", "VIEW",
    "IFNULL", "REGEXP", "RETURNING", "SERIAL", "JSONB",
  ]);

  var EXAMPLES = {
    select: "select u.id, u.name, u.email, count(o.id) as order_count from users u left join orders o on u.id = o.user_id where u.status = 1 and u.created_at >= '2024-01-01' group by u.id, u.name, u.email having count(o.id) > 0 order by order_count desc limit 20",
    join: "select p.id, p.title, c.name as category, a.username as author from posts p inner join categories c on p.category_id = c.id inner join users a on p.author_id = a.id left join post_tags pt on p.id = pt.post_id left join tags t on pt.tag_id = t.id where p.status = 'published' and p.deleted_at is null order by p.created_at desc",
    insert: "insert into orders (user_id, product_id, quantity, amount, status, created_at) values (1001, 2003, 2, 199.00, 'pending', now())",
    update: "update products set stock = stock - 1, updated_at = now() where id = 2003 and stock > 0 and status = 'on_sale'",
    create: "create table if not exists users (id bigint primary key auto_increment, username varchar(64) not null unique, email varchar(128) not null unique, password_hash varchar(255) not null, status tinyint not null default 1, created_at datetime not null default now(), updated_at datetime not null default now())",
  };

  function getDialect() {
    var sel = document.getElementById("sqlDialect");
    var v = sel ? sel.value : "standard";
    return v === "mysql" || v === "postgresql" ? v : "standard";
  }

  function buildKeywordSets(dialect) {
    var extra = DIALECT_KEYWORDS[dialect] || [];
    var all = BASE_ALL_KEYWORDS.concat(extra);
    var nl = BASE_NEWLINE_KEYWORDS.concat(extra);
    all.sort(function (a, b) { return b.length - a.length; });
    nl.sort(function (a, b) { return b.length - a.length; });
    return { all: all, newline: nl };
  }

  function tokenize(sql, keywordList) {
    var tokens = [];
    var i = 0;
    var len = sql.length;

    while (i < len) {
      if (sql[i] === "-" && sql[i + 1] === "-") {
        var j = i;
        while (j < len && sql[j] !== "\n") j++;
        tokens.push({ type: "comment", value: sql.slice(i, j) });
        i = j;
        continue;
      }
      if (sql[i] === "/" && sql[i + 1] === "*") {
        var end = sql.indexOf("*/", i + 2);
        if (end === -1) end = len - 2;
        tokens.push({ type: "comment", value: sql.slice(i, end + 2) });
        i = end + 2;
        continue;
      }
      if (sql[i] === "'" || sql[i] === '"' || sql[i] === "`") {
        var quote = sql[i];
        j = i + 1;
        while (j < len) {
          if (sql[j] === "\\") { j += 2; continue; }
          if (sql[j] === quote) { j++; break; }
          j++;
        }
        tokens.push({ type: "string", value: sql.slice(i, j) });
        i = j;
        continue;
      }
      if (/\s/.test(sql[i])) {
        j = i;
        while (j < len && /\s/.test(sql[j])) j++;
        tokens.push({ type: "whitespace", value: sql.slice(i, j) });
        i = j;
        continue;
      }
      if (/[0-9]/.test(sql[i]) || (sql[i] === "." && /[0-9]/.test(sql[i + 1] || ""))) {
        j = i;
        while (j < len && /[0-9.]/.test(sql[j])) j++;
        tokens.push({ type: "number", value: sql.slice(i, j) });
        i = j;
        continue;
      }
      var matched = false;
      for (var k = 0; k < keywordList.length; k++) {
        var kw = keywordList[k];
        var slice = sql.slice(i, i + kw.length);
        if (slice.toUpperCase() === kw) {
          var before = i > 0 ? sql[i - 1] : " ";
          var after = sql[i + kw.length] || " ";
          if (!/[a-zA-Z0-9_]/.test(before) && !/[a-zA-Z0-9_]/.test(after)) {
            tokens.push({ type: "keyword", value: slice, keyword: kw });
            i += kw.length;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;
      j = i;
      while (j < len && /[a-zA-Z0-9_.$]/.test(sql[j])) j++;
      if (j > i) {
        tokens.push({ type: "ident", value: sql.slice(i, j) });
        i = j;
      } else {
        tokens.push({ type: "other", value: sql[i] });
        i++;
      }
    }
    return tokens;
  }

  function formatSQL(sql, opts, sets) {
    var tokens = tokenize(sql, sets.all);
    var result = "";
    var depth = 0;
    var lineStart = true;
    var meaningful = tokens.filter(function (t) { return t.type !== "whitespace"; });

    for (var i = 0; i < meaningful.length; i++) {
      var tok = meaningful[i];

      if (tok.type === "other" && tok.value === "(") {
        if (opts.indentSubquery) depth++;
        result += "(";
        lineStart = false;
        continue;
      }
      if (tok.type === "other" && tok.value === ")") {
        if (opts.indentSubquery && depth > 0) depth--;
        result += ")";
        lineStart = false;
        continue;
      }

      if (tok.type === "keyword") {
        var kw = tok.keyword;
        var display = opts.upperKeywords ? kw : tok.value;
        var isNewline = sets.newline.indexOf(kw) >= 0;

        if (isNewline) {
          if (result.length > 0) {
            result += "\n";
            for (var d = 0; d < depth; d++) result += opts.indent;
          }
          result += display + " ";
          lineStart = false;
          continue;
        }
        result += display + " ";
        lineStart = false;
        continue;
      }

      if (tok.type === "comment") {
        if (result.length > 0 && !lineStart) result += "\n";
        for (var d2 = 0; d2 < depth; d2++) result += opts.indent;
        result += tok.value + "\n";
        lineStart = true;
        continue;
      }

      if (tok.type === "other" && tok.value === ",") {
        result = result.trimEnd();
        result += ", ";
        lineStart = false;
        continue;
      }

      if (tok.type === "other" && tok.value === ";") {
        result = result.trimEnd();
        result += ";\n";
        lineStart = true;
        continue;
      }

      result += tok.value;
      if (tok.type !== "other") result += " ";
      lineStart = false;
    }

    return result.trim();
  }

  function minifySQL(sql, sets) {
    var tokens = tokenize(sql, sets.all);
    var parts = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === "comment") continue;
      parts.push(t.type === "whitespace" ? " " : t.value);
    }
    return parts.join("").replace(/\s+/g, " ").trim();
  }

  function analyzeSQL(sql) {
    if (!sql) return { error: "请先输入 SQL。" };
    var clean = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, " ");
    var type = (clean.match(/^\s*(select|insert|update|delete|create|alter|drop|with)\b/i) || [, "unknown"])[1].toUpperCase();
    var tables = [];
    clean.replace(/\b(?:from|join|into|update|table)\s+([`"[]?[\w.]+[`"\]]?)/gi, function (_, t) {
      tables.push(t.replace(/[`"[\]]/g, ""));
    });
    tables = Array.from(new Set(tables));
    var joins = (clean.match(/\bjoin\b/gi) || []).length;
    var params = (clean.match(/\?/g) || []).length + (clean.match(/[:@][a-zA-Z_]\w*/g) || []).length;
    var risk = [];
    if (/^\s*delete\b/i.test(clean) && !/\bwhere\b/i.test(clean)) risk.push("DELETE 未检测到 WHERE。");
    if (/^\s*update\b/i.test(clean) && !/\bwhere\b/i.test(clean)) risk.push("UPDATE 未检测到 WHERE。");
    if (/\bselect\s+\*/i.test(clean)) risk.push("使用 SELECT *，建议明确字段。");
    return {
      type: type,
      tables: tables,
      joins: joins,
      params: params,
      risk: risk,
      report:
        "类型：" + type +
        "\n表：" + (tables.join(", ") || "未识别") +
        "\nJOIN 数：" + joins +
        "\n参数占位：" + params +
        "\n风险提醒：" + (risk.length ? "\n- " + risk.join("\n- ") : "无明显基础风险"),
    };
  }

  function init() {
    var sqlInput = document.getElementById("sqlInput");
    if (!sqlInput) return;

    var sqlOutput = document.getElementById("sqlOutput");
    var statusEl = document.getElementById("statusMsg");
    var analyzeSection = document.getElementById("sqlAnalyzeSection");
    var analyzeOut = document.getElementById("sqlAnalyzeOut");
    var statType = document.getElementById("sqlStatType");
    var statTables = document.getElementById("sqlStatTables");
    var statParams = document.getElementById("sqlStatParams");

    var mode = "format";
    var debounceTimer;

    function getOpts() {
      var indentSize = parseInt(document.getElementById("indentSize")?.value, 10) || 4;
      return {
        upperKeywords: document.getElementById("upperKeywords")?.checked !== false,
        indentSubquery: document.getElementById("indentSubquery")?.checked !== false,
        indent: " ".repeat(indentSize),
      };
    }

    function getInput() {
      return (sqlInput.value || "").trim();
    }

    function setOutput(text) {
      if (sqlOutput) sqlOutput.textContent = text;
    }

    function setStatus(kind, text) {
      if (!statusEl) return;
      statusEl.className = "tool-status";
      if (kind === "ok") statusEl.classList.add("tool-status-success");
      else if (kind === "err") statusEl.classList.add("tool-status-error");
      else statusEl.classList.add("tool-status-info");
      statusEl.textContent = text;
    }

    function updateAnalyzeUI(result) {
      if (result.error) {
        if (statType) statType.textContent = "—";
        if (statTables) statTables.textContent = "—";
        if (statParams) statParams.textContent = "—";
        if (analyzeOut) analyzeOut.textContent = result.error;
        setStatus("err", result.error);
        return;
      }
      if (statType) statType.textContent = result.type;
      if (statTables) statTables.textContent = result.tables.length + " 表 / " + result.joins + " JOIN";
      if (statParams) statParams.textContent = result.params + " 个";
      if (analyzeOut) analyzeOut.textContent = result.report;
      setStatus("ok", "分析完成。");
    }

    function switchMode(name) {
      mode = name;
      document.querySelectorAll("[data-sql-mode]").forEach(function (tab) {
        var active = tab.getAttribute("data-sql-mode") === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      document.querySelectorAll("[data-sql-mode-panel]").forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-sql-mode-panel") !== name;
      });
      if (analyzeSection) analyzeSection.hidden = name !== "analyze";
      setStatus("info", name === "format" ? "格式化模式：输入 SQL 后点击格式化或等待自动格式化。" :
        name === "minify" ? "压缩模式：将 SQL 压缩为单行。" :
          "分析模式：查看语句类型、表引用与风险提醒。");
      runModeAction(true);
    }

    function runModeAction(silent) {
      var sql = getInput();
      var sets = buildKeywordSets(getDialect());
      if (!sql) {
        setOutput("");
        if (mode === "analyze") updateAnalyzeUI({ error: "请先输入 SQL。" });
        else if (!silent) setStatus("info", "就绪：请输入 SQL 语句。");
        return;
      }
      if (mode === "format") {
        setOutput(formatSQL(sql, getOpts(), sets));
        if (!silent) setStatus("ok", "格式化完成。");
      } else if (mode === "minify") {
        setOutput(minifySQL(sql, sets));
        if (!silent) setStatus("ok", "已压缩为单行。");
      } else {
        updateAnalyzeUI(analyzeSQL(sql));
      }
    }

    function scheduleAutoRun() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        runModeAction(true);
      }, 300);
    }

    document.querySelectorAll("[data-sql-mode]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchMode(tab.getAttribute("data-sql-mode") || "format");
      });
    });

    document.getElementById("btnFormat")?.addEventListener("click", function () {
      switchMode("format");
      runModeAction(false);
      window.umamiTrack?.("tool_used", { tool: "sql_formatter", action: "format" });
    });

    document.getElementById("btnMinify")?.addEventListener("click", function () {
      switchMode("minify");
      runModeAction(false);
      window.umamiTrack?.("tool_used", { tool: "sql_formatter", action: "minify" });
    });

    document.getElementById("btnAnalyze")?.addEventListener("click", function () {
      switchMode("analyze");
      runModeAction(false);
      window.umamiTrack?.("tool_used", { tool: "sql_formatter", action: "analyze" });
    });

    document.getElementById("btnCopy")?.addEventListener("click", function () {
      var text = sqlOutput ? sqlOutput.textContent : "";
      if (!text) {
        setStatus("err", "输出为空，无法复制。");
        return;
      }
      copyText(text).catch(function () {
        showToast("复制失败，请手动选中复制");
      });
    });

    document.getElementById("btnCopyReport")?.addEventListener("click", function () {
      var text = analyzeOut ? analyzeOut.textContent : "";
      if (!text || text.indexOf("请先") === 0) {
        showToast("没有可复制的报告");
        return;
      }
      copyText(text).catch(function () { showToast("复制失败"); });
    });

    document.getElementById("btnClear")?.addEventListener("click", function () {
      sqlInput.value = "";
      setOutput("");
      if (analyzeOut) analyzeOut.textContent = "分析报告会显示在这里。";
      if (statType) statType.textContent = "—";
      if (statTables) statTables.textContent = "—";
      if (statParams) statParams.textContent = "—";
      setStatus("info", "就绪：请输入 SQL 语句。");
    });

    document.querySelectorAll("[data-example]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-example");
        var sql = EXAMPLES[key];
        if (sql) {
          sqlInput.value = sql;
          setStatus("info", "示例已填入。");
          scheduleAutoRun();
        }
      });
    });

    ["upperKeywords", "indentSubquery", "indentSize", "sqlDialect"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", scheduleAutoRun);
    });

    sqlInput.addEventListener("input", scheduleAutoRun);

    switchMode("format");
  }

  (TC.ready || function (fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  })(init);
})();
