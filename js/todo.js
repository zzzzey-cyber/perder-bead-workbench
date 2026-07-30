/* ==================== 待拼清单 - 预留/扣减/返还逻辑 ==================== */

const TodoPage = (function () {
  let filters = { status: '', priority: '' };

  /* ---------- 渲染页面 ---------- */
  function render() {
    const todos = Storage.getTodos();

    const html =
      '<div class="page-header">' +
      '  <div>' +
      '    <h1 class="page-title">待拼清单</h1>' +
      '    <div class="page-subtitle">管理待拼项目和制作进度</div>' +
      '  </div>' +
      '</div>' +

      '<div class="toolbar">' +
      '  <select id="todoStatusFilter">' +
      '    <option value="">全部状态</option>' +
      '    <option value="想拼"' + (filters.status === '想拼' ? ' selected' : '') + '>想拼</option>' +
      '    <option value="准备中"' + (filters.status === '准备中' ? ' selected' : '') + '>准备中</option>' +
      '    <option value="正在拼"' + (filters.status === '正在拼' ? ' selected' : '') + '>正在拼</option>' +
      '    <option value="已完成"' + (filters.status === '已完成' ? ' selected' : '') + '>已完成</option>' +
      '    <option value="已暂停"' + (filters.status === '已暂停' ? ' selected' : '') + '>已暂停</option>' +
      '    <option value="已取消"' + (filters.status === '已取消' ? ' selected' : '') + '>已取消</option>' +
      '  </select>' +
      '  <select id="todoPriorityFilter">' +
      '    <option value="">全部优先级</option>' +
      '    <option value="高"' + (filters.priority === '高' ? ' selected' : '') + '>高</option>' +
      '    <option value="中"' + (filters.priority === '中' ? ' selected' : '') + '>中</option>' +
      '    <option value="低"' + (filters.priority === '低' ? ' selected' : '') + '>低</option>' +
      '  </select>' +
      '</div>' +

      renderList(todos);

    document.getElementById('page-todo').innerHTML = html;
    bindEvents();
  }

  /* ---------- 渲染列表 ---------- */
  function renderList(todos) {
    const filtered = filterTodos(todos);
    if (filtered.length === 0) {
      return UI.emptyState('📝', '还没有待拼项目，去"我的图纸"添加一个吧');
    }

    // 排序：进行中优先，然后按优先级，再按创建时间
    const statusOrder = { '正在拼': 0, '准备中': 1, '想拼': 2, '已暂停': 3, '已完成': 4, '已取消': 5 };
    const priorityOrder = { '高': 0, '中': 1, '低': 2 };

    // 按状态分组，确保排序稳定可靠
    const groups = {};
    filtered.forEach(function (t) {
      var s = t.status || '';
      var order = statusOrder[s] !== undefined ? statusOrder[s] : 9;
      if (!groups[order]) groups[order] = [];
      groups[order].push(t);
    });

    // 按状态顺序拼接各组
    var sorted = [];
    [0, 1, 2, 3, 4, 5, 9].forEach(function (order) {
      if (groups[order]) {
        // 组内按优先级和创建时间排序
        groups[order].sort(function (a, b) {
          var pa = a.priority || '';
          var pb = b.priority || '';
          var po = (priorityOrder[pa] !== undefined ? priorityOrder[pa] : 9) -
                   (priorityOrder[pb] !== undefined ? priorityOrder[pb] : 9);
          if (po !== 0) return po;
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
        sorted = sorted.concat(groups[order]);
      }
    });

    let cards = '';
    sorted.forEach(function (todo) {
      cards += renderCard(todo);
    });

    return '<div id="todoList">' + cards + '</div>';
  }

  /* ---------- 渲染单张卡片 ---------- */
  function renderCard(todo) {
    const checkResult = checkStockForTodo(todo);
    const priorityClass = 'priority-' + ({ '高': 'high', '中': 'medium', '低': 'low' }[todo.priority] || 'medium');

    // 从图纸数据中获取图片，避免在 todo 中存储大段 base64 图片数据
    var patternImage = '';
    if (todo.patternId) {
      var pattern = Storage.getPatternById(todo.patternId);
      if (pattern) {
        var images = [];
        if (pattern.images && Array.isArray(pattern.images)) images = pattern.images.filter(Boolean);
        else if (pattern.image) images = [pattern.image];
        patternImage = images[0] || '';
      }
    }
    // 兼容旧数据：如果图纸已删除，回退到 todo 中可能存的旧图片
    if (!patternImage && todo.patternImage) patternImage = todo.patternImage;

    let imgHtml = patternImage
      ? '<img src="' + patternImage + '" style="width:60px;height:60px;border-radius:6px;object-fit:cover">'
      : '<div style="width:60px;height:60px;border-radius:6px;background:var(--gray-100);display:flex;align-items:center;justify-content:center;font-size:24px">🎨</div>';

    // 所需豆子明细
    let itemsHtml = '';
    (todo.requiredItems || []).forEach(item => {
      const bean = todo.brand ? Storage.getBeanByCode(todo.brand, item.colorCode) : null;
      const selfNeed = item.totalNeed || 0;
      const rawAvailable = bean ? UI.getAvailable(bean) : 0;
      const available = rawAvailable + selfNeed;
      const ok = available >= selfNeed;
      const stock = bean ? bean.stock : 0;
      itemsHtml +=
        '<div class="flex-between" style="padding:4px 0;font-size:12px">' +
        '  <span>' + UI.escapeHtml(item.colorCode) + ' ' + UI.escapeHtml(item.colorName || '') + '</span>' +
        '  <span class="' + (ok ? 'text-success' : 'text-danger') + '">需 ' + selfNeed + ' / 可用 ' + available + ' (总库存 ' + stock + ')</span>' +
        '</div>';
    });

    // 库存状态提示
    let stockAlert = '';
    if (todo.status === '想拼' || todo.status === '准备中' || todo.status === '已暂停') {
      if (!checkResult.allOk) {
        // 收集库存不足的色号及预留来源
        let shortItems = '';
        checkResult.items.forEach(item => {
          if (!item.ok) {
            const others = getReservingTodos(todo.brand, item.colorCode, todo.id);
            let otherHtml = '';
            if (others.length > 0) {
              otherHtml = '<div class="small muted" style="margin-top:2px;padding-left:8px">被其他项目占用：' +
                others.map(o => UI.escapeHtml(o.name) + ' x' + o.quantity + '（预留 ' + o.reserved + '）').join('、') +
                '</div>';
            }
            shortItems +=
              '<div style="margin-top:4px">' +
              '  <span class="text-bold">' + UI.escapeHtml(item.colorCode) + '</span>' +
              '  <span class="text-danger"> 缺 ' + item.short + ' 颗</span>' +
              otherHtml +
              '</div>';
          }
        });
        stockAlert = '<div class="alert alert-danger" style="margin:8px 0;padding:8px 12px;font-size:12px">' +
          '<span class="alert-icon">!</span><div><b>库存不足</b>，暂不能开始制作' + shortItems + '</div></div>';
      }
    }

    // 操作按钮
    let actions = '';
    if (todo.status === '想拼' || todo.status === '准备中' || todo.status === '已暂停') {
      const canStart = checkResult.allOk;
      actions += '<button class="btn btn-sm btn-success" data-action="start" data-id="' + todo.id + '"' + (canStart ? '' : ' disabled') + '>开始拼</button>';
      actions += '<button class="btn btn-sm btn-outline" data-action="cancel" data-id="' + todo.id + '">取消</button>';
      if (todo.status === '已暂停') {
        actions += '<button class="btn btn-sm btn-outline" data-action="resume" data-id="' + todo.id + '">恢复</button>';
      } else {
        actions += '<button class="btn btn-sm btn-outline" data-action="pause" data-id="' + todo.id + '">暂停</button>';
      }
      actions += '<button class="btn btn-sm" data-action="edit" data-id="' + todo.id + '">编辑</button>';
    } else if (todo.status === '正在拼') {
      actions += '<button class="btn btn-sm btn-primary" data-action="complete" data-id="' + todo.id + '">完成</button>';
      actions += '<button class="btn btn-sm btn-danger" data-action="cancel" data-id="' + todo.id + '">取消</button>';
    } else if (todo.status === '已完成') {
      actions += '<span class="small muted">已完成 · ' + UI.formatTime(todo.completedAt, false) + '</span>';
    } else if (todo.status === '已取消') {
      actions += '<span class="small muted">已取消</span>';
    }
    // 所有状态都显示删除按钮
    actions += '<button class="btn btn-sm btn-danger" data-action="delete" data-id="' + todo.id + '">删除</button>';

    // 时间信息
    let timeInfo = '添加于 ' + UI.formatTime(todo.createdAt);
    if (todo.startedAt) timeInfo += ' · 开始于 ' + UI.formatTime(todo.startedAt);
    if (todo.completedAt) timeInfo += ' · 完成于 ' + UI.formatTime(todo.completedAt);

    return '' +
      '<div class="todo-card ' + priorityClass + '" data-id="' + todo.id + '">' +
      '  <div class="todo-card-header">' +
      '    <div class="flex gap-12">' +
      '      <div>' + imgHtml + '</div>' +
      '      <div>' +
      '        <div class="todo-card-title">' + UI.escapeHtml(todo.patternName) + '</div>' +
      '        <div class="small muted">' + UI.escapeHtml(todo.patternCategory || '') + ' · ' + UI.escapeHtml(todo.patternSize || '') + ' · ' + UI.escapeHtml(todo.brand || '') + '</div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="flex gap-8">' +
      UI.priorityBadge(todo.priority) +
      UI.todoStatusBadge(todo.status) +
      '    </div>' +
      '  </div>' +
      '  <div class="todo-card-meta">' + timeInfo + '</div>' +
      '  <div class="flex gap-12 mb-8" style="flex-wrap:wrap">' +
      '    <span class="badge badge-gray">制作 ' + todo.quantity + ' 份</span>' +
      '    <span class="badge badge-info">共 ' + UI.formatNumber(calcTotal(todo)) + ' 颗</span>' +
      '    <span class="badge badge-gray">' + (todo.requiredItems ? todo.requiredItems.length : 0) + ' 种色号</span>' +
      '  </div>' +
      (todo.note ? '<div class="small muted mb-8">备注：' + UI.escapeHtml(todo.note) + '</div>' : '') +
      stockAlert +
      '  <div class="card" style="background:var(--gray-50);padding:10px 12px;margin-bottom:0">' +
      '    <div class="small text-bold mb-8">所需豆子明细</div>' +
      itemsHtml +
      '  </div>' +
      '  <div class="todo-card-actions">' + actions + '</div>' +
      '</div>';
  }

  function calcTotal(todo) {
    if (!todo.requiredItems) return 0;
    return todo.requiredItems.reduce((s, i) => s + (i.totalNeed || 0), 0);
  }

  function filterTodos(todos) {
    return todos.filter(t => {
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      return true;
    });
  }

  /* ---------- 库存检查（实时） ---------- */
  function checkStockForTodo(todo) {
    const items = (todo.requiredItems || []).map(item => {
      const bean = todo.brand ? Storage.getBeanByCode(todo.brand, item.colorCode) : null;
      const selfNeed = item.totalNeed || 0;
      // 加回当前项目自身的预留，因为自身预留是为本项目准备的，不应影响本项目开始制作
      const rawAvailable = bean ? UI.getAvailable(bean) : 0;
      const available = rawAvailable + selfNeed;
      const need = selfNeed;
      return {
        colorCode: item.colorCode,
        colorName: item.colorName || '',
        need: need,
        available: available,
        short: Math.max(0, need - available),
        ok: available >= need,
        beanId: bean ? bean.id : null
      };
    });
    return {
      allOk: items.every(i => i.ok),
      items: items
    };
  }

  /* ---------- 查找预留了该色号的其他项目 ---------- */
  function getReservingTodos(brand, colorCode, excludeTodoId) {
    return Storage.getTodos().filter(t =>
      t.id !== excludeTodoId &&
      t.status !== '已取消' &&
      t.status !== '已完成' &&
      t.brand === brand &&
      (t.requiredItems || []).some(r => r.colorCode === colorCode)
    ).map(t => {
      const item = (t.requiredItems || []).find(r => r.colorCode === colorCode);
      return {
        name: t.patternName,
        quantity: t.quantity,
        reserved: item ? item.totalNeed : 0,
        status: t.status
      };
    });
  }

  /* ---------- 事件绑定 ---------- */
  let eventsBound = false;
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const page = document.getElementById('page-todo');

    page.querySelector('#todoStatusFilter').addEventListener('change', function (e) {
      filters.status = e.target.value;
      refreshList();
    });

    page.querySelector('#todoPriorityFilter').addEventListener('change', function (e) {
      filters.priority = e.target.value;
      refreshList();
    });

    page.addEventListener('click', function (e) {
      const btn = UI.closestAction(e.target, '[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!id) return;

      if (action === 'start') handleStart(id);
      else if (action === 'complete') handleComplete(id);
      else if (action === 'cancel') handleCancel(id);
      else if (action === 'pause') handlePause(id);
      else if (action === 'resume') handleResume(id);
      else if (action === 'edit') handleEdit(id);
      else if (action === 'delete') handleDelete(id);
    });
  }

  function refreshList() {
    const todos = Storage.getTodos();
    const list = document.querySelector('#page-todo #todoList');
    if (list) {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderList(todos);
      const newList = tmp.firstChild;
      if (newList) list.replaceWith(newList);
    }
  }

  /* ---------- 开始拼 ---------- */
  function handleStart(id) {
    const todo = Storage.getTodoById(id);
    if (!todo) return;

    // 防止重复扣减
    if (todo.deducted) {
      UI.toast('该项目已扣减过库存，不能重复操作', 'warning');
      return;
    }

    // 再次检查库存
    const result = checkStockForTodo(todo);
    if (!result.allOk) {
      let items = '';
      result.items.forEach(item => {
        const bean = item.beanId ? Storage.getBeanById(item.beanId) : null;
        const stock = bean ? bean.stock : 0;
        const reserved = bean ? (bean.reserved || 0) : 0;
        if (!item.ok) {
          items +=
            '<div class="stock-check-item short">' +
            '  <span>' + UI.escapeHtml(item.colorCode) + ' ' + UI.escapeHtml(item.colorName || '') + '</span>' +
            '  <span>库存 ' + stock + ' / 预留 ' + reserved + ' / 可用 ' + item.available +
            ' / 需 ' + item.need + ' / 缺 ' + item.short + '</span>' +
            '</div>';
        }
      });
      UI.alert({
        title: '库存不足，无法开始',
        html: '<div class="alert alert-danger"><span class="alert-icon">!</span><div>以下色号可用库存不足。"可用" = 当前库存 - 已预留（其他待拼项目占用的部分）。</div></div>' + items
      });
      return;
    }

    // 二次确认 - 显示即将扣除的所有色号和数量
    let listHtml = '';
    let totalDelta = 0;
    result.items.forEach(item => {
      listHtml +=
        '<div class="confirm-list-item">' +
        '  <span>' + UI.escapeHtml(item.colorCode) + ' ' + UI.escapeHtml(item.colorName || '') + '</span>' +
        '  <span class="text-danger">- ' + item.need + ' 颗</span>' +
        '</div>';
      totalDelta += item.need;
    });
    listHtml +=
      '<div class="confirm-list-item">' +
      '  <span>合计扣减</span>' +
      '  <span class="text-danger">- ' + UI.formatNumber(totalDelta) + ' 颗</span>' +
      '</div>';

    UI.confirm({
      title: '确认开始制作',
      message: '即将从当前库存中扣除以下豆子，并释放对应的预留数量：',
      detail: listHtml,
      okText: '确认扣减并开始'
    }).then(ok => {
      if (!ok) return;

      // 执行扣减
      result.items.forEach(item => {
        if (item.beanId) {
          // 1. 从当前库存扣除实际用量
          Storage.adjustBeanStock(item.beanId, -item.need, '开始制作扣减', {
            patternId: todo.patternId,
            patternName: todo.patternName,
            todoId: todo.id,
            todoName: todo.patternName + ' x' + todo.quantity,
            note: '开始制作扣减库存'
          });
          // 2. 从已预留数量中移除该项目的预留
          Storage.adjustBeanReserved(item.beanId, -item.need);
        }
      });

      // 3. 项目状态改为"正在拼"
      todo.status = '正在拼';
      todo.startedAt = new Date().toISOString();
      todo.deducted = true; // 标记已扣减
      Storage.saveTodo(todo);

      UI.toast('已开始制作，库存已扣减', 'success');
      render();
      App.updateNavCounts();
    });
  }

  /* ---------- 完成项目 ---------- */
  function handleComplete(id) {
    const todo = Storage.getTodoById(id);
    if (!todo) return;

    UI.confirm({
      title: '确认完成',
      message: '确认完成「' + todo.patternName + '」的制作吗？',
      detail: '完成后将记录完成时间，并增加关联图纸的完成次数。不会再扣除库存。',
      okText: '确认完成'
    }).then(ok => {
      if (!ok) return;

      todo.status = '已完成';
      todo.completedAt = new Date().toISOString();
      Storage.saveTodo(todo);

      // 关联图纸完成次数 +1
      if (todo.patternId) {
        Storage.incrementPatternComplete(todo.patternId);
      }

      UI.toast('恭喜完成！', 'success');
      render();
      App.updateNavCounts();
    });
  }

  /* ---------- 取消项目 ---------- */
  function handleCancel(id) {
    const todo = Storage.getTodoById(id);
    if (!todo) return;

    if (todo.status === '已完成') {
      UI.toast('已完成的项目不能取消', 'warning');
      return;
    }

    // 如果还没开始拼（未扣减库存），直接释放预留
    if (!todo.deducted) {
      UI.confirm({
        title: '取消待拼项目',
        message: '确认取消「' + todo.patternName + '」吗？',
        detail: '取消后将自动释放该项目预留的全部库存，当前库存不会变化。',
        danger: true,
        okText: '确认取消'
      }).then(ok => {
        if (!ok) return;
        releaseReservation(todo);
        todo.status = '已取消';
        Storage.saveTodo(todo);
        UI.toast('已取消，预留库存已释放', 'success');
        render();
        App.updateNavCounts();
      });
      return;
    }

    // 已经开始拼 - 提供两个选项
    const m = UI.modal({
      title: '取消正在拼的项目',
      body:
        '<div class="alert alert-warning"><span class="alert-icon">!</span>' +
        '<div>该项目已开始制作并扣减过库存。请选择取消时的库存处理方式：</div></div>' +
        '<div class="card" style="background:var(--gray-50)">' +
        '  <div class="radio-group" style="flex-direction:column;gap:12px">' +
        '    <label class="radio-item" style="align-items:flex-start;padding:8px;border:1px solid var(--gray-200);border-radius:6px;cursor:pointer">' +
        '      <input type="radio" name="returnType" value="all" checked style="margin-top:3px">' +
        '      <div>' +
        '        <div class="text-bold">全部返还库存</div>' +
        '        <div class="small muted">将之前扣除的所有豆子返还当前库存，并生成库存返还记录</div>' +
        '      </div>' +
        '    </label>' +
        '    <label class="radio-item" style="align-items:flex-start;padding:8px;border:1px solid var(--gray-200);border-radius:6px;cursor:pointer">' +
        '      <input type="radio" name="returnType" value="none" style="margin-top:3px">' +
        '      <div>' +
        '        <div class="text-bold">不返还库存</div>' +
        '        <div class="small muted">不修改库存，只把项目状态改为已取消（适合豆子已经用掉的情况）</div>' +
        '      </div>' +
        '    </label>' +
        '  </div>' +
        '</div>',
      footer:
        '<button class="btn" data-action="close">再想想</button>' +
        '<button class="btn btn-danger" data-action="confirmCancel">确认取消</button>'
    });

    m.el.querySelector('[data-action="confirmCancel"]').addEventListener('click', function () {
      const returnType = m.el.querySelector('input[name="returnType"]:checked').value;

      if (returnType === 'all') {
        // 返还库存
        (todo.requiredItems || []).forEach(item => {
          const bean = todo.brand ? Storage.getBeanByCode(todo.brand, item.colorCode) : null;
          if (bean) {
            Storage.adjustBeanStock(bean.id, item.totalNeed, '取消制作返还', {
              patternId: todo.patternId,
              patternName: todo.patternName,
              todoId: todo.id,
              todoName: todo.patternName + ' x' + todo.quantity,
              note: '取消制作，返还库存'
            });
          }
        });
        UI.toast('已取消，库存已返还', 'success');
      } else {
        UI.toast('已取消，库存未变动', 'success');
      }

      todo.status = '已取消';
      Storage.saveTodo(todo);
      m.close();
      render();
      App.updateNavCounts();
    });
  }

  /* ---------- 暂停 ---------- */
  function handlePause(id) {
    const todo = Storage.getTodoById(id);
    if (!todo) return;
    todo.status = '已暂停';
    Storage.saveTodo(todo);
    UI.toast('已暂停', 'info');
    render();
    App.updateNavCounts();
  }

  /* ---------- 恢复 ---------- */
  function handleResume(id) {
    const todo = Storage.getTodoById(id);
    if (!todo) return;
    todo.status = '想拼';
    Storage.saveTodo(todo);
    UI.toast('已恢复', 'success');
    render();
    App.updateNavCounts();
  }

  /* ---------- 编辑（修改数量/优先级） ---------- */
  function handleEdit(id) {
    const todo = Storage.getTodoById(id);
    if (!todo) return;

    if (todo.deducted) {
      UI.toast('已开始制作的项目不能编辑', 'warning');
      return;
    }

    const html =
      '<div class="form-group">' +
      '  <label>制作数量</label>' +
      '  <input class="form-control" type="number" min="1" id="editQty" value="' + todo.quantity + '">' +
      '  <div class="small muted mt-8">修改数量会重新计算预留库存</div>' +
      '</div>' +
      '<div class="form-group">' +
      '  <label>优先级</label>' +
      '  <select class="form-control" id="editPriority">' +
      '    <option value="高"' + (todo.priority === '高' ? ' selected' : '') + '>高</option>' +
      '    <option value="中"' + (todo.priority === '中' ? ' selected' : '') + '>中</option>' +
      '    <option value="低"' + (todo.priority === '低' ? ' selected' : '') + '>低</option>' +
      '  </select>' +
      '</div>' +
      '<div class="form-group">' +
      '  <label>备注</label>' +
      '  <input class="form-control" id="editNote" value="' + UI.escapeHtml(todo.note || '') + '">' +
      '</div>';

    const m = UI.modal({
      title: '编辑待拼项目',
      body: html,
      footer:
        '<button class="btn" data-action="close">取消</button>' +
        '<button class="btn btn-primary" data-action="save">保存</button>'
    });

    m.el.querySelector('[data-action="save"]').addEventListener('click', function () {
      const newQty = parseInt(m.el.querySelector('#editQty').value);
      const newPriority = m.el.querySelector('#editPriority').value;
      const newNote = m.el.querySelector('#editNote').value.trim();

      if (!newQty || newQty < 1) {
        UI.toast('请输入有效的数量', 'error');
        return;
      }

      // 先释放旧预留
      releaseReservation(todo);

      // 重新计算所需数量
      todo.quantity = newQty;
      todo.priority = newPriority;
      todo.note = newNote;
      todo.requiredItems = (todo.usage || []).map(u => ({
        colorCode: u.colorCode,
        colorName: u.colorName || '',
        quantityPerUnit: u.quantity,
        totalNeed: u.quantity * newQty
      }));

      // 重新检查并增加预留
      const result = checkStockForTodo(todo);
      todo.stockCheck = { allOk: result.allOk, checkedAt: new Date().toISOString() };

      todo.requiredItems.forEach(item => {
        const bean = todo.brand ? Storage.getBeanByCode(todo.brand, item.colorCode) : null;
        if (bean) {
          Storage.adjustBeanReserved(bean.id, item.totalNeed);
        }
      });

      var editSaved = Storage.saveTodo(todo);
      if (!editSaved) {
        UI.toast('保存失败，存储空间可能不足', 'error');
        return;
      }
      UI.toast('已更新', 'success');
      m.close();
      render();
      App.updateNavCounts();
    });
  }

  /* ---------- 释放预留 ---------- */
  function releaseReservation(todo) {
    (todo.requiredItems || []).forEach(item => {
      const bean = todo.brand ? Storage.getBeanByCode(todo.brand, item.colorCode) : null;
      if (bean) {
        Storage.adjustBeanReserved(bean.id, -item.totalNeed);
      }
    });
  }

  /* ---------- 删除项目 ---------- */
  function handleDelete(id) {
    const todo = Storage.getTodoById(id);
    if (!todo) return;

    UI.confirm({
      title: '删除待拼项目',
      message: '确认删除「' + todo.patternName + '」吗？',
      detail: todo.deducted
        ? '该项目已扣减过库存。删除后库存不会自动返还，如需返还请先使用"取消"功能。'
        : '删除后将自动释放该项目预留的库存。',
      danger: true,
      okText: '确认删除'
    }).then(ok => {
      if (!ok) return;

      // 如果还没扣减库存，先释放预留
      if (!todo.deducted) {
        releaseReservation(todo);
      }

      // 如果是已完成的待拼项目，同时减少图纸的完成次数
      if (todo.status === '已完成' && todo.patternId) {
        Storage.decrementPatternComplete(todo.patternId);
      }

      Storage.deleteTodo(id);
      UI.toast('已删除', 'success');
      render();
      App.updateNavCounts();
    });
  }

  return { render: render, refresh: render };
})();
