-- dev-tools-nav (tools.songyuankun.top) Umami Goals / Funnels 重建
-- 网站 ID: 99e14cad-6300-4f3c-83d2-b3b71c7d6a25
-- 事件名与 js/umami-labels.js 中文映射一致
-- 用法（服务器上）：
--   docker exec -e PGPASSWORD='…' 1Panel-postgresql-emsf \
--     psql -U umami_hWTtkK -d umami_wk4zs4 -f - < scripts/rebuild-umami-goals.sql

BEGIN;

-- ========== 事件类 Goal：英文 event_name → 中文 ==========
UPDATE report SET parameters = '{"type":"event","value":"工具点击"}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = 'tool_click';

UPDATE report SET parameters = '{"type":"event","value":"搜索使用"}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = 'search_use';

UPDATE report SET parameters = '{"type":"event","value":"外部链接"}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = 'external_link';

UPDATE report SET parameters = '{"type":"event","value":"按钮点击"}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = 'cta_action';

UPDATE report SET parameters = '{"type":"event","value":"工具使用"}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = 'tool_used';

UPDATE report SET parameters = '{"type":"event","value":"主题切换"}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = 'theme_toggle';

UPDATE report SET parameters = '{"type":"event","value":"滚动深度"}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = 'scroll_depth';

UPDATE report SET parameters = '{"type":"event","value":"JS 错误"}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = 'js_error';

-- ========== 路径类 Goal：统一到 /tools/ ==========
UPDATE report SET parameters = '{"type":"path","value":"/tools/"}'::jsonb, name = '访问在线工具', updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = '/pages/tools';

UPDATE report SET parameters = '{"type":"path","value":"/tools/json/"}'::jsonb, name = '使用 JSON 工具', updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'goal' AND parameters->>'value' = '/tools';

-- ========== 漏斗：更新路径步骤 ==========
UPDATE report SET parameters = '{"steps":[{"type":"path","value":"/"},{"type":"path","value":"/pages/ai"},{"type":"path","value":"/tools/"}],"window":60}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'funnel' AND name = '深度浏览漏斗';

UPDATE report SET parameters = '{"steps":[{"type":"path","value":"/"},{"type":"path","value":"/tools/"},{"type":"path","value":"/tools/json/"}],"window":60}'::jsonb, updated_at = NOW()
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type = 'funnel' AND name = '工具使用漏斗';

-- ========== 新增事件 Goal（若不存在） ==========
INSERT INTO report (report_id, user_id, website_id, type, name, description, parameters, created_at, updated_at)
SELECT gen_random_uuid(), '41e2b680-648e-4b09-bcd7-3e2b10c06264', '99e14cad-6300-4f3c-83d2-b3b71c7d6a25', 'goal', v.name, '', v.params::jsonb, NOW(), NOW()
FROM (VALUES
  ('导航点击', '{"type":"event","value":"导航点击"}'),
  ('分类筛选', '{"type":"event","value":"分类筛选"}'),
  ('收藏切换', '{"type":"event","value":"收藏切换"}'),
  ('彩蛋解锁', '{"type":"event","value":"彩蛋解锁"}'),
  ('AI 专题导航', '{"type":"event","value":"AI 专题导航"}')
) AS v(name, params)
WHERE NOT EXISTS (
  SELECT 1 FROM report r
  WHERE r.website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25'
    AND r.type = 'goal' AND r.name = v.name
);

COMMIT;

-- 验证
SELECT name, parameters FROM report
WHERE website_id = '99e14cad-6300-4f3c-83d2-b3b71c7d6a25' AND type IN ('goal','funnel')
ORDER BY type, name;
