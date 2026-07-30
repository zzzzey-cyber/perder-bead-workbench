/* ==================== 我的图纸 - 图纸管理 ==================== */

const PatternsPage = (function () {
  const CATEGORIES = ['动物', '人物', '食物', '动漫', '挂件', '杯垫', '摆件', '其他'];
  let filters = { search: '', category: '' };

  /* ---------- 图片辅助函数 ---------- */
  function getPatternImages(pattern) {
    if (!pattern) return [];
    if (pattern.images && Array.isArray(pattern.images)) return pattern.images.filter(Boolean);
    if (pattern.image) return [pattern.image];
    return [];
  }

  function getFirstImage(pattern) {
    const images = getPatternImages(pattern);
    return images[0] || '';
  }

  /* ---------- 渲染页面 ---------- */
  function render() {
    const patterns = Storage.getPatterns();

    const html =
      '<div class="page-header">' +
      '  <div>' +
      '    <h1 class="page-title">我的图纸</h1>' +
      '    <div class="page-subtitle">管理拼豆图纸和色号用量</div>' +
      '  </div>' +
      '  <button class="btn btn-primary" data-action="add">+ 新增图纸</button>' +
      '</div>' +

      '<div class="toolbar">' +
      '  <div class="search-box">' +
      '    <input type="text" id="patternSearch" placeholder="搜索图纸名称…" value="' + UI.escapeHtml(filters.search) + '">' +
      '  </div>' +
      '  <select id="patternCategoryFilter">' +
      '    <option value="">全部分类</option>' +
      CATEGORIES.map(c => '<option value="' + c + '"' + (filters.category === c ? ' selected' : '') + '>' + c + '</option>').join('') +
      '  </select>' +
      '</div>' +

      renderGrid(patterns);

    document.getElementById('page-patterns').innerHTML = html;
    bindEvents();
  }

  /* ---------- 渲染卡片网格 ---------- */
  function renderGrid(patterns) {
    const filtered = filterPatterns(patterns);
    if (filtered.length === 0) {
      return UI.emptyState('🖼️', '还没有图纸，点击"新增图纸"添加');
    }

    let cards = '';
    filtered.forEach(p => {
      const total = calcTotal(p.usage);
      const images = getPatternImages(p);
      const firstImg = images[0];
      const imgHtml = firstImg
        ? '<img src="' + firstImg + '" alt="' + UI.escapeHtml(p.name) + '">' +
          (images.length > 1 ? '<div class="pattern-img-count">+' + (images.length - 1) + '</div>' : '')
        : '<span>🎨</span>';

      cards +=
        '<div class="pattern-card" data-action="view" data-id="' + p.id + '">' +
        '  <div class="pattern-card-img">' + imgHtml + '</div>' +
        '  <div class="pattern-card-body">' +
        '    <div class="pattern-card-title">' +
        (p.favorite ? '⭐ ' : '') + UI.escapeHtml(p.name) +
        '    </div>' +
        '    <div class="pattern-card-meta">' +
        UI.escapeHtml(p.category || '其他') + ' · ' + UI.escapeHtml(p.size || '-') + ' · ' + UI.escapeHtml(p.brand || '-') +
        '    </div>' +
        '    <div class="pattern-card-meta">' +
        '      共 ' + (p.usage ? p.usage.length : 0) + ' 种色号 · ' + UI.formatNumber(total) + ' 颗' +
        '    </div>' +
        '    <div class="pattern-card-footer">' +
        '      <span class="small muted">完成 ' + (p.completeCount || 0) + ' 次</span>' +
        '      <button class="btn btn-sm btn-primary" data-action="addTodo" data-id="' + p.id + '">加入待拼</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    });

    return '<div class="pattern-grid">' + cards + '</div>';
  }

  function filterPatterns(patterns) {
    return patterns.filter(p => {
      if (filters.category && p.category !== filters.category) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const text = (p.name + ' ' + (p.brand || '') + ' ' + (p.category || '')).toLowerCase();
        if (text.indexOf(q) === -1) return false;
      }
      return true;
    }).sort((a, b) => {
      // 收藏在前
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }

  function calcTotal(usage) {
    if (!usage) return 0;
    return usage.reduce((s, u) => s + (parseInt(u.quantity) || 0), 0);
  }

  /* ---------- 事件绑定 ---------- */
  let eventsBound = false;
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const page = document.getElementById('page-patterns');

    page.querySelector('#patternSearch').addEventListener('input', function (e) {
      filters.search = e.target.value;
      refreshGrid();
    });

    page.querySelector('#patternCategoryFilter').addEventListener('change', function (e) {
      filters.category = e.target.value;
      refreshGrid();
    });

    page.addEventListener('click', function (e) {
      // 阻止加入待拼按钮触发卡片点击
      const addBtn = UI.closestAction(e.target, '[data-action="addTodo"]');
      if (addBtn) {
        e.stopPropagation();
        const id = addBtn.getAttribute('data-id');
        showAddTodoModal(id);
        return;
      }

      const card = UI.closestAction(e.target, '[data-action="view"]');
      if (card) {
        showDetailModal(card.getAttribute('data-id'));
      }

      const addBtn2 = UI.closestAction(e.target, '[data-action="add"]');
      if (addBtn2) showEditModal(null);
    });
  }

  function refreshGrid() {
    const patterns = Storage.getPatterns();
    const grid = document.querySelector('#page-patterns .pattern-grid');
    if (grid) {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderGrid(patterns);
      const newGrid = tmp.firstChild;
      if (newGrid) grid.replaceWith(newGrid);
    }
  }

  /* ---------- 图纸详情 ---------- */
  function showDetailModal(id) {
    const p = Storage.getPatternById(id);
    if (!p) return;
    const total = calcTotal(p.usage);

    let usageHtml = '';
    (p.usage || []).forEach(u => {
      const bean = Storage.getBeanByCode(p.brand, u.colorCode);
      const stockInfo = bean
        ? '<span class="muted small">库存 ' + bean.stock + ' / 可用 ' + UI.getAvailable(bean) + '</span>'
        : '<span class="text-danger small">未入库</span>';
      usageHtml +=
        '<div class="flex-between" style="padding:6px 0;border-bottom:1px dashed var(--gray-200)">' +
        '  <div>' +
        '    <span class="text-bold">' + UI.escapeHtml(u.colorCode) + '</span>' +
        '    <span class="muted"> · ' + UI.escapeHtml(u.colorName || '') + '</span>' +
        '  </div>' +
        '  <div class="text-right">' +
        '    <span class="text-bold">' + UI.formatNumber(u.quantity) + ' 颗</span><br>' +
        stockInfo +
        '  </div>' +
        '</div>';
    });

    const images = getPatternImages(p);
    let imgHtml = '';
    if (images.length === 0) {
      imgHtml = '<div class="pattern-card-img" style="height:180px;border-radius:8px">🎨</div>';
    } else if (images.length === 1) {
      imgHtml = '<img src="' + images[0] + '" style="max-width:100%;max-height:300px;border-radius:8px;display:block;margin:0 auto">';
    } else {
      // 多图轮播
      let thumbs = '';
      images.forEach((img, idx) => {
        thumbs += '<img src="' + img + '" class="pattern-gallery-thumb' + (idx === 0 ? ' active' : '') + '" data-idx="' + idx + '">';
      });
      imgHtml =
        '<div class="pattern-gallery">' +
        '  <div class="pattern-gallery-main">' +
        '    <img src="' + images[0] + '" id="galleryMainImg">' +
        '    <button class="gallery-nav gallery-prev" data-gallery-nav="-1">&#10094;</button>' +
        '    <button class="gallery-nav gallery-next" data-gallery-nav="1">&#10095;</button>' +
        '    <div class="gallery-counter"><span id="galleryIdx">1</span> / ' + images.length + '</div>' +
        '  </div>' +
        '  <div class="pattern-gallery-thumbs">' + thumbs + '</div>' +
        '</div>';
    }

    const m = UI.modal({
      title: p.name,
      size: 'lg',
      body:
        '<div class="mb-16">' + imgHtml + '</div>' +
        '<div class="flex gap-12 mb-16" style="flex-wrap:wrap">' +
        '  <span class="badge badge-info">' + UI.escapeHtml(p.category || '其他') + '</span>' +
        '  <span class="badge badge-gray">尺寸：' + UI.escapeHtml(p.size || '-') + '</span>' +
        '  <span class="badge badge-gray">品牌：' + UI.escapeHtml(p.brand || '-') + '</span>' +
        (p.favorite ? '<span class="badge badge-warning">⭐ 已收藏</span>' : '') +
        '</div>' +
        '<div class="card" style="background:var(--gray-50)">' +
        '  <div class="card-title">色号用量明细</div>' +
        usageHtml +
        '  <div class="flex-between mt-12" style="font-weight:600;border-top:2px solid var(--gray-300);padding-top:8px">' +
        '    <span>合计</span><span>' + UI.formatNumber(total) + ' 颗</span>' +
        '  </div>' +
        '</div>' +
        (p.note ? '<div class="mt-12"><div class="muted small">备注</div><div>' + UI.escapeHtml(p.note) + '</div></div>' : '') +
        '<div class="mt-12 muted small">完成次数：' + (p.completeCount || 0) + ' · 创建于 ' + UI.formatTime(p.createdAt) + '</div>',
      footer:
        '<button class="btn btn-danger" data-action="delete">删除</button>' +
        '<button class="btn" data-action="edit">编辑</button>' +
        '<button class="btn btn-primary" data-action="addTodo">加入待拼清单</button>'
    });

    // 多图轮播导航
    let galleryIndex = 0;
    function updateGallery(idx) {
      if (images.length <= 1) return;
      galleryIndex = idx;
      if (galleryIndex < 0) galleryIndex = images.length - 1;
      if (galleryIndex >= images.length) galleryIndex = 0;
      const mainImg = m.el.querySelector('#galleryMainImg');
      const idxEl = m.el.querySelector('#galleryIdx');
      if (mainImg) mainImg.src = images[galleryIndex];
      if (idxEl) idxEl.textContent = galleryIndex + 1;
      m.el.querySelectorAll('.pattern-gallery-thumb').forEach((t, i) => {
        t.classList.toggle('active', i === galleryIndex);
      });
    }

    m.el.addEventListener('click', function (e) {
      const action = UI.closestAction(e.target, '[data-action]');
      if (action) {
        const a = action.getAttribute('data-action');
        if (a === 'close' || a === 'view') return;
        if (a === 'edit') { m.close(); showEditModal(p); }
        else if (a === 'delete') { m.close(); handleDelete(p); }
        else if (a === 'addTodo') { m.close(); showAddTodoModal(p.id); }
      }

      // 轮播导航
      const nav = UI.closestAction(e.target, '[data-gallery-nav]');
      if (nav) {
        const delta = parseInt(nav.getAttribute('data-gallery-nav'));
        updateGallery(galleryIndex + delta);
      }

      // 缩略图切换
      const thumb = UI.closestAction(e.target, '.pattern-gallery-thumb');
      if (thumb) {
        const idx = parseInt(thumb.getAttribute('data-idx'));
        updateGallery(idx);
      }
    });
  }

  /* ---------- 新增/编辑图纸 ---------- */
  function showEditModal(pattern) {
    const isEdit = !!pattern;
    const beans = Storage.getBeans();
    const brands = beans.map(b => b.brand).filter((v, i, a) => a.indexOf(v) === i);

    const initialUsage = (pattern && pattern.usage) ? pattern.usage : [];
    let usageRows = initialUsage.map(u => JSON.stringify(u));
    let imageData = pattern ? getPatternImages(pattern) : [];

    function renderUsageRows() {
      if (usageRows.length === 0) {
        return '<div class="muted small" id="noUsage">还没有添加色号用量</div>';
      }
      let html = '';
      usageRows.forEach((u, idx) => {
        const item = JSON.parse(u);
        html +=
          '<div class="usage-row" data-idx="' + idx + '">' +
          '  <input class="form-control" data-field="colorCode" value="' + UI.escapeHtml(item.colorCode) + '" placeholder="色号">' +
          '  <input class="form-control" data-field="colorName" value="' + UI.escapeHtml(item.colorName || '') + '" placeholder="颜色名称">' +
          '  <input class="form-control" type="number" min="1" data-field="quantity" value="' + item.quantity + '" placeholder="数量">' +
          '  <button class="usage-remove" data-action="removeUsage" data-idx="' + idx + '">&times;</button>' +
          '</div>';
      });
      return html;
    }

    function rebuildUsage() {
      const container = m.el.querySelector('#usageContainer');
      container.innerHTML = renderUsageRows();
      bindUsageEvents();
      updateTotal();
    }

    function bindUsageEvents() {
      const container = m.el.querySelector('#usageContainer');
      container.querySelectorAll('.usage-row').forEach(row => {
        row.querySelectorAll('input').forEach(input => {
          input.addEventListener('input', function () {
            const idx = parseInt(row.getAttribute('data-idx'));
            const field = input.getAttribute('data-field');
            const item = JSON.parse(usageRows[idx]);
            item[field] = field === 'quantity' ? (parseInt(input.value) || 0) : input.value;
            usageRows[idx] = JSON.stringify(item);
            updateTotal();
          });
        });
      });
      container.querySelectorAll('[data-action="removeUsage"]').forEach(btn => {
        btn.addEventListener('click', function () {
          const idx = parseInt(btn.getAttribute('data-idx'));
          usageRows.splice(idx, 1);
          rebuildUsage();
        });
      });
    }

    function updateTotal() {
      let total = 0;
      usageRows.forEach(u => { total += JSON.parse(u).quantity || 0; });
      const el = m.el.querySelector('#usageTotal');
      if (el) el.textContent = UI.formatNumber(total) + ' 颗';
    }

    function renderImagePreview() {
      if (!imageData || imageData.length === 0) return '';
      let html = '';
      imageData.forEach((img, idx) => {
        html +=
          '<div class="pattern-preview-item">' +
          '  <img src="' + img + '">' +
          '  <button type="button" class="pattern-preview-del" data-img-idx="' + idx + '" title="删除">&times;</button>' +
          '</div>';
      });
      return html;
    }

    function rebuildImagePreview() {
      const preview = m.el.querySelector('#imagePreview');
      if (preview) preview.innerHTML = renderImagePreview();
    }

    const html =
      '<form id="patternForm">' +
      '  <div class="form-row">' +
      '    <div class="form-group">' +
      '      <label>图纸名称 <span class="required">*</span></label>' +
      '      <input class="form-control" name="name" required value="' + UI.escapeHtml(pattern ? pattern.name : '') + '" placeholder="如 橘猫杯垫">' +
      '    </div>' +
      '    <div class="form-group">' +
      '      <label>使用品牌</label>' +
      '      <input class="form-control" name="brand" list="patternBrandList" value="' + UI.escapeHtml(pattern ? pattern.brand : '') + '" placeholder="选择或输入品牌">' +
      '      <datalist id="patternBrandList">' + brands.map(b => '<option value="' + UI.escapeHtml(b) + '">').join('') + '</datalist>' +
      '    </div>' +
      '  </div>' +
      '  <div class="form-row-3">' +
      '    <div class="form-group">' +
      '      <label>图纸分类</label>' +
      '      <select class="form-control" name="category">' +
      CATEGORIES.map(c => '<option value="' + c + '"' + (pattern && pattern.category === c ? ' selected' : '') + '>' + c + '</option>').join('') +
      '      </select>' +
      '    </div>' +
      '    <div class="form-group">' +
      '      <label>图纸尺寸</label>' +
      '      <input class="form-control" name="size" value="' + UI.escapeHtml(pattern ? pattern.size : '') + '" placeholder="如 32×32">' +
      '    </div>' +
      '    <div class="form-group">' +
      '      <label>收藏</label>' +
      '      <select class="form-control" name="favorite">' +
      '        <option value="0"' + (!pattern || !pattern.favorite ? ' selected' : '') + '>否</option>' +
      '        <option value="1"' + (pattern && pattern.favorite ? ' selected' : '') + '>是</option>' +
      '      </select>' +
      '    </div>' +
      '  </div>' +
      '  <div class="form-group">' +
      '    <label>图纸预览图片</label>' +
      '    <input type="file" accept="image/*" id="patternImage" multiple style="font-size:13px">' +
      '    <div id="imagePreview" class="mt-8 pattern-preview-wrap">' + renderImagePreview() + '</div>' +
      '  </div>' +
      '  <div class="form-group">' +
      '    <div class="flex-between">' +
      '      <label>色号用量明细</label>' +
      '      <button class="btn btn-sm btn-outline" data-action="addUsage" type="button">+ 添加色号</button>' +
      '    </div>' +
      '    <div id="usageContainer">' + renderUsageRows() + '</div>' +
      '    <div class="flex-between mt-8" style="background:var(--primary-bg);padding:8px 12px;border-radius:6px">' +
      '      <span class="text-bold">总豆子数量</span>' +
      '      <span class="text-bold text-primary" id="usageTotal">' + UI.formatNumber(calcTotal(initialUsage)) + ' 颗</span>' +
      '    </div>' +
      '    <div class="small muted mt-8">提示：输入色号后可从库存中匹配品牌自动填充颜色名称</div>' +
      '  </div>' +
      '  <div class="form-group">' +
      '    <label>备注</label>' +
      '    <textarea class="form-control" name="note" placeholder="可选">' + UI.escapeHtml(pattern ? pattern.note : '') + '</textarea>' +
      '  </div>' +
      '</form>';

    const m = UI.modal({
      title: isEdit ? '编辑图纸' : '新增图纸',
      size: 'lg',
      body: html,
      footer:
        '<button class="btn" data-action="close">取消</button>' +
        '<button class="btn btn-primary" data-action="save">保存</button>'
    });

    bindUsageEvents();

    // 添加用量行
    m.el.querySelector('[data-action="addUsage"]').addEventListener('click', function () {
      usageRows.push(JSON.stringify({ colorCode: '', colorName: '', quantity: 1 }));
      rebuildUsage();
    });

    // 图片上传（支持多选）
    m.el.querySelector('#patternImage').addEventListener('change', function (e) {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      let loaded = 0;
      files.forEach(file => {
        UI.readImage(file, function (data) {
          if (data) imageData.push(data);
          loaded++;
          if (loaded === files.length) {
            rebuildImagePreview();
            e.target.value = ''; // 清空以便重复选择相同文件
          }
        });
      });
    });

    // 删除预览图
    m.el.querySelector('#imagePreview').addEventListener('click', function (e) {
      const delBtn = UI.closestAction(e.target, '.pattern-preview-del');
      if (delBtn) {
        const idx = parseInt(delBtn.getAttribute('data-img-idx'));
        imageData.splice(idx, 1);
        rebuildImagePreview();
      }
    });

    // 色号输入自动匹配
    m.el.querySelector('#usageContainer').addEventListener('change', function (e) {
      if (e.target.getAttribute('data-field') === 'colorCode') {
        const row = UI.closestAction(e.target, '.usage-row');
        if (!row) return;
        const idx = parseInt(row.getAttribute('data-idx'));
        const code = e.target.value.trim();
        const brand = m.el.querySelector('[name="brand"]').value.trim();
        if (code && brand) {
          const bean = Storage.getBeanByCode(brand, code);
          if (bean) {
            const item = JSON.parse(usageRows[idx]);
            item.colorName = bean.colorName;
            usageRows[idx] = JSON.stringify(item);
            row.querySelector('[data-field="colorName"]').value = bean.colorName;
          }
        }
      }
    });

    // 保存
    m.el.querySelector('[data-action="save"]').addEventListener('click', function () {
      const form = m.el.querySelector('#patternForm');
      const data = {};
      new FormData(form).forEach((v, k) => { data[k] = v; });

      if (!data.name) {
        UI.toast('请填写图纸名称', 'error');
        return;
      }

      // 解析用量
      const usage = usageRows.map(u => {
        const item = JSON.parse(u);
        return {
          colorCode: (item.colorCode || '').trim(),
          colorName: (item.colorName || '').trim(),
          quantity: parseInt(item.quantity) || 0
        };
      }).filter(u => u.colorCode && u.quantity > 0);

      const obj = {
        name: data.name.trim(),
        brand: data.brand.trim(),
        category: data.category,
        size: data.size.trim(),
        favorite: data.favorite === '1',
        usage: usage,
        totalBeads: calcTotal(usage),
        images: imageData,
        note: data.note.trim()
      };

      if (isEdit) {
        obj.id = pattern.id;
        obj.createdAt = pattern.createdAt;
        obj.completeCount = pattern.completeCount || 0;
      }

      var savedPattern = Storage.savePattern(obj);
      if (!savedPattern) {
        UI.alert({
          title: '保存失败',
          message: '无法保存图纸，可能是浏览器存储空间不足。图片数据较大时容易出现此问题，请尝试使用较小的图片或删除一些不需要的数据后重试。',
          okText: '知道了'
        });
        return;
      }
      UI.toast(isEdit ? '已更新图纸' : '已新增图纸', 'success');
      m.close();
      render();
      App.updateNavCounts();
    });
  }

  /* ---------- 从图片识别色号 ---------- */
  function showImageRecognizeModal(imageData, brand, callback) {
    const html =
      '<div>' +
      '  <div class="tabs" style="margin-bottom:16px">' +
      '    <button class="tab-btn active" data-tab="color">🎨 颜色采样识别</button>' +
      '    <button class="tab-btn" data-tab="ocr">📝 OCR文字识别</button>' +
      '  </div>' +
      '  <div data-tab-panel="color" style="display:flex;gap:16px;flex-wrap:wrap">' +
      '    <div style="flex:1;min-width:200px">' +
      '      <label class="small text-bold">图纸预览</label>' +
      '      <canvas id="recCanvas" style="max-width:100%;border:1px solid var(--gray-200);border-radius:6px;margin-top:4px"></canvas>' +
      '    </div>' +
      '    <div style="flex:1;min-width:240px">' +
      '      <div class="form-row">' +
      '        <div class="form-group">' +
      '          <label>网格宽度（格数）</label>' +
      '          <input class="form-control" type="number" id="gridWidth" value="25" min="1" max="200">' +
      '        </div>' +
      '        <div class="form-group">' +
      '          <label>网格高度（格数）</label>' +
      '          <input class="form-control" type="number" id="gridHeight" value="25" min="1" max="200">' +
      '        </div>' +
      '      </div>' +
      '      <div class="small muted mb-8">提示：根据图纸上的横向和纵向格子数填写</div>' +
      '      <button class="btn btn-primary" data-action="startRecognize" type="button">🔍 开始识别颜色</button>' +
      '      <div id="recResult" style="margin-top:16px"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div data-tab-panel="ocr" style="display:none">' +
      '    <div style="display:flex;gap:16px;flex-wrap:wrap">' +
      '      <div style="flex:1;min-width:200px">' +
      '        <label class="small text-bold">图纸预览</label>' +
      '        <div style="border:1px solid var(--gray-200);border-radius:6px;margin-top:4px;overflow:hidden;max-height:300px;display:flex;align-items:center;justify-content:center;background:var(--gray-50)">' +
      '          <img id="ocrPreview" style="max-width:100%;max-height:300px;display:block">' +
      '        </div>' +
      '      </div>' +
      '      <div style="flex:1;min-width:240px">' +
      '        <div class="form-group">' +
      '          <label>识别语言</label>' +
      '          <select class="form-control" id="ocrLang">' +
      '            <option value="chi_sim+eng">中文 + 英文（推荐）</option>' +
      '            <option value="eng">英文</option>' +
      '            <option value="chi_sim">简体中文</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="small muted mb-8">提示：首次使用需要下载语言包，可能需要几秒到几十秒</div>' +
      '        <button class="btn btn-primary" data-action="startOcr" type="button">📝 开始OCR识别</button>' +
      '        <div id="ocrProgress" style="margin-top:8px;display:none">' +
      '          <div class="progress-bar"><div class="progress-fill" id="ocrProgressFill"></div></div>' +
      '          <div class="small muted mt-4" id="ocrProgressText">准备中…</div>' +
      '        </div>' +
      '        <div id="ocrResult" style="margin-top:16px"></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    const m = UI.modal({
      title: '从图片识别色号用量',
      size: 'lg',
      body: html,
      footer:
        '<button class="btn" data-action="close">取消</button>' +
        '<button class="btn btn-primary" data-action="confirmRecognize" type="button" disabled>确认导入</button>'
    });

    let recognizedColors = [];
    let ocrResults = [];
    let currentTab = 'color';

    // ========== 标签切换 ==========
    m.el.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const tab = btn.getAttribute('data-tab');
        currentTab = tab;
        m.el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        m.el.querySelectorAll('[data-tab-panel]').forEach(p => {
          p.style.display = p.getAttribute('data-tab-panel') === tab ? '' : 'none';
        });
        updateConfirmButton();
      });
    });

    function updateConfirmButton() {
      const btn = m.el.querySelector('[data-action="confirmRecognize"]');
      if (currentTab === 'color') {
        btn.disabled = recognizedColors.length === 0;
      } else {
        btn.disabled = ocrResults.length === 0;
      }
    }

    // ========== 颜色识别模式 ==========
    const canvas = m.el.querySelector('#recCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = function () {
      // 保持比例缩放到最大 300px 显示
      const maxDisplay = 300;
      const scale = Math.min(maxDisplay / img.width, maxDisplay / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageData;

    // 开始颜色识别
    m.el.querySelector('[data-action="startRecognize"]').addEventListener('click', function () {
      const gridW = parseInt(m.el.querySelector('#gridWidth').value) || 25;
      const gridH = parseInt(m.el.querySelector('#gridHeight').value) || 25;

      UI.toast('正在分析颜色…', 'info');

      // 在隐藏 canvas 上进行精确采样
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = gridW;
      sampleCanvas.height = gridH;
      const sctx = sampleCanvas.getContext('2d');
      sctx.drawImage(img, 0, 0, gridW, gridH);

      const pixels = sctx.getImageData(0, 0, gridW, gridH).data;
      const colorMap = {};

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        if (a < 128) continue;
        const qr = Math.round(r / 8) * 8;
        const qg = Math.round(g / 8) * 8;
        const qb = Math.round(b / 8) * 8;
        const key = qr + ',' + qg + ',' + qb;
        if (!colorMap[key]) {
          colorMap[key] = { r: qr, g: qg, b: qb, count: 0, hex: rgbToHex(qr, qg, qb) };
        }
        colorMap[key].count++;
      }

      recognizedColors = Object.values(colorMap).sort((a, b) => b.count - a.count);

      const beans = brand ? Storage.getBeans().filter(b => b.brand === brand) : Storage.getBeans();

      let rows = '';
      recognizedColors.forEach((c, idx) => {
        rows +=
          '<div class="flex gap-8" style="align-items:center;padding:6px 0;border-bottom:1px dashed var(--gray-200)" data-idx="' + idx + '">' +
          '  <div style="width:28px;height:28px;border-radius:4px;border:1px solid var(--gray-200);flex-shrink:0;background:' + c.hex + '"></div>' +
          '  <div style="flex:1;min-width:80px">' +
          '    <input class="form-control rec-code" data-field="code" placeholder="色号" style="font-size:13px" list="recBrandList">' +
          '  </div>' +
          '  <div style="flex:1;min-width:80px">' +
          '    <input class="form-control rec-name" data-field="name" placeholder="颜色名" style="font-size:13px">' +
          '  </div>' +
          '  <div style="min-width:60px;text-align:right;font-size:13px">' +
          '    <span class="text-bold">' + c.count + '</span><span class="small muted">颗</span>' +
          '  </div>' +
          '</div>';
      });

      const resultHtml =
        '<div class="text-bold mb-8">识别出 ' + recognizedColors.length + ' 种颜色</div>' +
        '<div class="small muted mb-8">请为每种颜色填写对应的色号（参考图纸上的标注如 C8、C13 等）</div>' +
        '<datalist id="recBrandList">' + beans.map(b => '<option value="' + UI.escapeHtml(b.colorCode) + '">').join('') + '</datalist>' +
        '<div style="max-height:280px;overflow-y:auto">' + rows + '</div>';

      m.el.querySelector('#recResult').innerHTML = resultHtml;
      updateConfirmButton();

      // 色号输入自动匹配颜色名
      m.el.querySelector('#recResult').addEventListener('change', function (e) {
        if (e.target.getAttribute('data-field') === 'code') {
          const code = e.target.value.trim();
          const row = UI.closestAction(e.target, '[data-idx]');
          if (!row) return;
          if (code && brand) {
            const bean = Storage.getBeanByCode(brand, code);
            if (bean) {
              row.querySelector('.rec-name').value = bean.colorName;
            }
          }
        }
      });
    });

    // ========== OCR 识别模式 ==========
    const ocrPreview = m.el.querySelector('#ocrPreview');
    ocrPreview.src = imageData;

    m.el.querySelector('[data-action="startOcr"]').addEventListener('click', async function () {
      if (typeof Tesseract === 'undefined') {
        UI.toast('OCR 组件未加载，请检查网络连接', 'error');
        return;
      }

      const lang = m.el.querySelector('#ocrLang').value;
      const progressDiv = m.el.querySelector('#ocrProgress');
      const progressFill = m.el.querySelector('#ocrProgressFill');
      const progressText = m.el.querySelector('#ocrProgressText');
      const resultDiv = m.el.querySelector('#ocrResult');

      progressDiv.style.display = '';
      progressFill.style.width = '0%';
      progressText.textContent = '正在加载语言包…';
      resultDiv.innerHTML = '';
      ocrResults = [];
      updateConfirmButton();

      // 图片预处理：放大图片以提高小字识别率
      const scaledData = await upscaleImage(imageData, 2);

      Tesseract.recognize(
        scaledData,
        lang,
        {
          logger: function (m) {
            if (m.status) {
              const statusMap = {
                'loading tesseract core': '加载识别引擎…',
                'initializing tesseract': '初始化引擎…',
                'loading language traineddata': '加载语言包…',
                'initializing api': '准备识别…',
                'recognizing text': '正在逐格识别色号…'
              };
              progressText.textContent = statusMap[m.status] || m.status;
              if (m.progress !== undefined) {
                progressFill.style.width = Math.round(m.progress * 100) + '%';
              }
            }
          }
        }
      ).then(function (result) {
        progressDiv.style.display = 'none';

        // 从词级别数据中统计每个色号出现次数
        ocrResults = countColorCodes(result.data.words, brand);

        if (ocrResults.length === 0) {
          // 回退：尝试用旧方法从全文解析
          const fallback = parseOcrTextFallback(result.data.text, brand);
          if (fallback.length > 0) {
            ocrResults = fallback;
            renderOcrResults(ocrResults, brand, resultDiv);
            updateConfirmButton();
            return;
          }

          resultDiv.innerHTML =
            '<div class="alert alert-warning"><span class="alert-icon">⚠️</span>' +
            '<div>未能识别出色号。<br>' +
            '<span class="small">可能原因：图纸上没有色号文字、文字太小或模糊。</span>' +
            '</div></div>' +
            '<details style="margin-top:8px"><summary class="small muted">查看识别到的原始文字</summary>' +
            '<pre style="font-size:12px;background:var(--gray-50);padding:8px;border-radius:4px;max-height:200px;overflow:auto;margin-top:4px;white-space:pre-wrap">' +
            UI.escapeHtml(result.data.text) + '</pre></details>';
          return;
        }

        renderOcrResults(ocrResults, brand, resultDiv);
        updateConfirmButton();
      }).catch(function (err) {
        progressDiv.style.display = 'none';
        console.error('OCR 失败:', err);
        UI.toast('OCR 识别失败：' + (err.message || err), 'error');
      });
    });

    // 图片放大预处理（返回 Promise）
    function upscaleImage(dataUrl, scale) {
      return new Promise(function (resolve) {
        const tmpImg = new Image();
        tmpImg.onload = function () {
          const canvas = document.createElement('canvas');
          canvas.width = tmpImg.width * scale;
          canvas.height = tmpImg.height * scale;
          const ctx = canvas.getContext('2d');
          // 关闭平滑，保留像素边缘（对拼豆图纸很重要）
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tmpImg, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        tmpImg.onerror = function () {
          resolve(dataUrl); // 失败时回退到原图
        };
        tmpImg.src = dataUrl;
      });
    }

    // 核心：统计每个色号在图中出现了多少次
    function countColorCodes(words, brand) {
      if (!words || words.length === 0) return [];

      const codeCounts = {};
      const codeConfidences = {}; // 暂存各色号每次识别的置信度

      // 色号正则：字母+数字（2-4位），如 A01, B12, C-27, D 08
      const codeRegex = /^([A-Za-z])[\s\-]*(\d{1,4})$/;

      words.forEach(function (word) {
        const text = (word.text || '').trim();
        const match = text.match(codeRegex);
        if (!match) return;

        const code = match[1].toUpperCase() + match[2];
        const confidence = word.confidence || 0;

        // 过滤掉明显不合理的色号（如纯数字、过长）
        if (code.length < 2 || code.length > 5) return;
        // 跳过字母后跟 4 位以上数字的（可能是年份或其他）
        if (match[2].length > 3) return;

        if (!codeCounts[code]) {
          codeCounts[code] = 0;
          codeConfidences[code] = [];
        }
        codeCounts[code]++;
        codeConfidences[code].push(confidence);
      });

      // 构建结果：色号 + 数量 + 平均置信度
      const results = [];
      Object.keys(codeCounts).forEach(function (code) {
        const count = codeCounts[code];
        const confs = codeConfidences[code];
        const avgConf = confs.reduce((s, c) => s + c, 0) / confs.length;

        // 过滤：出现次数太少（<3次）且置信度低的，可能是误识别
        // 但不要过滤掉只有少量出现的情况（也许真的只有几颗）
        if (count < 2 && avgConf < 40) return;

        // 尝试匹配颜色名
        let colorName = '';
        if (brand) {
          const bean = Storage.getBeanByCode(brand, code);
          if (bean) colorName = bean.colorName;
        }

        results.push({
          colorCode: code,
          colorName: colorName,
          quantity: count,
          confidence: Math.round(avgConf)
        });
      });

      // 按色号排序
      results.sort((a, b) => a.colorCode.localeCompare(b.colorCode));
      return results;
    }

    // 回退方法：从全文解析色号+数量
    function parseOcrTextFallback(text, brand) {
      const results = [];
      const seen = {};
      const lines = text.split(/\r?\n/);

      lines.forEach(function (line) {
        line = line.trim();
        if (!line) return;

        const match1 = line.match(/([A-Za-z])[\s\-]*(\d{1,4})/);
        if (match1) {
          const code = match1[1].toUpperCase() + match1[2];
          const qtyMatch = line.match(/(\d{1,5})\s*(?:颗|个|粒|pcs|PC|Pcs)?\s*$/);
          const qtyMatch2 = line.match(/[:：]\s*(\d{1,5})/);
          let qty = 0;
          if (qtyMatch) qty = parseInt(qtyMatch[1]);
          else if (qtyMatch2) qty = parseInt(qtyMatch2[1]);
          else {
            const nums = line.match(/\d+/g);
            if (nums && nums.length >= 2) {
              const codeNum = parseInt(match1[2]);
              const otherNums = nums.map(n => parseInt(n)).filter(n => n !== codeNum && n > 0);
              if (otherNums.length > 0) qty = Math.max(...otherNums);
            }
          }
          if (qty > 0 && !seen[code]) {
            let colorName = '';
            if (brand) {
              const bean = Storage.getBeanByCode(brand, code);
              if (bean) colorName = bean.colorName;
            }
            results.push({ colorCode: code, colorName: colorName, quantity: qty, confidence: 50 });
            seen[code] = true;
          }
        }
      });
      results.sort((a, b) => a.colorCode.localeCompare(b.colorCode));
      return results;
    }

    function renderOcrResults(results, brand, container) {
      const beans = brand ? Storage.getBeans().filter(b => b.brand === brand) : Storage.getBeans();
      const beanMap = {};
      beans.forEach(b => { beanMap[b.colorCode.toUpperCase()] = b; });

      let rows = '';
      results.forEach((item, idx) => {
        const bean = beanMap[item.colorCode.toUpperCase()];
        const colorName = item.colorName || (bean ? bean.colorName : '');
        const conf = item.confidence || 0;
        const confLabel = conf >= 80 ? '高' : conf >= 50 ? '中' : '低';
        const confColor = conf >= 80 ? 'text-success' : conf >= 50 ? 'text-warning' : 'text-danger';
        rows +=
          '<div class="flex gap-8" style="align-items:center;padding:6px 0;border-bottom:1px dashed var(--gray-200)" data-ocr-idx="' + idx + '">' +
          '  <div style="flex:1;min-width:70px">' +
          '    <input class="form-control ocr-code" value="' + UI.escapeHtml(item.colorCode) + '" style="font-size:13px">' +
          '  </div>' +
          '  <div style="flex:1;min-width:80px">' +
          '    <input class="form-control ocr-name" value="' + UI.escapeHtml(colorName) + '" placeholder="颜色名" style="font-size:13px">' +
          '  </div>' +
          '  <div style="min-width:80px">' +
          '    <input class="form-control ocr-qty" type="number" min="1" value="' + item.quantity + '" style="font-size:13px;text-align:right">' +
          '  </div>' +
          '  <div style="min-width:40px;text-align:center;font-size:12px" class="' + confColor + ' small">' + confLabel + '</div>' +
          '  <button class="btn btn-sm btn-danger ocr-del" style="flex-shrink:0" data-ocr-del="' + idx + '">删</button>' +
          '</div>';
      });

      const total = results.reduce((s, r) => s + r.quantity, 0);
      container.innerHTML =
        '<div class="text-bold mb-8">识别出 ' + results.length + ' 个色号（共 ' + total + ' 颗）</div>' +
        '<div class="small muted mb-8">逐格扫描每个色号出现次数，请核对。置信度"低"的色号建议手动确认</div>' +
        '<div style="max-height:280px;overflow-y:auto">' + rows + '</div>' +
        '<div class="flex-between mt-8" style="background:var(--primary-bg);padding:8px 12px;border-radius:6px">' +
        '  <span class="text-bold">合计</span>' +
        '  <span class="text-bold text-primary" id="ocrTotal">' + UI.formatNumber(total) + ' 颗</span>' +
        '</div>';

      // 删除按钮
      container.querySelectorAll('[data-ocr-del]').forEach(btn => {
        btn.addEventListener('click', function () {
          const idx = parseInt(btn.getAttribute('data-ocr-del'));
          ocrResults.splice(idx, 1);
          renderOcrResults(ocrResults, brand, container);
          updateConfirmButton();
        });
      });

      // 色号输入自动匹配颜色名
      container.querySelectorAll('.ocr-code').forEach(input => {
        input.addEventListener('change', function () {
          const row = UI.closestAction(input, '[data-ocr-idx]');
          if (!row) return;
          const idx = parseInt(row.getAttribute('data-ocr-idx'));
          const code = input.value.trim();
          ocrResults[idx].colorCode = code;
          if (code && brand) {
            const bean = Storage.getBeanByCode(brand, code);
            if (bean) {
              row.querySelector('.ocr-name').value = bean.colorName;
              ocrResults[idx].colorName = bean.colorName;
            }
          }
        });
      });

      // 数量变化更新合计
      container.querySelectorAll('.ocr-qty').forEach(input => {
        input.addEventListener('input', function () {
          const row = UI.closestAction(input, '[data-ocr-idx]');
          if (!row) return;
          const idx = parseInt(row.getAttribute('data-ocr-idx'));
          ocrResults[idx].quantity = parseInt(input.value) || 0;
          const total = ocrResults.reduce((s, r) => s + r.quantity, 0);
          const totalEl = container.querySelector('#ocrTotal');
          if (totalEl) totalEl.textContent = UI.formatNumber(total) + ' 颗';
        });
      });
    }

    // ========== 确认导入 ==========
    m.el.querySelector('[data-action="confirmRecognize"]').addEventListener('click', function () {
      const result = [];

      if (currentTab === 'color') {
        m.el.querySelectorAll('#recResult [data-idx]').forEach(row => {
          const code = row.querySelector('.rec-code').value.trim();
          const name = row.querySelector('.rec-name').value.trim();
          const idx = parseInt(row.getAttribute('data-idx'));
          if (code && recognizedColors[idx]) {
            result.push({
              colorCode: code,
              colorName: name,
              quantity: recognizedColors[idx].count
            });
          }
        });
      } else {
        // OCR 模式 - 从 ocrResults 读取（已包含用户修改后的值）
        m.el.querySelectorAll('#ocrResult [data-ocr-idx]').forEach(row => {
          const code = row.querySelector('.ocr-code').value.trim();
          const name = row.querySelector('.ocr-name').value.trim();
          const qty = parseInt(row.querySelector('.ocr-qty').value) || 0;
          if (code && qty > 0) {
            result.push({
              colorCode: code,
              colorName: name,
              quantity: qty
            });
          }
        });
      }

      if (result.length === 0) {
        UI.toast('没有可导入的色号', 'warning');
        return;
      }

      m.close();
      callback(result);
    });
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, x)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  /* ---------- 加入待拼清单 ---------- */
  function showAddTodoModal(patternId) {
    const pattern = Storage.getPatternById(patternId);
    if (!pattern) return;

    // 检查库存
    const checkResult = checkStock(pattern, 1);

    let usageHtml = '';
    (pattern.usage || []).forEach(u => {
      const bean = pattern.brand ? Storage.getBeanByCode(pattern.brand, u.colorCode) : null;
      const stock = bean ? bean.stock : 0;
      const available = bean ? UI.getAvailable(bean) : 0;
      const need = u.quantity;
      const ok = available >= need;
      usageHtml +=
        '<div class="flex-between" style="padding:6px 0;border-bottom:1px dashed var(--gray-200)">' +
        '  <div>' +
        '    <span class="text-bold">' + UI.escapeHtml(u.colorCode) + '</span>' +
        '    <span class="muted"> · ' + UI.escapeHtml(u.colorName || '') + '</span>' +
        '  </div>' +
        '  <div class="text-right small">' +
        '    需要 <b>' + need + '</b> · 可用 <b class="' + (ok ? 'text-success' : 'text-danger') + '">' + available + '</b>' +
        '  </div>' +
        '</div>';
    });

    const m = UI.modal({
      title: '加入待拼清单',
      body:
        '<div class="card" style="background:var(--gray-50)">' +
        '  <div class="card-title">' + UI.escapeHtml(pattern.name) + '</div>' +
        '  <div class="small muted mb-12">' + UI.escapeHtml(pattern.category || '') + ' · ' + UI.escapeHtml(pattern.size || '') + '</div>' +
        '  <div class="card-title" style="font-size:14px">色号用量（单份）</div>' +
        usageHtml +
        '</div>' +
        '<div class="form-row">' +
        '  <div class="form-group">' +
        '    <label>制作数量 <span class="required">*</span></label>' +
        '    <input class="form-control" type="number" min="1" id="todoQty" value="1">' +
        '  </div>' +
        '  <div class="form-group">' +
        '    <label>优先级</label>' +
        '    <select class="form-control" id="todoPriority">' +
        '      <option value="高">高</option>' +
        '      <option value="中" selected>中</option>' +
        '      <option value="低">低</option>' +
        '    </select>' +
        '  </div>' +
        '</div>' +
        '<div class="form-group">' +
        '  <label>备注（可选）</label>' +
        '  <input class="form-control" id="todoNote" placeholder="如：送给朋友的生日礼物">' +
        '</div>' +
        '<div id="stockCheckResult"></div>',
      footer:
        '<button class="btn" data-action="close">取消</button>' +
        '<button class="btn btn-primary" data-action="confirm">加入待拼</button>'
    });

    function updateCheck() {
      const qty = parseInt(m.el.querySelector('#todoQty').value) || 1;
      const result = checkStock(pattern, qty);
      const container = m.el.querySelector('#stockCheckResult');

      let html = '';
      if (result.allOk) {
        html = '<div class="alert alert-info"><span class="alert-icon">✓</span><div>库存充足，可以加入待拼清单并随时开始制作。</div></div>';
      } else {
        let items = '';
        result.items.forEach(item => {
          if (!item.ok) {
            items +=
              '<div class="stock-check-item short">' +
              '  <span>' + UI.escapeHtml(item.colorCode) + ' ' + UI.escapeHtml(item.colorName || '') + '</span>' +
              '  <span>需要 ' + item.need + ' / 可用 ' + item.available + ' / 缺 ' + item.short + '</span>' +
              '</div>';
          }
        });
        html = '<div class="alert alert-danger"><span class="alert-icon">!</span><div><b>库存不足</b><br>以下色号缺少豆子，仍可加入清单但暂时不能开始制作：</div></div>' + items;
      }
      container.innerHTML = html;
    }

    updateCheck();
    m.el.querySelector('#todoQty').addEventListener('input', updateCheck);

    m.el.querySelector('[data-action="confirm"]').addEventListener('click', function () {
      const qty = parseInt(m.el.querySelector('#todoQty').value);
      const priority = m.el.querySelector('#todoPriority').value;
      const note = m.el.querySelector('#todoNote').value.trim();

      if (!qty || qty < 1) {
        UI.toast('请输入有效的制作数量', 'error');
        return;
      }

      // 计算所需明细和预留
      const requiredItems = (pattern.usage || []).map(u => ({
        colorCode: u.colorCode,
        colorName: u.colorName || '',
        quantityPerUnit: u.quantity,
        totalNeed: u.quantity * qty
      }));

      const result = checkStock(pattern, qty);

      const todo = {
        patternId: pattern.id,
        patternName: pattern.name,
        patternCategory: pattern.category || '',
        patternSize: pattern.size || '',
        brand: pattern.brand || '',
        usage: pattern.usage || [],
        quantity: qty,
        priority: priority,
        status: '想拼',
        requiredItems: requiredItems,
        stockCheck: {
          allOk: result.allOk,
          checkedAt: new Date().toISOString()
        },
        startedAt: '',
        completedAt: '',
        note: note
      };

      // 增加预留数量
      requiredItems.forEach(item => {
        const bean = pattern.brand ? Storage.getBeanByCode(pattern.brand, item.colorCode) : null;
        if (bean) {
          Storage.adjustBeanReserved(bean.id, item.totalNeed);
        }
      });

      var saved = Storage.saveTodo(todo);
      if (!saved) {
        // 保存失败（通常是 localStorage 空间不足），回滚预留
        requiredItems.forEach(item => {
          const bean = pattern.brand ? Storage.getBeanByCode(pattern.brand, item.colorCode) : null;
          if (bean) {
            Storage.adjustBeanReserved(bean.id, -item.totalNeed);
          }
        });
        UI.alert({
          title: '保存失败',
          message: '无法保存待拼项目，可能是浏览器存储空间不足。请尝试删除一些不需要的图纸或待拼项目后重试。',
          okText: '知道了'
        });
        return;
      }
      UI.toast('已加入待拼清单' + (result.allOk ? '' : '（库存不足，暂不能开始制作）'), 'success');
      m.close();
      App.updateNavCounts();
      // 自动跳转到待拼清单页面
      App.navigate('todo');
    });
  }

  /* ---------- 库存检查 ---------- */
  function checkStock(pattern, qty) {
    const items = (pattern.usage || []).map(u => {
      const bean = pattern.brand ? Storage.getBeanByCode(pattern.brand, u.colorCode) : null;
      const available = bean ? UI.getAvailable(bean) : 0;
      const need = u.quantity * qty;
      return {
        colorCode: u.colorCode,
        colorName: u.colorName || '',
        need: need,
        available: available,
        short: Math.max(0, need - available),
        ok: available >= need
      };
    });
    return {
      allOk: items.every(i => i.ok),
      items: items
    };
  }

  /* ---------- 删除 ---------- */
  function handleDelete(pattern) {
    UI.confirm({
      title: '删除图纸',
      message: '确认删除图纸「' + pattern.name + '」吗？',
      detail: '此操作不可恢复。如果有关联的待拼项目，建议先处理待拼项目。',
      danger: true,
      okText: '确认删除'
    }).then(ok => {
      if (ok) {
        Storage.deletePattern(pattern.id);
        UI.toast('已删除图纸', 'success');
        render();
        App.updateNavCounts();
      }
    });
  }

  return { render: render, refresh: render };
})();
