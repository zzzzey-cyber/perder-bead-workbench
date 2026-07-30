/* ==================== 我的豆子 - 库存管理 ==================== */

const BeansPage = (function () {
  let filters = { search: '', brand: '', lowOnly: false };

  /* ---------- 渲染页面 ---------- */
  function render() {
    const beans = Storage.getBeans();
    const brands = getBrandList(beans);

    const html =
      '<div class="page-header">' +
      '  <div>' +
      '    <h1 class="page-title">我的豆子</h1>' +
      '    <div class="page-subtitle">管理拼豆色号库存</div>' +
      '  </div>' +
      '  <button class="btn btn-primary" data-action="add">+ 新增色号</button>' +
      '</div>' +

      '<div class="toolbar">' +
      '  <div class="search-box">' +
      '    <input type="text" id="beanSearch" placeholder="搜索品牌、色号或颜色名称…" value="' + UI.escapeHtml(filters.search) + '">' +
      '  </div>' +
      '  <select id="beanBrandFilter">' +
      '    <option value="">全部品牌</option>' +
      brands.map(b => '<option value="' + UI.escapeHtml(b) + '"' + (filters.brand === b ? ' selected' : '') + '>' + UI.escapeHtml(b) + '</option>').join('') +
      '  </select>' +
      '  <label class="checkbox-item"><input type="checkbox" id="beanLowOnly"' + (filters.lowOnly ? ' checked' : '') + '> 只看低库存</label>' +
      '</div>' +

      renderTable(beans);

    document.getElementById('page-beans').innerHTML = html;
    bindEvents();
  }

  /* ---------- 渲染表格 ---------- */
  function renderTable(beans) {
    const filtered = filterBeans(beans);
    if (filtered.length === 0) {
      return UI.emptyState('🫘', '还没有豆子库存，点击"新增色号"添加');
    }

    let rows = '';
    filtered.forEach(bean => {
      const status = UI.getBeanStatus(bean);
      const available = UI.getAvailable(bean);
      rows +=
        '<tr>' +
        '  <td class="text-center"><input type="checkbox" class="row-checkbox" data-id="' + bean.id + '"></td>' +
        '  <td>' +
        '    <div class="text-bold">' + UI.escapeHtml(bean.brand) + '</div>' +
        '    <div class="small muted">' + UI.escapeHtml(bean.id.substr(0, 12)) + '…</div>' +
        '  </td>' +
        '  <td>' +
        '    <div class="text-bold">' + UI.escapeHtml(bean.colorCode) + '</div>' +
        '    <div class="small muted">' + UI.escapeHtml(bean.colorName || '') + '</div>' +
        '  </td>' +
        '  <td class="text-center">' + UI.statusBadge(status) + '</td>' +
        '  <td class="text-right text-bold">' + UI.formatNumber(bean.stock) + '</td>' +
        '  <td class="text-right text-warning">' + UI.formatNumber(bean.reserved || 0) + '</td>' +
        '  <td class="text-right text-success text-bold' + (available < 0 ? ' text-danger' : '') + '">' + UI.formatNumber(available) + '</td>' +
        '  <td class="text-right muted">' + UI.formatNumber(bean.lowStockThreshold) + '</td>' +
        '  <td>' + (bean.note ? '<span class="small">' + UI.escapeHtml(bean.note) + '</span>' : '<span class="muted">-</span>') + '</td>' +
        '  <td class="small muted">' + UI.formatTime(bean.updatedAt) + '</td>' +
        '  <td class="text-center">' +
        '    <div class="flex gap-8" style="justify-content:center;flex-wrap:wrap">' +
        '      <button class="btn btn-sm btn-outline" data-action="in" data-id="' + bean.id + '">入库</button>' +
        '      <button class="btn btn-sm btn-outline" data-action="out" data-id="' + bean.id + '">减少</button>' +
        '      <button class="btn btn-sm" data-action="edit" data-id="' + bean.id + '">编辑</button>' +
        '      <button class="btn btn-sm btn-danger" data-action="delete" data-id="' + bean.id + '">删除</button>' +
        '    </div>' +
        '  </td>' +
        '</tr>';
    });

    return '' +
      '<div class="table-area">' +
      '  <div class="batch-bar" style="padding:8px 0;display:flex;align-items:center;gap:12px">' +
      '    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px">' +
      '      <input type="checkbox" id="selectAll"> 全选' +
      '    </label>' +
      '    <span class="small muted" id="selectedCount"></span>' +
      '    <button class="btn btn-sm btn-danger" data-action="batchDelete" style="margin-left:auto">删除选中</button>' +
      '  </div>' +
      '  <div class="table-wrap">' +
      '  <table>' +
      '    <thead><tr>' +
      '      <th class="text-center"><input type="checkbox" id="selectAllHeader"></th>' +
      '      <th>品牌</th>' +
      '      <th>色号 / 名称</th>' +
      '      <th class="text-center">状态</th>' +
      '      <th class="text-right">当前库存</th>' +
      '      <th class="text-right">已预留</th>' +
      '      <th class="text-right">可用库存</th>' +
      '      <th class="text-right">低库存提醒</th>' +
      '      <th>备注</th>' +
      '      <th>更新时间</th>' +
      '      <th class="text-center">操作</th>' +
      '    </tr></thead>' +
      '    <tbody>' + rows + '</tbody>' +
      '  </table>' +
      '  </div>' +
      '</div>';
  }

  /* ---------- 筛选 ---------- */
  function filterBeans(beans) {
    return beans.filter(bean => {
      if (filters.brand && bean.brand !== filters.brand) return false;
      if (filters.lowOnly) {
        const status = UI.getBeanStatus(bean);
        if (status.key !== 'low' && status.key !== 'out' && status.key !== 'insufficient') return false;
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const text = (bean.brand + ' ' + bean.colorCode + ' ' + (bean.colorName || '')).toLowerCase();
        if (text.indexOf(q) === -1) return false;
      }
      return true;
    }).sort((a, b) => (a.brand + a.colorCode).localeCompare(b.brand + b.colorCode));
  }

  function getBrandList(beans) {
    const set = {};
    beans.forEach(b => { set[b.brand] = true; });
    return Object.keys(set).sort();
  }

  /* ---------- 事件绑定 ---------- */
  let eventsBound = false;
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const page = document.getElementById('page-beans');

    // 使用事件委托，绑定在 page 容器上，避免 render 替换 innerHTML 后事件丢失
    page.addEventListener('input', function (e) {
      if (e.target.id === 'beanSearch') {
        filters.search = e.target.value;
        refreshTable();
      }
    });

    page.addEventListener('change', function (e) {
      if (e.target.id === 'beanBrandFilter') {
        filters.brand = e.target.value;
        refreshTable();
      } else if (e.target.id === 'beanLowOnly') {
        filters.lowOnly = e.target.checked;
        refreshTable();
      } else if (e.target.id === 'selectAll' || e.target.id === 'selectAllHeader') {
        const checked = e.target.checked;
        page.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = checked; });
        page.querySelector('#selectAll').checked = checked;
        page.querySelector('#selectAllHeader').checked = checked;
        updateSelectedCount();
      } else if (e.target.classList.contains('row-checkbox')) {
        updateSelectedCount();
      }
    });

    page.addEventListener('click', function (e) {
      const btn = UI.closestAction(e.target, '[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'add') showEditModal(null);
      else if (action === 'edit') {
        const bean = Storage.getBeanById(id);
        if (bean) showEditModal(bean);
      }
      else if (action === 'delete') handleDelete(id);
      else if (action === 'in') showStockModal(id, 'in');
      else if (action === 'out') showStockModal(id, 'out');
      else if (action === 'batchDelete') handleBatchDelete();
    });
  }

  function updateSelectedCount() {
    const count = document.querySelectorAll('.row-checkbox:checked').length;
    const el = document.getElementById('selectedCount');
    if (el) el.textContent = count > 0 ? '已选 ' + count + ' 项' : '';
  }

  /* ---------- 批量删除 ---------- */
  function handleBatchDelete() {
    const checked = document.querySelectorAll('.row-checkbox:checked');
    if (checked.length === 0) {
      UI.toast('请先选择要删除的色号', 'warning');
      return;
    }

    const ids = Array.from(checked).map(cb => cb.getAttribute('data-id'));
    const beans = ids.map(id => Storage.getBeanById(id)).filter(Boolean);

    // 检查是否有预留库存
    const reserved = beans.filter(b => (b.reserved || 0) > 0);
    if (reserved.length > 0) {
      const list = reserved.map(b => b.brand + ' ' + b.colorCode).join('、');
      UI.alert({
        title: '无法删除',
        message: '以下 ' + reserved.length + ' 个色号有预留库存，请先取消相关待拼项目后再删除：',
        detail: list,
        okText: '知道了'
      });
      return;
    }

    UI.confirm({
      title: '批量删除色号',
      message: '确认删除选中的 ' + beans.length + ' 个色号吗？',
      detail: '此操作不可恢复，这些色号的库存将被清空。',
      danger: true,
      okText: '确认删除'
    }).then(ok => {
      if (ok) {
        let deleted = 0;
        ids.forEach(id => {
          if (Storage.deleteBean(id)) deleted++;
        });
        UI.toast('已删除 ' + deleted + ' 个色号', 'success');
        render();
        App.updateNavCounts();
      }
    });
  }

  function refreshTable() {
    const beans = Storage.getBeans();
    const area = document.querySelector('#page-beans .table-area');
    if (area) {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderTable(beans);
      if (tmp.firstChild) {
        area.replaceWith(tmp.firstChild);
      }
    } else {
      // 如果整个表格区域都不存在（空状态后恢复），需要重新渲染整个页面
      render();
    }
  }

  /* ---------- 新增/编辑色号 ---------- */
  function showEditModal(bean) {
    const isEdit = !!bean;
    const brands = getBrandList(Storage.getBeans());

    const html =
      '<form id="beanForm">' +
      '  <div class="form-row">' +
      '    <div class="form-group">' +
      '      <label>品牌 <span class="required">*</span></label>' +
      '      <input class="form-control" name="brand" list="brandList" required value="' + UI.escapeHtml(bean ? bean.brand : '') + '" placeholder="如 Mard">' +
      '      <datalist id="brandList">' + brands.map(b => '<option value="' + UI.escapeHtml(b) + '">').join('') + '</datalist>' +
      '    </div>' +
      '    <div class="form-group">' +
      '      <label>色号 <span class="required">*</span></label>' +
      '      <input class="form-control" name="colorCode" required value="' + UI.escapeHtml(bean ? bean.colorCode : '') + '" placeholder="如 A01">' +
      '    </div>' +
      '  </div>' +
      '  <div class="form-row">' +
      '    <div class="form-group">' +
      '      <label>颜色名称</label>' +
      '      <input class="form-control" name="colorName" value="' + UI.escapeHtml(bean ? bean.colorName : '') + '" placeholder="如 白色">' +
      '    </div>' +
      '    <div class="form-group">' +
      '      <label>低库存提醒数量</label>' +
      '      <input class="form-control" type="number" min="0" name="lowStockThreshold" value="' + (bean ? bean.lowStockThreshold : 100) + '">' +
      '    </div>' +
      '  </div>' +
      (isEdit ? '' :
      '  <div class="form-group">' +
      '    <label>初始库存数量</label>' +
      '    <input class="form-control" type="number" min="0" name="stock" value="0">' +
      '    <div class="small muted mt-8">新增色号时填入初始库存，之后请通过"入库"调整</div>' +
      '  </div>') +
      '  <div class="form-group">' +
      '    <label>备注</label>' +
      '    <textarea class="form-control" name="note" placeholder="可选">' + UI.escapeHtml(bean ? bean.note : '') + '</textarea>' +
      '  </div>' +
      '</form>';

    const m = UI.modal({
      title: isEdit ? '编辑色号' : '新增色号',
      body: html,
      footer:
        '<button class="btn" data-action="close">取消</button>' +
        '<button class="btn btn-primary" data-action="save">保存</button>'
    });

    m.el.querySelector('[data-action="save"]').addEventListener('click', function () {
      const form = m.el.querySelector('#beanForm');
      const data = {};
      new FormData(form).forEach((v, k) => { data[k] = v; });

      if (!data.brand || !data.colorCode) {
        UI.toast('请填写品牌和色号', 'error');
        return;
      }

      // 检查重复（同品牌+色号）
      const existing = Storage.getBeanByCode(data.brand, data.colorCode);
      if (existing && (!isEdit || existing.id !== bean.id)) {
        UI.toast('该品牌下已存在相同色号', 'error');
        return;
      }

      const obj = {
        brand: data.brand.trim(),
        colorCode: data.colorCode.trim(),
        colorName: data.colorName.trim(),
        lowStockThreshold: parseInt(data.lowStockThreshold) || 0,
        note: data.note.trim()
      };

      if (isEdit) {
        obj.id = bean.id;
        obj.stock = bean.stock;
        obj.reserved = bean.reserved;
        obj.createdAt = bean.createdAt;
        Storage.saveBean(obj);
        UI.toast('已更新色号', 'success');
      } else {
        obj.stock = parseInt(data.stock) || 0;
        Storage.saveBean(obj);
        // 如果初始库存大于0，记录一条入库
        if (obj.stock > 0) {
          const saved = Storage.getBeanByCode(obj.brand, obj.colorCode);
          if (saved) {
            Storage.addRecord({
              brand: saved.brand,
              colorCode: saved.colorCode,
              colorName: saved.colorName,
              type: '手动入库',
              before: 0,
              delta: saved.stock,
              after: saved.stock,
              note: '新增色号初始库存'
            });
          }
        }
        UI.toast('已新增色号', 'success');
      }

      m.close();
      render();
      App.updateNavCounts();
    });
  }

  /* ---------- 入库 / 减少库存 ---------- */
  function showStockModal(id, type) {
    const bean = Storage.getBeanById(id);
    if (!bean) return;
    const isIn = type === 'in';
    const available = UI.getAvailable(bean);

    const html =
      '<div class="form-group">' +
      '  <label>色号信息</label>' +
      '  <div class="card" style="background:var(--gray-50);padding:12px;margin-bottom:0">' +
      '    <div class="flex-between">' +
      '      <span class="text-bold">' + UI.escapeHtml(bean.brand) + ' / ' + UI.escapeHtml(bean.colorCode) + '</span>' +
      '      <span>' + UI.escapeHtml(bean.colorName || '') + '</span>' +
      '    </div>' +
      '    <div class="divider"></div>' +
      '    <div class="flex-between small">' +
      '      <span class="muted">当前库存：<b>' + UI.formatNumber(bean.stock) + '</b></span>' +
      '      <span class="muted">已预留：<b>' + UI.formatNumber(bean.reserved) + '</b></span>' +
      '      <span class="muted">可用：<b class="' + (available < 0 ? 'text-danger' : 'text-success') + '">' + UI.formatNumber(available) + '</b></span>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="form-group">' +
      '  <label>' + (isIn ? '入库数量' : '减少数量') + ' <span class="required">*</span></label>' +
      '  <input class="form-control" type="number" min="1" id="stockDelta" value="" placeholder="请输入数量" autofocus>' +
      '</div>' +
      '<div class="form-group">' +
      '  <label>备注（可选）</label>' +
      '  <input class="form-control" id="stockNote" placeholder="如：补货、损耗">' +
      '</div>';

    const m = UI.modal({
      title: isIn ? '手动入库' : '手动减少库存',
      body: html,
      footer:
        '<button class="btn" data-action="close">取消</button>' +
        '<button class="btn ' + (isIn ? 'btn-success' : 'btn-danger') + '" data-action="confirm">' + (isIn ? '确认入库' : '确认减少') + '</button>'
    });

    m.el.querySelector('[data-action="confirm"]').addEventListener('click', function () {
      const delta = parseInt(m.el.querySelector('#stockDelta').value);
      const note = m.el.querySelector('#stockNote').value.trim();

      if (!delta || delta <= 0) {
        UI.toast('请输入大于0的数量', 'error');
        return;
      }

      if (!isIn && delta > bean.stock) {
        UI.toast('减少数量不能超过当前库存', 'error');
        return;
      }

      const actualDelta = isIn ? delta : -delta;
      Storage.adjustBeanStock(id, actualDelta, isIn ? '手动入库' : '手动减少', { note: note || (isIn ? '手动入库' : '手动减少') });
      UI.toast(isIn ? '入库成功' : '已减少库存', 'success');
      m.close();
      render();
      App.updateNavCounts();
    });
  }

  /* ---------- 删除 ---------- */
  function handleDelete(id) {
    const bean = Storage.getBeanById(id);
    if (!bean) return;

    if (bean.reserved > 0) {
      UI.alert({
        title: '无法删除',
        message: '该色号有 ' + bean.reserved + ' 颗已预留库存，请先取消相关待拼项目后再删除。',
        okText: '知道了'
      });
      return;
    }

    UI.confirm({
      title: '删除色号',
      message: '确认删除 ' + bean.brand + ' ' + bean.colorCode + '（' + (bean.colorName || '') + '）吗？',
      detail: '此操作不可恢复，当前库存 ' + bean.stock + ' 颗将被清空。',
      danger: true,
      okText: '确认删除'
    }).then(ok => {
      if (ok) {
        Storage.deleteBean(id);
        UI.toast('已删除色号', 'success');
        render();
        App.updateNavCounts();
      }
    });
  }

  return { render: render, refresh: render };
})();
