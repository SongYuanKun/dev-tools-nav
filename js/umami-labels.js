/**
 * Umami 事件中文映射 — 事件名与属性均以中文写入 Umami，便于后台阅读
 */
(function () {
  'use strict';

  // 内部事件键 → Umami 展示用中文事件名
  var EVENT_LABELS = {
    nav_click: '导航点击',
    tool_click: '工具点击',
    theme_toggle: '主题切换',
    cta_action: '按钮点击',
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
    blog_filter: '博客筛选',
    radar_filter: '雷达筛选',
    radar_copy_link: '雷达复制链接',
    favorite_toggle: '收藏切换',
    easter_egg_unlocked: '彩蛋解锁',
    js_error: 'JS 错误',
    perf_lcp: '页面性能',
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
    sql: 'SQL 格式化',
    sql_formatter: 'SQL 格式化',
    kms: 'KMS 激活',
    jrebel: 'JRebel 激活'
  };

  var ACTION_LABELS = {
    format: '格式化',
    minify: '压缩',
    validate: '校验',
    repair: '修复',
    encode: '编码',
    decode: '解码',
    replace: '替换',
    parse: '解析',
    copy: '复制',
    download: '下载',
    clear: '清空',
    verify: '验签',
    analyze: '分析',
    ts_to_date: '时间戳转日期',
    date_to_ts: '日期转时间戳',
    batch: '批量转换',
    diff: '时间差计算',
    match: '匹配测试',
    sample: '加载示例'
  };

  var CATEGORY_LABELS = {
    all: '全部',
    encode: '编码转换',
    time: '时间日期',
    data: '数据处理',
    auth: '鉴权安全',
    regex: '正则文本',
    ai: 'AI 工具',
    dev: '开发工具',
    hosting: '建站工具',
    security: '安全工具',
    ops: '运维监控',
    design: '设计资源',
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

    if (name === 'cta_action') {
      return base + '：' + pick(CTA_LABELS, data.action);
    }
    if (name === 'tool_click') {
      var cat = pick(CATEGORY_LABELS, data.category);
      return base + '：' + (data.tool_name || data.name || '') + (cat ? '（' + cat + '）' : '');
    }
    if (name === 'tool_used') {
      return base + '：' + pick(TOOL_LABELS, data.tool) + ' · ' + pick(ACTION_LABELS, data.action);
    }
    if (name === 'search_use') {
      return base + '：「' + (data.query || '') + '」' + (data.results != null ? '（' + data.results + ' 条）' : '');
    }
    if (name === 'category_click' || name === 'blog_category' || name === 'prompt_category') {
      return base + '：' + (pick(CATEGORY_LABELS, data.category) || data.category);
    }
    if (name === 'nav_click') {
      return base + '：' + (data.label || data.page || '');
    }
    if (name === 'external_link') {
      return base + '：' + (data.label || data.url || '');
    }
    if (name === 'theme_toggle') {
      return base + '：' + (data.from || '') + ' → ' + (data.to || '');
    }
    if (name === 'favorite_toggle') {
      return base + '：' + (data.tool_name || data.tool_id || '') + '（' + (data.action === 'add' ? '收藏' : '取消') + '）';
    }
    if (name === 'article_click') {
      return base + '：' + (data.title || '');
    }
    if (name === 'ai_path_click') {
      return base + '：' + (data.step || '');
    }
    if (name === 'ai_nav_click') {
      return base + '：' + (data.label || '');
    }
    if (name === 'ai_filter') {
      return base + '：' + (data.scene || '');
    }
    if (name === 'copy_click') {
      return base + '：' + (data.label || data.page || '');
    }
    if (name === 'js_error') {
      return base + '：' + (data.message || '');
    }
    if (name === 'scroll_depth') {
      return base + '：' + (data.depth != null ? data.depth + '%' : '');
    }
    if (name === 'page_exit') {
      return base + '：停留 ' + (data.duration != null ? Math.round(data.duration / 1000) + ' 秒' : '');
    }

    return base;
  }

  // 属性键也改为中文，Umami Properties 面板可直接读
  function toChineseProps(name, data) {
    data = data || {};
    var cn = { 描述: buildDesc(name, data) };

    if (name === 'tool_used') {
      cn['工具'] = pick(TOOL_LABELS, data.tool);
      cn['操作'] = pick(ACTION_LABELS, data.action);
    } else if (name === 'tool_click') {
      cn['工具'] = data.tool_name || data.name || '';
      cn['分类'] = pick(CATEGORY_LABELS, data.category);
    } else if (name === 'category_click' || name === 'blog_category' || name === 'prompt_category') {
      cn['分类'] = pick(CATEGORY_LABELS, data.category) || data.category || '';
    } else if (name === 'search_use') {
      cn['关键词'] = data.query || '';
      if (data.results != null) cn['结果数'] = data.results;
    } else if (name === 'nav_click') {
      cn['链接'] = data.page || '';
      cn['文字'] = data.label || '';
    } else if (name === 'external_link') {
      cn['地址'] = data.url || '';
      cn['文字'] = data.label || '';
    } else if (name === 'cta_action') {
      cn['动作'] = pick(CTA_LABELS, data.action);
      cn['目标'] = data.target || '';
    } else if (name === 'theme_toggle') {
      cn['从'] = data.from || '';
      cn['到'] = data.to || '';
    } else if (name === 'favorite_toggle') {
      cn['工具'] = data.tool_name || data.tool_id || '';
      cn['动作'] = data.action === 'add' ? '收藏' : '取消收藏';
    } else if (name === 'article_click') {
      cn['标题'] = data.title || '';
    } else if (name === 'ai_nav_click' || name === 'ai_path_click') {
      cn['标签'] = data.label || data.step || '';
      cn['页面'] = data.page || '';
    } else if (name === 'ai_filter') {
      cn['场景'] = data.scene || '';
    } else if (name === 'js_error') {
      cn['错误'] = data.message || '';
      cn['来源'] = data.source || '';
      if (data.line) cn['行号'] = data.line;
    } else if (name === 'scroll_depth') {
      cn['深度'] = data.depth;
    } else if (name === 'page_exit') {
      cn['停留毫秒'] = data.duration;
    } else if (name === 'copy_click') {
      cn['页面'] = data.page || '';
      cn['按钮'] = data.label || '';
    }

    return cn;
  }

  function displayName(name) {
    return EVENT_LABELS[name] || name;
  }

  window.umamiEnrich = function (name, data) {
    return toChineseProps(name, data);
  };

  window.umamiTrack = function (name, data) {
    try {
      var cnName = displayName(name);
      var props = toChineseProps(name, data);
      if (typeof umami !== 'undefined' && typeof umami._rawTrack === 'function') {
        umami._rawTrack(cnName, props);
      }
    } catch (_) {}
  };
})();
