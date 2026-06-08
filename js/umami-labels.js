/**
 * Umami 事件中文描述 — 写入每条事件的 描述 字段，便于后台查看
 */
(function () {
  'use strict';

  // 事件名 → 中文说明
  var EVENT_LABELS = {
    nav_click: '导航点击',
    tool_click: '工具点击',
    theme_toggle: '主题切换',
    cta_action: 'CTA 按钮',
    category_click: '分类筛选',
    search_use: '搜索使用',
    external_link: '外部链接',
    tool_used: '工具使用',
    copy_click: '复制操作',
    article_click: '博客文章',
    ai_path_click: 'AI 学习路径',
    ai_nav_click: 'AI 专题导航',
    ai_filter: 'AI 场景筛选',
    prompt_category: 'Prompt 分类',
    blog_category: '博客分类',
    favorite_toggle: '收藏切换',
    easter_egg_unlocked: '彩蛋解锁',
    js_error: 'JS 错误',
    perf_lcp: '页面性能 LCP',
    scroll_depth: '滚动深度',
    page_exit: '页面离开'
  };

  var CTA_LABELS = {
    start_tools: '开始使用工具',
    browse_ai: '浏览 AI 专题',
    follow_platform: '关注平台',
    support_open: '打开支持作者',
    support_qr: '查看收款码'
  };

  var TOOL_LABELS = {
    json: 'JSON 格式化',
    timestamp: '时间戳转换',
    base64: 'Base64',
    regex: '正则表达式',
    cron: 'Cron 表达式',
    jwt: 'JWT 解码',
    sql_formatter: 'SQL 格式化',
    kms: 'KMS 激活',
    jrebel: 'JRebel 激活'
  };

  var ACTION_LABELS = {
    format: '格式化',
    minify: '压缩',
    validate: '校验',
    encode: '编码',
    decode: '解码',
    replace: '替换',
    parse: '解析',
    copy: '复制命令',
    ts_to_date: '时间戳转日期',
    date_to_ts: '日期转时间戳',
    batch: '批量转换',
    diff: '时间差计算'
  };

  var CATEGORY_LABELS = {
    all: '全部',
    encode: '编码转换',
    time: '时间日期',
    data: '数据处理',
    auth: '鉴权安全',
    regex: '正则文本',
    ai: 'AI 工具',
    hosting: '托管部署',
    favorites: '我的收藏',
    recent: '最近访问',
    'online-tools': '在线工具',
    activate: '激活工具'
  };

  function pick(map, key) {
    return map[key] || key || '';
  }

  function buildDesc(name, data) {
    data = data || {};
    var base = EVENT_LABELS[name] || name;
    var d = data;

    if (name === 'cta_action') {
      return base + '：' + pick(CTA_LABELS, d.action);
    }
    if (name === 'tool_click') {
      var cat = pick(CATEGORY_LABELS, d.category);
      return base + '：' + (d.tool_name || d.name || '') + (cat ? '（' + cat + '）' : '');
    }
    if (name === 'tool_used') {
      return base + '：' + pick(TOOL_LABELS, d.tool) + ' - ' + pick(ACTION_LABELS, d.action);
    }
    if (name === 'search_use') {
      return base + '：「' + (d.query || '') + '」' + (d.results != null ? '（' + d.results + ' 条结果）' : '');
    }
    if (name === 'category_click' || name === 'blog_category' || name === 'prompt_category') {
      return base + '：' + (pick(CATEGORY_LABELS, d.category) || d.category);
    }
    if (name === 'nav_click') {
      return base + '：' + (d.label || d.page || '');
    }
    if (name === 'external_link') {
      return base + '：' + (d.label || d.url || '');
    }
    if (name === 'theme_toggle') {
      return base + '：' + (d.from || '') + ' → ' + (d.to || '');
    }
    if (name === 'favorite_toggle') {
      return base + '：' + (d.tool_name || d.tool_id || '') + '（' + (d.action === 'add' ? '收藏' : '取消') + '）';
    }
    if (name === 'article_click') {
      return base + '：' + (d.title || '');
    }
    if (name === 'ai_path_click') {
      return base + '：' + (d.step || '');
    }
    if (name === 'ai_nav_click') {
      return base + '：' + (d.label || '');
    }
    if (name === 'ai_filter') {
      return base + '：' + (d.scene || '');
    }
    if (name === 'copy_click') {
      return base + '：' + (d.label || d.page || '');
    }
    if (name === 'js_error') {
      return base + '：' + (d.message || '');
    }
    if (name === 'perf_lcp') {
      return base + '：' + (d.value != null ? d.value + 'ms' : '');
    }
    if (name === 'scroll_depth') {
      return base + '：' + (d.depth != null ? d.depth + '%' : '');
    }
    if (name === 'page_exit') {
      return base + '：停留 ' + (d.duration != null ? Math.round(d.duration / 1000) + 's' : '');
    }

    return base;
  }

  function enrich(name, data) {
    var props = Object.assign({}, data || {});
    if (!props.描述) {
      props.描述 = buildDesc(name, props);
    }
    return props;
  }

  window.umamiEnrich = enrich;
  window.umamiTrack = function (name, data) {
    try {
      if (typeof umami !== 'undefined' && typeof umami._rawTrack === 'function') {
        umami._rawTrack(name, enrich(name, data));
      } else if (typeof umami !== 'undefined' && typeof umami.track === 'function') {
        umami.track(name, enrich(name, data));
      }
    } catch (_) {}
  };
})();
