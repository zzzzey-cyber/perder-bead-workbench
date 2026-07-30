/* ==================== UI 辅助工具 ==================== */
/* 模态框、Toast、确认框、格式化等通用工具 */

const UI = (function () {

  /* 安全获取元素（处理文本节点等边界情况） */
  function closestAction(el, selector) {
    if (!el) return null;
    if (el.nodeType === 3 && el.parentElement) {
      el = el.parentElement;
    }
    if (typeof el.closest !== 'function') return null;
    return el.closest(selector);
  }

  /* ---------- Toast 提示 ---------- */
  function toast(message, type, duration) {
    type = type || 'info';
    duration = duration || 2500;
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<span class="toast-icon">' + (icons[type] || '') + '</span>' +
      '<span>' + escapeHtml(message) + '</span>';
    container.appendChild(el);
    setTimeout(function () {
      el.classList.add('fade-out');
      setTimeout(function () { el.remove(); }, 250);
    }, duration);
  }

  /* ---------- 模态框 ---------- */
  let modalCounter = 0;

  function modal(options) {
    options = options || {};
    const id = 'modal_' + (++modalCounter);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = id;
    if (options.size === 'lg') {
      // 用 innerHTML 里的 modal 容器加 modal-lg
    }

    const sizeClass = options.size === 'lg' ? 'modal-lg' : '';
    overlay.innerHTML =
      '<div class="modal ' + sizeClass + '">' +
      '  <div class="modal-header">' +
      '    <div class="modal-title">' + escapeHtml(options.title || '提示') + '</div>' +
      '    <button class="modal-close" data-action="close"><span class="modal-close-x">&times;</span></button>' +
      '  </div>' +
      '  <div class="modal-body">' + (options.body || '') + '</div>' +
      '  <div class="modal-footer">' + (options.footer || '') + '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    function close() {
      overlay.classList.remove('active');
      setTimeout(function () { overlay.remove(); }, 150);
      if (typeof options.onClose === 'function') options.onClose();
    }

    // 关闭事件
    overlay.addEventListener('click', function (e) {
      const closeBtn = closestAction(e.target, '[data-action="close"]');
      if (e.target === overlay || closeBtn) {
        if (options.dismissable === false) return;
        close();
      }
    });

    // 显示动画
    requestAnimationFrame(function () {
      overlay.classList.add('active');
    });

    // ESC 关闭
    if (options.dismissable !== false) {
      const escHandler = function (e) {
        if (e.key === 'Escape') {
          close();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }

    return {
      el: overlay,
      close: close,
      on: function (event, handler) {
        if (event === 'submit' || event === 'click') {
          overlay.addEventListener('click', function (e) {
            const actionEl = closestAction(e.target, '[data-action]');
            if (e.target.matches && e.target.matches('[data-action]') || actionEl) {
              handler(e);
            }
          });
        }
      }
    };
  }

  /* ---------- 确认框（返回 Promise） ---------- */
  function confirm(options) {
    options = options || {};
    return new Promise(function (resolve) {
      const body = options.message || '确认执行此操作吗？';
      const detail = options.detail ? '<div class="mt-8 muted small">' + options.detail + '</div>' : '';
      let resolved = false;

      function done(val) {
        if (resolved) return;
        resolved = true;
        resolve(val);
      }

      const m = modal({
        title: options.title || '确认',
        body: '<div>' + escapeHtml(body) + '</div>' + detail,
        footer:
          '<button class="btn" data-action="cancel">' + (options.cancelText || '取消') + '</button>' +
          '<button class="btn ' + (options.danger ? 'btn-danger' : 'btn-primary') + '" data-action="ok">' +
          (options.okText || '确认') + '</button>',
        onClose: function () { done(false); }
      });

      m.el.addEventListener('click', function (e) {
        const actionEl = closestAction(e.target, '[data-action]');
        const action = actionEl ? actionEl.getAttribute('data-action') : '';
        if (action === 'ok') {
          done(true);
          m.close();
        } else if (action === 'cancel') {
          done(false);
          m.close();
        }
      });
    });
  }

  /* ---------- 提示框（单按钮，返回 Promise） ---------- */
  function alert(options) {
    options = options || {};
    return new Promise(function (resolve) {
      let resolved = false;
      function done(val) {
        if (resolved) return;
        resolved = true;
        resolve(val);
      }

      const m = modal({
        title: options.title || '提示',
        body: '<div>' + (options.html || escapeHtml(options.message || '')) + '</div>',
        footer: '<button class="btn btn-primary" data-action="ok">' + (options.okText || '知道了') + '</button>',
        onClose: function () { done(false); }
      });
      m.el.addEventListener('click', function (e) {
        const actionEl = closestAction(e.target, '[data-action]');
        const action = actionEl ? actionEl.getAttribute('data-action') : '';
        if (action === 'ok') {
          done(true);
          m.close();
        }
      });
    });
  }

  /* ---------- HTML 转义 ---------- */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- 格式化时间 ---------- */
  function formatTime(iso, withTime) {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      const pad = function (n) { return n < 10 ? '0' + n : n; };
      const dateStr = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      if (withTime === false) return dateStr;
      return dateStr + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) {
      return iso;
    }
  }

  /* ---------- 相对时间 ---------- */
  function timeAgo(iso) {
    if (!iso) return '-';
    const now = Date.now();
    const t = new Date(iso).getTime();
    const diff = now - t;
    if (diff < 0) return '刚刚';
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + '分钟前';
    const hour = Math.floor(min / 60);
    if (hour < 24) return hour + '小时前';
    const day = Math.floor(hour / 24);
    if (day < 30) return day + '天前';
    return formatTime(iso, false);
  }

  /* ---------- 库存状态计算 ---------- */
  function getBeanStatus(bean) {
    const available = (bean.stock || 0) - (bean.reserved || 0);
    if (bean.stock === 0) {
      return { key: 'out', label: '缺货', class: 'status-out' };
    }
    if (available < 0) {
      return { key: 'insufficient', label: '库存不足', class: 'status-insufficient' };
    }
    if (bean.stock <= (bean.lowStockThreshold || 0)) {
      return { key: 'low', label: '库存偏低', class: 'status-low' };
    }
    return { key: 'ok', label: '库存充足', class: 'status-ok' };
  }

  /* ---------- 可用库存计算 ---------- */
  function getAvailable(bean) {
    return (bean.stock || 0) - (bean.reserved || 0);
  }

  /* ---------- 状态徽章 HTML ---------- */
  function statusBadge(status) {
    return '<span class="badge ' + status.class + '">' + status.label + '</span>';
  }

  /* ---------- 优先级徽章 ---------- */
  function priorityBadge(priority) {
    const map = {
      '高': { label: '高', class: 'priority-high' },
      '中': { label: '中', class: 'priority-medium' },
      '低': { label: '低', class: 'priority-low' }
    };
    const p = map[priority] || map['中'];
    return '<span class="badge ' + p.class + '">' + p.label + '</span>';
  }

  /* ---------- 待拼状态徽章 ---------- */
  function todoStatusBadge(status) {
    const map = {
      '想拼': { label: '想拼', class: 'badge-gray' },
      '准备中': { label: '准备中', class: 'badge-info' },
      '正在拼': { label: '正在拼', class: 'badge-warning' },
      '已完成': { label: '已完成', class: 'badge-success' },
      '已暂停': { label: '已暂停', class: 'badge-gray' },
      '已取消': { label: '已取消', class: 'badge-gray' }
    };
    const s = map[status] || map['想拼'];
    return '<span class="badge ' + s.class + '">' + s.label + '</span>';
  }

  /* ---------- 变动类型标签 ---------- */
  function recordTypeBadge(type) {
    const map = {
      '手动入库': { label: '手动入库', class: 'badge-success' },
      '手动减少': { label: '手动减少', class: 'badge-warning' },
      '开始制作扣减': { label: '制作扣减', class: 'badge-danger' },
      '取消制作返还': { label: '取消返还', class: 'badge-info' }
    };
    const t = map[type] || { label: type, class: 'badge-gray' };
    return '<span class="badge ' + t.class + '">' + t.label + '</span>';
  }

  /* ---------- 空状态 ---------- */
  function emptyState(icon, text) {
    return '<div class="empty-state">' +
      '<div class="empty-state-icon">' + (icon || '📋') + '</div>' +
      '<div class="empty-state-text">' + escapeHtml(text || '暂无数据') + '</div>' +
      '</div>';
  }

  /* ---------- 读取图片为 DataURL（带压缩） ---------- */
  function readImage(file, callback) {
    if (!file) { callback(''); return; }
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件', 'error');
      callback('');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('图片不能超过 5MB', 'warning');
      callback('');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var maxSize = 600;
        var w = img.width;
        var h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        var data = canvas.toDataURL('image/jpeg', 0.6);
        callback(data);
      };
      img.onerror = function () { toast('图片处理失败', 'error'); callback(''); };
      img.src = e.target.result;
    };
    reader.onerror = function () { toast('读取图片失败', 'error'); callback(''); };
    reader.readAsDataURL(file);
  }

  /* ---------- HTML 转义 ---------- */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- 数字格式化 ---------- */
  function formatNumber(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString('zh-CN');
  }

  return {
    toast: toast,
    modal: modal,
    confirm: confirm,
    alert: alert,
    closestAction: closestAction,
    getBeanStatus: getBeanStatus,
    getAvailable: getAvailable,
    statusBadge: statusBadge,
    priorityBadge: priorityBadge,
    todoStatusBadge: todoStatusBadge,
    recordTypeBadge: recordTypeBadge,
    emptyState: emptyState,
    readImage: readImage,
    escapeHtml: escapeHtml,
    formatNumber: formatNumber,
    formatTime: formatTime,
    timeAgo: timeAgo
  };
})();
