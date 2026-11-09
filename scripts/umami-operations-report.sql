\set ON_ERROR_STOP on

-- 只读运营报表：原始总量与分队列并列；禁止破坏性写库；不声称真人身份。
-- 口径源：scripts/umami-traffic-quality.mjs
-- visit_id：用于 visits；session_id 可跨天，禁止把事件时间跨度当停留时长。

WITH target_hosts(hostname) AS (
  VALUES ('tools.songyuankun.top'), ('songyuankun.github.io')
), periods(period, start_at, end_at) AS (
  VALUES
    ('last_7_days', NOW() - INTERVAL '7 days', NOW()),
    ('last_30_days', NOW() - INTERVAL '30 days', NOW()),
    ('previous_30_days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days')
), cohorts(cohort) AS (
  VALUES
    ('raw'),
    ('suspected_automation'),
    ('selftest'),
    ('filtered_external')
), effective_tool_whitelist(tool) AS (
  VALUES
    ('JSON 格式化'),
    ('时间戳转换'),
    ('Base64'),
    ('正则表达式'),
    ('Cron 表达式'),
    ('JWT 解码'),
    ('SQL 格式化'),
    ('diff'),
    ('uuid'),
    ('颜色转换'),
    ('URL 编解码'),
    ('哈希生成器'),
    ('二维码生成器')
), effective_action_whitelist(tool, action) AS (
  VALUES
    ('JSON 格式化', '格式化'),
    ('JSON 格式化', '压缩'),
    ('JSON 格式化', '修复'),
    ('JSON 格式化', '校验'),
    ('JSON 格式化', '结构对比'),
    ('时间戳转换', '时间戳转日期'),
    ('时间戳转换', '日期转时间戳'),
    ('时间戳转换', '批量转换'),
    ('时间戳转换', '时间差计算'),
    ('Base64', '编码'),
    ('Base64', '解码'),
    ('Base64', '哈希'),
    ('Base64', '转 JSON'),
    ('正则表达式', '模板'),
    ('正则表达式', '替换'),
    ('Cron 表达式', '解析'),
    ('Cron 表达式', '应用'),
    ('Cron 表达式', '复制'),
    ('JWT 解码', '验签'),
    ('JWT 解码', '生成'),
    ('JWT 解码', '解码'),
    ('SQL 格式化', '格式化'),
    ('SQL 格式化', '压缩'),
    ('SQL 格式化', '分析'),
    ('diff', '运行'),
    ('uuid', '生成'),
    ('颜色转换', '对比度'),
    ('颜色转换', '复制 CSS 变量'),
    ('颜色转换', '取色'),
    ('URL 编解码', 'encode-component'),
    ('URL 编解码', 'decode-component'),
    ('URL 编解码', 'encode-uri'),
    ('URL 编解码', 'decode-uri'),
    ('URL 编解码', 'encode-form'),
    ('URL 编解码', 'decode-form'),
    ('哈希生成器', '摘要'),
    ('二维码生成器', '生成')
), normalized_events AS (
  SELECT
    e.*,
    CASE
      WHEN e.hostname = 'songyuankun.github.io'
        THEN COALESCE(
          NULLIF(regexp_replace(e.url_path, '^/dev-tools-nav(?=/|$)', ''), ''),
          '/'
        )
      ELSE e.url_path
    END AS path_after_prefix
  FROM website_event e
  JOIN target_hosts h USING (hostname)
  WHERE e.website_id = :'website_id'::uuid
), routed_events AS (
  SELECT
    e.*,
    CASE
      WHEN e.path_after_prefix ~ '^/pages/tools/([^/]+?)(?:\.html)?/?$'
        THEN '/tools/' || lower(regexp_replace(e.path_after_prefix, '^/pages/tools/([^/]+?)(?:\.html)?/?$', '\1')) || '/'
      WHEN e.path_after_prefix ~ '^/tools/[^/]+$'
        THEN e.path_after_prefix || '/'
      WHEN e.path_after_prefix ~ '^/pages/template(\.html)?'
        OR e.path_after_prefix ~ '^/template(\.html)?'
        THEN '/pages/template.html'
      ELSE e.path_after_prefix
    END AS normalized_path
  FROM normalized_events e
), session_flags AS (
  SELECT
    s.session_id,
    s.distinct_id,
    s.browser,
    s.os,
    s.screen,
    s.language,
    s.country,
    (
      lower(COALESCE(s.browser, '')) LIKE 'chrome%'
      AND lower(COALESCE(s.os, '')) LIKE 'windows 10%'
      AND COALESCE(s.screen, '') = '1280x1200'
      AND lower(COALESCE(s.language, '')) LIKE 'en-us%'
    ) AS is_suspected_automation
  FROM session s
), event_tool_props AS (
  SELECT
    d.website_event_id AS event_id,
    MAX(CASE WHEN d.data_key = '工具' THEN d.string_value END) AS tool_label,
    MAX(CASE WHEN d.data_key = '操作' THEN d.string_value END) AS action_label,
    MAX(CASE WHEN d.data_key = '标记' THEN d.string_value END) AS mark_label,
    MAX(CASE WHEN d.data_key = '自测' THEN d.string_value END) AS selftest_prop,
    MAX(CASE WHEN d.data_key = '入口' THEN d.string_value END) AS entry_label
  FROM event_data d
  GROUP BY d.website_event_id
), enriched_events AS (
  SELECT
    e.*,
    COALESCE(sf.distinct_id, e.session_id::text) AS identity_key,
    COALESCE(e.visit_id, e.session_id) AS visit_key,
    COALESCE(sf.is_suspected_automation, FALSE) AS is_suspected_automation,
    (
      COALESCE(p.mark_label, '') = '自测'
      OR COALESCE(p.selftest_prop, '') IN ('是', 'selftest', '1')
    ) AS is_selftest,
    p.tool_label,
    p.action_label,
    p.entry_label,
    (
      e.normalized_path = '/pages/template.html'
      OR e.url_path ~ 'template'
    ) AS is_template_hit
  FROM routed_events e
  LEFT JOIN session_flags sf USING (session_id)
  LEFT JOIN event_tool_props p ON p.event_id = e.event_id
), cohort_events AS (
  SELECT
    c.cohort,
    e.*
  FROM enriched_events e
  CROSS JOIN cohorts c
  WHERE
    c.cohort = 'raw'
    OR (c.cohort = 'suspected_automation' AND e.is_suspected_automation AND NOT e.is_selftest)
    OR (c.cohort = 'selftest' AND e.is_selftest)
    OR (c.cohort = 'filtered_external' AND NOT e.is_suspected_automation AND NOT e.is_selftest)
), pageview_events AS (
  SELECT *
  FROM cohort_events
  WHERE event_type = 1 AND event_name IS NULL
), valid_effective_events AS (
  SELECT e.*
  FROM cohort_events e
  WHERE e.event_name = '工具使用'
    AND EXISTS (
      SELECT 1
      FROM effective_action_whitelist w
      WHERE w.tool = e.tool_label
        AND w.action = e.action_label
    )
), pageviews AS (
  SELECT
    dimensions.report_level,
    e.cohort,
    p.period,
    dimensions.hostname,
    dimensions.normalized_path,
    COUNT(*) AS pv,
    COUNT(DISTINCT e.session_id) AS sessions,
    COUNT(DISTINCT e.visit_key) AS visits,
    COUNT(DISTINCT e.identity_key) AS visitors
  FROM pageview_events e
  JOIN periods p ON e.created_at >= p.start_at AND e.created_at < p.end_at
  CROSS JOIN LATERAL (
    VALUES
      ('detail', e.hostname, e.normalized_path),
      ('hostname_summary', e.hostname, NULL::text),
      ('all_hosts_summary', 'all', NULL::text)
  ) AS dimensions(report_level, hostname, normalized_path)
  GROUP BY dimensions.report_level, e.cohort, p.period, dimensions.hostname, dimensions.normalized_path
), effective_use AS (
  SELECT
    dimensions.report_level,
    e.cohort,
    p.period,
    dimensions.hostname,
    dimensions.normalized_path,
    COUNT(*) AS effective_uses,
    COUNT(DISTINCT e.identity_key) AS effective_users
  FROM valid_effective_events e
  JOIN periods p ON e.created_at >= p.start_at AND e.created_at < p.end_at
  CROSS JOIN LATERAL (
    VALUES
      ('detail', e.hostname, e.normalized_path),
      ('hostname_summary', e.hostname, NULL::text),
      ('all_hosts_summary', 'all', NULL::text)
  ) AS dimensions(report_level, hostname, normalized_path)
  GROUP BY dimensions.report_level, e.cohort, p.period, dimensions.hostname, dimensions.normalized_path
), unified_keys AS (
  SELECT report_level, cohort, period, hostname, normalized_path FROM pageviews
  UNION
  SELECT report_level, cohort, period, hostname, normalized_path FROM effective_use
)
SELECT
  keys.report_level,
  keys.cohort,
  keys.period,
  keys.hostname,
  keys.normalized_path,
  COALESCE(pv.pv, 0) AS pv,
  COALESCE(pv.sessions, 0) AS sessions,
  COALESCE(pv.visits, 0) AS visits,
  COALESCE(pv.visitors, 0) AS visitors,
  COALESCE(eu.effective_uses, 0) AS effective_uses,
  COALESCE(eu.effective_users, 0) AS effective_users
FROM unified_keys keys
LEFT JOIN pageviews pv
  ON pv.report_level = keys.report_level
 AND pv.cohort = keys.cohort
 AND pv.period = keys.period
 AND pv.hostname = keys.hostname
 AND pv.normalized_path IS NOT DISTINCT FROM keys.normalized_path
LEFT JOIN effective_use eu
  ON eu.report_level = keys.report_level
 AND eu.cohort = keys.cohort
 AND eu.period = keys.period
 AND eu.hostname = keys.hostname
 AND eu.normalized_path IS NOT DISTINCT FROM keys.normalized_path
ORDER BY
  CASE keys.report_level
    WHEN 'all_hosts_summary' THEN 1
    WHEN 'hostname_summary' THEN 2
    ELSE 3
  END,
  CASE keys.cohort
    WHEN 'raw' THEN 1
    WHEN 'filtered_external' THEN 2
    WHEN 'suspected_automation' THEN 3
    WHEN 'selftest' THEN 4
    ELSE 5
  END,
  keys.period,
  keys.hostname,
  pv DESC,
  keys.normalized_path;
