/**
 * OP-102：新手引导 4 步 Tour（localStorage.tour_done_v1 记录完成状态）
 * 4 Step：① 欢迎 ② 自研工具区高亮（.self-built-tools-area）③ 收藏入口（#fav-entry-anchor）④ JSON 工作台卡片
 */
(function () {
  var KEY = 'tour_done_v1';
  function track(label, extra) {
    try {
      if (typeof window.umami === 'object' && typeof window.umami.track === 'function') {
        window.umami.track(label, Object.assign({ op: 'OP-102' }, extra || {}));
      }
    } catch (_) {}
  }
  function isDone() {
    try {
      var r = JSON.parse(localStorage.getItem(KEY) || 'null');
      return !!(r && r.v === 1 && r.completedSteps >= 1);
    } catch (_) { return false; }
  }
  function markDone(step, skipped) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
      v: 1,
      at: Date.now(),
      completedSteps: step || 4,
      skipped: !!skipped
    }));
    } catch (_) {}
  }

  var STEPS = [
    {
      title: '👋 欢迎来到 Koen 工具箱',
      desc: '这是你的专属开发者工具箱。4 步快速了解怎么用好它（不到 30 秒）。',
      target: null,
      pos: 'center'
    },
    {
      title: '🛠️ 10 款可直接运行的站内工具',
      desc: '不用跳外链啦，这里 10 款全部浏览器内计算：JSON/JWT/Cron 等，打开就用。',
      targetSel: '.self-built-tools-area',
      pos: 'bottom'
    },
    {
      title: '❤️ 最近使用 · 我的收藏',
      desc: '喜欢的工具点卡片右上角 🤍 收藏；下次回访直接从这里进。',
      targetSel: '#fav-entry-anchor',
      pos: 'bottom'
    },
    {
      title: '🎯 新手推荐：JSON 工作台',
      desc: '最热门工具：实时诊断、树视图、YAML、Diff、JSONPath，点「完成直达。',
      targetSel: '.v2-tool-card[data-tool-id="json"]',
      pos: 'top',
      ctaText: '打开 JSON 工作台',
      ctaHref: 'tools/json/'
    }
  ];

  function createBackdrop() {
    var b = document.createElement('div');
    b.className = 'tour-backdrop';
    document.body.appendChild(b);
    return b;
  }
  function createTooltip(step, stepIdx) {
    var wrap = document.createElement('div');
    wrap.className = 'tour-tooltip';
    wrap.innerHTML =
      '<div class="tour-tooltip__step">Step ' + (stepIdx + 1) + ' / ' + STEPS.length + '</div>' +
      '<div class="tour-tooltip__title"></div>' +
      '<div class="tour-tooltip__desc"></div>' +
      '<div class="tour-tooltip__actions">' +
        '<button class="tour-tooltip__skip" type="button">跳过引导</button>' +
        '<button class="tour-tooltip__next" type="button">' + (stepIdx === STEPS.length - 1 ? '✅ 完成' : '下一步 →') + '</button>' +
      '</div>';
    wrap.querySelector('.tour-tooltip__title').textContent = step.title;
    wrap.querySelector('.tour-tooltip__desc').textContent = step.desc;
    document.body.appendChild(wrap);
    return wrap;
  }
  function positionTooltip(tooltip, step) {
    var tRect;
    var target = step.targetSel ? document.querySelector(step.targetSel) : null;
    var tw = tooltip.offsetWidth;
    var th = tooltip.offsetHeight;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var pad = 16;
    var top, left;
    if (step.pos === 'center' || !target) {
      left = Math.max(pad, (w - tw) / 2);
      top = Math.max(pad, (h - th) / 2.2);
    } else {
      target.classList.add('tour-highlight');
      var r = target.getBoundingClientRect();
      if (step.pos === 'bottom') {
        left = Math.min(w - tw - pad, Math.max(pad, r.left + r.width / 2 - tw / 2));
        top = Math.min(h - th - pad, r.bottom + 12);
        if (top + th > h - pad) { top = Math.max(pad, r.top - th - 12); step.pos = 'top'; }
      } else { // top
        left = Math.min(w - tw - pad, Math.max(pad, r.left + r.width / 2 - tw / 2));
        top = Math.max(pad, r.top - th - 12);
      }
    }
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }
  function clearHighlight() {
    document.querySelectorAll('.tour-highlight').forEach(function (el) { el.classList.remove('tour-highlight'); });
  }

  function run() {
    if (isDone()) return;
    track('tour_start');
    var backdrop = createBackdrop();
    setTimeout(function () { backdrop.classList.add('is-open'); }, 0);
    var idx = 0;
    var tooltip = null;
    function showStep(i) {
      if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      clearHighlight();
      if (i >= STEPS.length) { finish(false); return; }
      var step = STEPS[i];
      tooltip = createTooltip(step, i);
      // 延迟定位（等 render 完）
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { positionTooltip(tooltip, step); });
      });
      var target = step.targetSel ? document.querySelector(step.targetSel) : null;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tooltip.querySelector('.tour-tooltip__skip').addEventListener('click', function () { finish(true); });
      tooltip.querySelector('.tour-tooltip__next').addEventListener('click', function () {
        track('tour_step_next', { from: i });
        if (i === STEPS.length - 1 && step.ctaHref) {
          finish(false);
          setTimeout(function () { window.location.href = step.ctaHref; }, 120);
        } else {
          showStep(i + 1);
        }
      });
    }
    function finish(skipped) {
      track(skipped ? 'tour_skipped' : 'tour_completed', { steps: idx });
      markDone(idx + 1, skipped);
      clearHighlight();
      backdrop.classList.remove('is-open');
      setTimeout(function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (tooltip && tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
      }, 200);
    }
    showStep(0);
    window.addEventListener('resize', function () {
      if (!tooltip) return;
      positionTooltip(tooltip, STEPS[idx]);
    }, { passive: true });
  }

  window.runTourIfNeeded = run;
  // 启动
  function boot() {
    // 用户刚加载完成后再启动，避免 layout 偏移
    setTimeout(run, 600);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
