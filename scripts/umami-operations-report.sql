\set ON_ERROR_STOP on

WITH target_hosts(hostname) AS (
  VALUES ('tools.songyuankun.top'), ('songyuankun.github.io')
), periods(period, start_at, end_at) AS (
  VALUES
    ('last_7_days', NOW() - INTERVAL '7 days', NOW()),
    ('last_30_days', NOW() - INTERVAL '30 days', NOW()),
    ('previous_30_days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days')
), normalized_events AS (
  SELECT
    e.*,
    CASE
      WHEN e.hostname = 'songyuankun.github.io'
        THEN regexp_replace(e.url_path, '^/dev-tools-nav(?=/|$)', '')
      ELSE e.url_path
    END AS normalized_path
  FROM website_event e
  JOIN target_hosts h USING (hostname)
  WHERE e.website_id = :'website_id'::uuid
), pageviews AS (
  SELECT p.period, e.hostname, e.normalized_path,
         COUNT(*) AS pv,
         COUNT(DISTINCT e.session_id) AS sessions,
         COUNT(DISTINCT s.distinct_id) AS visitors
  FROM periods p
  JOIN normalized_events e ON e.created_at >= p.start_at AND e.created_at < p.end_at
  LEFT JOIN session s USING (session_id)
  WHERE e.event_type = 1 AND e.event_name IS NULL
  GROUP BY p.period, e.hostname, e.normalized_path
), effective_use AS (
  SELECT p.period, e.hostname, e.normalized_path,
         COUNT(*) FILTER (
           WHERE COALESCE(d.string_value, '') NOT IN (
             'kms', 'jrebel', 'KMS 激活', 'JRebel 激活'
           )
         ) AS effective_uses,
         COUNT(DISTINCT e.session_id) FILTER (
           WHERE COALESCE(d.string_value, '') NOT IN (
             'kms', 'jrebel', 'KMS 激活', 'JRebel 激活'
           )
         ) AS effective_users
  FROM periods p
  JOIN normalized_events e ON e.created_at >= p.start_at AND e.created_at < p.end_at
  LEFT JOIN event_data d ON d.website_event_id = e.event_id AND d.data_key = '工具'
  WHERE e.event_name = '工具使用'
  GROUP BY p.period, e.hostname, e.normalized_path
)
SELECT pv.period, pv.hostname, pv.normalized_path, pv.pv, pv.sessions, pv.visitors,
       COALESCE(eu.effective_uses, 0) AS effective_uses,
       COALESCE(eu.effective_users, 0) AS effective_users
FROM pageviews pv
LEFT JOIN effective_use eu USING (period, hostname, normalized_path)
ORDER BY pv.period, pv.hostname, pv.pv DESC, pv.normalized_path;
