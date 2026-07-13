\set ON_ERROR_STOP on

WITH target_hosts(hostname) AS (
  VALUES ('tools.songyuankun.top'), ('songyuankun.github.io')
), periods(period, start_at, end_at) AS (
  VALUES
    ('last_7_days', NOW() - INTERVAL '7 days', NOW()),
    ('last_30_days', NOW() - INTERVAL '30 days', NOW()),
    ('previous_30_days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days')
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
    ('uuid')
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
    END AS normalized_path
  FROM website_event e
  JOIN target_hosts h USING (hostname)
  WHERE e.website_id = :'website_id'::uuid
), enriched_events AS (
  SELECT
    e.*,
    COALESCE(s.distinct_id, e.session_id::text) AS identity_key
  FROM normalized_events e
  LEFT JOIN session s USING (session_id)
), pageview_events AS (
  SELECT *
  FROM enriched_events
  WHERE event_type = 1 AND event_name IS NULL
), valid_effective_events AS (
  SELECT e.*
  FROM enriched_events e
  WHERE e.event_name = '工具使用'
    AND EXISTS (
      SELECT 1
      FROM event_data d
      WHERE d.website_event_id = e.event_id
        AND d.data_key = '工具'
        AND EXISTS (
          SELECT 1
          FROM effective_tool_whitelist whitelist
          WHERE whitelist.tool = d.string_value
        )
    )
), pageviews AS (
  SELECT
    dimensions.report_level,
    p.period,
    dimensions.hostname,
    dimensions.normalized_path,
    COUNT(*) AS pv,
    COUNT(DISTINCT e.session_id) AS sessions,
    COUNT(DISTINCT e.identity_key) AS visitors
  FROM pageview_events e
  JOIN periods p ON e.created_at >= p.start_at AND e.created_at < p.end_at
  CROSS JOIN LATERAL (
    VALUES
      ('detail', e.hostname, e.normalized_path),
      ('hostname_summary', e.hostname, NULL::text),
      ('all_hosts_summary', 'all', NULL::text)
  ) AS dimensions(report_level, hostname, normalized_path)
  GROUP BY dimensions.report_level, p.period, dimensions.hostname, dimensions.normalized_path
), effective_use AS (
  SELECT
    dimensions.report_level,
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
  GROUP BY dimensions.report_level, p.period, dimensions.hostname, dimensions.normalized_path
), unified_keys AS (
  SELECT report_level, period, hostname, normalized_path FROM pageviews
  UNION
  SELECT report_level, period, hostname, normalized_path FROM effective_use
)
SELECT
  keys.report_level,
  keys.period,
  keys.hostname,
  keys.normalized_path,
  COALESCE(pv.pv, 0) AS pv,
  COALESCE(pv.sessions, 0) AS sessions,
  COALESCE(pv.visitors, 0) AS visitors,
  COALESCE(eu.effective_uses, 0) AS effective_uses,
  COALESCE(eu.effective_users, 0) AS effective_users
FROM unified_keys keys
LEFT JOIN pageviews pv
  ON pv.report_level = keys.report_level
 AND pv.period = keys.period
 AND pv.hostname = keys.hostname
 AND pv.normalized_path IS NOT DISTINCT FROM keys.normalized_path
LEFT JOIN effective_use eu
  ON eu.report_level = keys.report_level
 AND eu.period = keys.period
 AND eu.hostname = keys.hostname
 AND eu.normalized_path IS NOT DISTINCT FROM keys.normalized_path
ORDER BY
  CASE keys.report_level
    WHEN 'all_hosts_summary' THEN 1
    WHEN 'hostname_summary' THEN 2
    ELSE 3
  END,
  keys.period,
  keys.hostname,
  pv DESC,
  keys.normalized_path;
