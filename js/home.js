/* ==================== 首页 - 数据看板 ==================== */

const HomePage = (function () {

  function render() {
    const beans = Storage.getBeans();
    const todos = Storage.getTodos();
    const records = Storage.getRecords();

    // 统计数据
    const stats = computeStats(beans, todos);
    const lowStockBeans = beans.filter(b => {
      const s = UI.getBeanStatus(b);
      return s.key === 'low' || s.key === 'out' || s.key === 'insufficient';
    });

    // 最近库存变动（5条）
    const recentRecords = records.slice().sort((a, b) => (b.time || '').localeCompare(a.time || '')).slice(0, 5);

    // 最近待拼项目（5个，排除已取消和已完成）
    const recentTodos = todos.filter(t => t.status !== '已取消' && t.status !== '已完成')
      .sort((a, b) => {
        const order = { '正在拼': 0, '准备中': 1, '想拼': 2, '已暂停': 3 };
        return (order[a.status] || 9) - (order[b.status] || 9);
      }).slice(0, 5);

    // 低库存提醒
    let lowStockAlert = '';
    if (lowStockBeans.length > 0) {
      let items = '';
      lowStockBeans.forEach(b => {
        const status = UI.getBeanStatus(b);
        items +=
          '<div class="flex-between" style="padding:6px 0;border-bottom:1px dashed var(--gray-200)">' +
          '  <div>' +
          '    <span class="text-bold">' + UI.escapeHtml(b.brand) + ' ' + UI.escapeHtml(b.colorCode) + '</span>' +
          '    <span class="muted small"> · ' + UI.escapeHtml(b.colorName || '') + '</span>' +
          '  </div>' +
          '  <div class="flex gap-8" style="align-items:center">' +
          UI.statusBadge(status) +
          '<span class="small">库存 ' + b.stock + ' / 可用 ' + UI.getAvailable(b) + '</span>' +
          '  </div>' +
          '</div>';
      });

      const alertClass = lowStockBeans.some(b => UI.getBeanStatus(b).key === 'out') ? 'alert-danger' : 'alert-warning';
      lowStockAlert =
        '<div class="alert ' + alertClass + '">' +
        '  <span class="alert-icon">⚠</span>' +
        '  <div style="flex:1">' +
        '    <div class="text-bold mb-8">低库存提醒（' + lowStockBeans.length + ' 个色号需要补货）</div>' +
        items +
        '  </div>' +
        '</div>';
    }

    // 导入提示：只有测试数据或没有数据时显示
    const hasRealData = beans.length > 3;
    const importAlert = hasRealData ? '' :
      '<div class="alert alert-info" style="margin-bottom:16px">' +
      '  <span class="alert-icon">📦</span>' +
      '  <div style="flex:1">' +
      '    <div class="text-bold mb-4">发现可导入的库存数据</div>' +
      '    <div class="small muted mb-8">你的 Excel 库存文件中有 221 条 Mard 色号记录，共约 22.3 万颗豆子。</div>' +
      '    <button class="btn btn-primary" data-action="import-inventory">导入我的库存</button>' +
      '  </div>' +
      '</div>';

    const html =
      '<div class="page-header">' +
      '  <div>' +
      '    <h1 class="page-title">拼豆工作台</h1>' +
      '    <div class="page-subtitle">欢迎回来，这是你的拼豆管理概览</div>' +
      '  </div>' +
      '</div>' +

      importAlert +

      // 统计卡片
      '<div class="stats-grid">' +
      statCard('色号总数', stats.totalColors, '种', 'blue') +
      statCard('豆子总数量', stats.totalStock, '颗', 'teal') +
      statCard('可用豆子总量', stats.totalAvailable, '颗', 'green') +
      statCard('低库存色号', stats.lowStockCount, '个', 'red') +
      statCard('待拼项目', stats.pendingCount, '个', 'orange') +
      statCard('正在拼', stats.inProgressCount, '个', 'orange') +
      statCard('已完成', stats.completedCount, '个', 'green') +
      '</div>' +

      // 低库存提醒
      lowStockAlert +

      // 最近库存变动 + 最近待拼
      '<div class="flex gap-12" style="flex-wrap:wrap">' +
      '  <div style="flex:1;min-width:300px">' +
      renderRecentRecords(recentRecords) +
      '  </div>' +
      '  <div style="flex:1;min-width:300px">' +
      renderRecentTodos(recentTodos) +
      '  </div>' +
      '</div>';

    document.getElementById('page-home').innerHTML = html;
    bindEvents();
  }

  function statCard(label, value, unit, color) {
    return '<div class="stat-card ' + color + '">' +
      '<div class="stat-label">' + label + '</div>' +
      '<div class="stat-value">' + UI.formatNumber(value) + '<span class="stat-unit">' + unit + '</span></div>' +
      '</div>';
  }

  function computeStats(beans, todos) {
    const totalColors = beans.length;
    const totalStock = beans.reduce((s, b) => s + (b.stock || 0), 0);
    const totalAvailable = beans.reduce((s, b) => s + Math.max(0, UI.getAvailable(b)), 0);
    const lowStockCount = beans.filter(b => {
      const s = UI.getBeanStatus(b);
      return s.key === 'low' || s.key === 'out' || s.key === 'insufficient';
    }).length;
    const pendingCount = todos.filter(t => t.status === '想拼' || t.status === '准备中' || t.status === '已暂停').length;
    const inProgressCount = todos.filter(t => t.status === '正在拼').length;
    const completedCount = todos.filter(t => t.status === '已完成').length;

    return {
      totalColors, totalStock, totalAvailable, lowStockCount,
      pendingCount, inProgressCount, completedCount
    };
  }

  function renderRecentRecords(records) {
    if (records.length === 0) {
      return '<div class="card"><div class="card-title">最近库存变动</div>' + UI.emptyState('📋', '暂无库存变动') + '</div>';
    }

    let rows = '';
    records.forEach(r => {
      const isPositive = (r.delta || 0) > 0;
      rows +=
        '<div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">' +
        '  <div>' +
        '    <div class="small text-bold">' + UI.escapeHtml(r.brand) + ' ' + UI.escapeHtml(r.colorCode) + '</div>' +
        '    <div class="small muted">' + UI.recordTypeBadge(r.type) + ' · ' + UI.timeAgo(r.time) + '</div>' +
        '  </div>' +
        '  <div class="text-right">' +
        '    <div class="text-bold ' + (isPositive ? 'text-success' : 'text-danger') + '">' +
        (isPositive ? '+' : '') + UI.formatNumber(r.delta) + '</div>' +
        '    <div class="small muted">余 ' + UI.formatNumber(r.after) + '</div>' +
        '  </div>' +
        '</div>';
    });

    return '<div class="card">' +
      '<div class="flex-between mb-12">' +
      '  <div class="card-title" style="margin-bottom:0">最近库存变动</div>' +
      '  <a data-nav="records" style="font-size:13px;cursor:pointer">查看全部 →</a>' +
      '</div>' +
      rows +
      '</div>';
  }

  function renderRecentTodos(todos) {
    if (todos.length === 0) {
      return '<div class="card"><div class="card-title">最近的待拼项目</div>' + UI.emptyState('📝', '暂无待拼项目') + '</div>';
    }

    let rows = '';
    todos.forEach(t => {
      rows +=
        '<div class="flex-between" style="padding:8px 0;border-bottom:1px solid var(--gray-100)">' +
        '  <div style="flex:1">' +
        '    <div class="small text-bold">' + UI.escapeHtml(t.patternName) + ' x' + t.quantity + '</div>' +
        '    <div class="small muted">' + UI.priorityBadge(t.priority) + ' ' + UI.todoStatusBadge(t.status) + '</div>' +
        '  </div>' +
        '  <div class="text-right small muted">' + UI.timeAgo(t.createdAt) + '</div>' +
        '</div>';
    });

    return '<div class="card">' +
      '<div class="flex-between mb-12">' +
      '  <div class="card-title" style="margin-bottom:0">最近的待拼项目</div>' +
      '  <a data-nav="todo" style="font-size:13px;cursor:pointer">查看全部 →</a>' +
      '</div>' +
      rows +
      '</div>';
  }

  let eventsBound = false;
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const page = document.getElementById('page-home');
    page.addEventListener('click', function (e) {
      const nav = UI.closestAction(e.target, '[data-nav]');
      if (nav) {
        App.navigate(nav.getAttribute('data-nav'));
        return;
      }

      const action = UI.closestAction(e.target, '[data-action]');
      if (action) {
        const act = action.getAttribute('data-action');
        if (act === 'import-inventory') {
          UI.confirm({
            title: '导入库存数据',
            message: '即将导入 221 条 Mard 色号库存数据，这会覆盖现有的测试数据。',
            detail: '导入后你可以在「我的豆子」页面查看和管理所有色号。',
            okText: '确认导入',
            danger: false
          }).then(function(ok) {
            if (ok && typeof importMyInventory === 'function') {
              importMyInventory(true);
            }
          });
        }
      }
    });
  }

  return { render: render, refresh: render };
})();
