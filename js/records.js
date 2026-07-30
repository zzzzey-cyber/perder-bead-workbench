/* ==================== 库存记录 - 变动历史 ==================== */

const RecordsPage = (function () {
  let filters = { type: '', search: '' };

  /* ---------- 渲染页面 ---------- */
  function render() {
    const records = Storage.getRecords();
    const types = ['手动入库', '手动减少', '开始制作扣减', '取消制作返还'];

    const html =
      '<div class="page-header">' +
      '  <div>' +
      '    <h1 class="page-title">库存记录</h1>' +
      '    <div class="page-subtitle">查看所有库存变动历史</div>' +
      '  </div>' +
      '</div>' +

      '<div class="toolbar">' +
      '  <div class="search-box">' +
      '    <input type="text" id="recordSearch" placeholder="搜索色号、颜色名称…" value="' + UI.escapeHtml(filters.search) + '">' +
      '  </div>' +
      '  <select id="recordTypeFilter">' +
      '    <option value="">全部类型</option>' +
      types.map(t => '<option value="' + t + '"' + (filters.type === t ? ' selected' : '') + '>' + t + '</option>').join('') +
      '  </select>' +
      '</div>' +

      renderTable(records);

    document.getElementById('page-records').innerHTML = html;
    bindEvents();
  }

  function renderTable(records) {
    const filtered = filterRecords(records);
    if (filtered.length === 0) {
      return UI.emptyState('📋', '还没有库存记录');
    }

    // 倒序（最新在前）
    filtered.sort((a, b) => (b.time || '').localeCompare(a.time || ''));

    let rows = '';
    filtered.forEach(r => {
      const isPositive = (r.delta || 0) > 0;
      rows +=
        '<tr>' +
        '  <td>' +
        '    <div class="text-bold">' + UI.escapeHtml(r.brand) + ' ' + UI.escapeHtml(r.colorCode) + '</div>' +
        '    <div class="small muted">' + UI.escapeHtml(r.colorName || '') + '</div>' +
        '  </td>' +
        '  <td>' + UI.recordTypeBadge(r.type) + '</td>' +
        '  <td class="text-right">' + UI.formatNumber(r.before) + '</td>' +
        '  <td class="text-right ' + (isPositive ? 'text-success' : 'text-danger') + '">' +
        (isPositive ? '+' : '') + UI.formatNumber(r.delta) +
        '</td>' +
        '  <td class="text-right text-bold">' + UI.formatNumber(r.after) + '</td>' +
        '  <td>' +
        (r.patternName ? '<span class="small">' + UI.escapeHtml(r.patternName) + '</span>' : '<span class="muted">-</span>') +
        '</td>' +
        '  <td>' +
        (r.note ? '<span class="small">' + UI.escapeHtml(r.note) + '</span>' : '<span class="muted">-</span>') +
        '</td>' +
        '  <td class="small muted">' + UI.formatTime(r.time) + '</td>' +
        '</tr>';
    });

    return '' +
      '<div class="table-wrap">' +
      '<table>' +
      '  <thead><tr>' +
      '    <th>品牌 / 色号</th>' +
      '    <th>变动类型</th>' +
      '    <th class="text-right">变动前</th>' +
      '    <th class="text-right">变动量</th>' +
      '    <th class="text-right">变动后</th>' +
      '    <th>关联图纸</th>' +
      '    <th>备注</th>' +
      '    <th>操作时间</th>' +
      '  </tr></thead>' +
      '  <tbody>' + rows + '</tbody>' +
      '</table>' +
      '</div>';
  }

  function filterRecords(records) {
    return records.filter(r => {
      if (filters.type && r.type !== filters.type) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const text = (r.brand + ' ' + r.colorCode + ' ' + (r.colorName || '')).toLowerCase();
        if (text.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  let eventsBound = false;
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const page = document.getElementById('page-records');

    page.querySelector('#recordSearch').addEventListener('input', function (e) {
      filters.search = e.target.value;
      refreshTable();
    });

    page.querySelector('#recordTypeFilter').addEventListener('change', function (e) {
      filters.type = e.target.value;
      refreshTable();
    });
  }

  function refreshTable() {
    const records = Storage.getRecords();
    const wrap = document.querySelector('#page-records .table-wrap');
    if (wrap) {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderTable(records);
      const newWrap = tmp.firstChild;
      if (newWrap) wrap.replaceWith(newWrap);
    }
  }

  return { render: render, refresh: render };
})();
