/**
 * OP-103：通用 Toast 组件
 * 依赖：无（纯 Vanilla，挂载到 window.Toast）
 * 接口：
 *   Toast.show({
 *     type: 'error' | 'info' | 'success',
 *     title?: string,
 *     msg: string,
 *     fixHint?: string,
 *     actionText?: string,
 *     onAction?: () => void,
 *     duration?: number,
 *     op?: string   // Umami event OP 标签
 *   })
 */
(function () {
  var STACK_ID = 'toastStack';

  function ensureStack() {
    var existing = document.getElementById(STACK_ID);
    if (existing) return existing;
    var stack = document.createElement('div');
    stack.id = STACK_ID;
    stack.className = 'toast-stack';
    stack.setAttribute('role', 'region');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
    return stack;
  }

  function track(label, extra) {
    try {
      if (typeof window.umami === 'object' && typeof window.umami.track === 'function') {
        window.umami.track(label, extra || {});
      }
    } catch (_) {}
  }

  function show(opts) {
    if (!opts || !opts.msg) return;
    var type = opts.type || 'info';
    var duration = typeof opts.duration === 'number' ? opts.duration : (type === 'error' ? 8000 : 4000);
    var stack = ensureStack();
    var el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');

    var body = document.createElement('div');
    body.className = 'toast__msg';
    if (opts.title) {
      var s = document.createElement('strong');
      s.textContent = opts.title;
      body.appendChild(s);
    }
    var m = document.createElement('div');
    m.textContent = opts.msg;
    body.appendChild(m);
    if (opts.fixHint) {
      var h = document.createElement('div');
      h.className = 'toast__hint';
      h.textContent = '💡 ' + opts.fixHint;
      body.appendChild(h);
    }
    if (opts.actionText && typeof opts.onAction === 'function') {
      var a = document.createElement('button');
      a.type = 'button';
      a.className = 'toast__action';
      a.textContent = opts.actionText;
      a.addEventListener('click', function () {
        try { opts.onAction(); } catch (_) {}
        track('toast_action_click', { op: opts.op || 'OP-103' });
        remove();
      }, { once: true });
      body.appendChild(a);
    }
    el.appendChild(body);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast__close';
    close.setAttribute('aria-label', '关闭提示');
    close.innerHTML = '&times;';
    close.addEventListener('click', remove, { once: true });
    el.appendChild(close);

    stack.appendChild(el);
    var timer = duration > 0 ? setTimeout(remove, duration) : null;
    function remove() {
      if (timer) clearTimeout(timer);
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    track('toast_show', { op: opts.op || 'OP-103', type: type });
    return { close: remove };
  }

  window.Toast = { show: show };
})();
