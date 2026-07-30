/* ==================== 数据存储层 ==================== */
/* 使用 LocalStorage 持久化保存所有数据 */

const Storage = (function () {
  const KEYS = {
    BEANS: 'pdb_beans',
    PATTERNS: 'pdb_patterns',
    TODOS: 'pdb_todos',
    RECORDS: 'pdb_records',
    INIT_FLAG: 'pdb_initialized'
  };

  /* ---------- 基础读写 ---------- */
  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('读取数据失败:', key, e);
      return [];
    }
  }

  function write(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('写入数据失败:', key, e);
      return false;
    }
  }

  /* ---------- ID 生成器 ---------- */
  function genId(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).substr(2, 6);
  }

  /* ---------- 豆子库存 ---------- */
  function getBeans() {
    return read(KEYS.BEANS);
  }

  function getBeanById(id) {
    return getBeans().find(b => b.id === id) || null;
  }

  function normalizeCode(code) {
    if (!code) return '';
    // 去除空格、统一大写
    code = String(code).trim().toUpperCase();
    // 提取字母前缀和数字部分：A01 -> A, 1；H3 -> H, 3
    const m = code.match(/^([A-Z]+)0*(\d+)$/);
    if (m) return m[1] + parseInt(m[2], 10);
    return code;
  }

  function normalizeBrand(brand) {
    if (!brand) return '';
    return String(brand).trim().toLowerCase();
  }

  function getBeanByCode(brand, colorCode) {
    const beans = getBeans();
    // 1. 精确匹配
    let bean = beans.find(b => b.brand === brand && b.colorCode === colorCode);
    if (bean) return bean;
    // 2. 归一化匹配（兼容 A01 vs A1、H03 vs H3 等前导零差异，以及品牌大小写差异）
    const normCode = normalizeCode(colorCode);
    const normBrand = normalizeBrand(brand);
    bean = beans.find(b =>
      normalizeBrand(b.brand) === normBrand && normalizeCode(b.colorCode) === normCode
    );
    return bean || null;
  }

  function saveBean(bean) {
    const beans = getBeans();
    const now = new Date().toISOString();
    if (bean.id) {
      const idx = beans.findIndex(b => b.id === bean.id);
      if (idx >= 0) {
        bean.updatedAt = now;
        beans[idx] = bean;
      } else {
        bean.createdAt = bean.createdAt || now;
        bean.updatedAt = now;
        beans.push(bean);
      }
    } else {
      bean.id = genId('bean');
      bean.createdAt = now;
      bean.updatedAt = now;
      bean.reserved = bean.reserved || 0;
      bean.note = bean.note || '';
      beans.push(bean);
    }
    write(KEYS.BEANS, beans);
    return bean;
  }

  function deleteBean(id) {
    const beans = getBeans();
    const filtered = beans.filter(b => b.id !== id);
    write(KEYS.BEANS, filtered);
    return beans.length !== filtered.length;
  }

  /* ---------- 图纸 ---------- */
  function getPatterns() {
    return read(KEYS.PATTERNS);
  }

  function getPatternById(id) {
    return getPatterns().find(p => p.id === id) || null;
  }

  function savePattern(pattern) {
    const patterns = getPatterns();
    const now = new Date().toISOString();
    if (pattern.id) {
      const idx = patterns.findIndex(p => p.id === pattern.id);
      if (idx >= 0) {
        pattern.updatedAt = now;
        patterns[idx] = pattern;
      } else {
        pattern.createdAt = pattern.createdAt || now;
        patterns.push(pattern);
      }
    } else {
      pattern.id = genId('pat');
      pattern.createdAt = now;
      pattern.updatedAt = now;
      pattern.favorite = pattern.favorite || false;
      pattern.completeCount = pattern.completeCount || 0;
      pattern.usage = pattern.usage || [];
      patterns.push(pattern);
    }
    var ok = write(KEYS.PATTERNS, patterns);
    if (!ok) return null;
    return pattern;
  }

  function deletePattern(id) {
    const patterns = getPatterns();
    const filtered = patterns.filter(p => p.id !== id);
    write(KEYS.PATTERNS, filtered);
    return patterns.length !== filtered.length;
  }

  function incrementPatternComplete(id) {
    const pattern = getPatternById(id);
    if (pattern) {
      pattern.completeCount = (pattern.completeCount || 0) + 1;
      savePattern(pattern);
    }
  }

  function decrementPatternComplete(id) {
    const pattern = getPatternById(id);
    if (pattern) {
      pattern.completeCount = Math.max(0, (pattern.completeCount || 0) - 1);
      savePattern(pattern);
    }
  }

  /* ---------- 待拼清单 ---------- */
  function getTodos() {
    return read(KEYS.TODOS);
  }

  function getTodoById(id) {
    return getTodos().find(t => t.id === id) || null;
  }

  function saveTodo(todo) {
    const todos = getTodos();
    const now = new Date().toISOString();
    if (todo.id) {
      const idx = todos.findIndex(t => t.id === todo.id);
      if (idx >= 0) {
        todos[idx] = todo;
      } else {
        todos.push(todo);
      }
    } else {
      todo.id = genId('todo');
      todo.createdAt = now;
      todo.updatedAt = now;
      todos.push(todo);
    }
    var ok = write(KEYS.TODOS, todos);
    if (!ok) return null;
    return todo;
  }

  /* ---------- 清理待拼清单中的冗余大字段 ---------- */
  function cleanupTodos() {
    var todos = getTodos();
    var changed = false;
    todos.forEach(function (t) {
      if (t.patternImage) {
        delete t.patternImage;
        changed = true;
      }
    });
    if (changed) {
      write(KEYS.TODOS, todos);
    }
    return changed;
  }

  /* ---------- 修正图纸完成次数 ---------- */
  /* 根据当前待拼清单中"已完成"状态的项目数量，重新计算每个图纸的 completeCount */
  function fixCompleteCounts() {
    var todos = getTodos();
    var patterns = getPatterns();
    var changed = false;

    // 统计每个 patternId 对应的已完成待拼数量
    var counts = {};
    todos.forEach(function (t) {
      if (t.status === '已完成' && t.patternId) {
        counts[t.patternId] = (counts[t.patternId] || 0) + 1;
      }
    });

    // 修正每个图纸的完成次数
    patterns.forEach(function (p) {
      var correct = counts[p.id] || 0;
      var current = p.completeCount || 0;
      if (current !== correct) {
        p.completeCount = correct;
        changed = true;
      }
    });

    if (changed) {
      write(KEYS.PATTERNS, patterns);
    }
    return changed;
  }

  function deleteTodo(id) {
    const todos = getTodos();
    const filtered = todos.filter(t => t.id !== id);
    write(KEYS.TODOS, filtered);
    return todos.length !== filtered.length;
  }

  /* ---------- 库存记录 ---------- */
  function getRecords() {
    return read(KEYS.RECORDS);
  }

  function addRecord(record) {
    const records = getRecords();
    record.id = genId('rec');
    record.time = new Date().toISOString();
    records.push(record);
    // 保留最近 500 条，防止过多
    if (records.length > 500) {
      records.splice(0, records.length - 500);
    }
    write(KEYS.RECORDS, records);
    return record;
  }

  function deleteRecord(id) {
    const records = getRecords();
    const filtered = records.filter(r => r.id !== id);
    write(KEYS.RECORDS, filtered);
    return records.length !== filtered.length;
  }

  /* ---------- 库存数量调整（带记录） ---------- */
  function adjustBeanStock(beanId, delta, type, opts) {
    opts = opts || {};
    const bean = getBeanById(beanId);
    if (!bean) return null;

    const before = bean.stock;
    bean.stock = Math.max(0, bean.stock + delta);
    bean.updatedAt = new Date().toISOString();
    saveBean(bean);

    addRecord({
      brand: bean.brand,
      colorCode: bean.colorCode,
      colorName: bean.colorName,
      type: type,
      before: before,
      delta: delta,
      after: bean.stock,
      patternId: opts.patternId || '',
      patternName: opts.patternName || '',
      todoId: opts.todoId || '',
      todoName: opts.todoName || '',
      note: opts.note || ''
    });

    return bean;
  }

  /* ---------- 预留数量调整 ---------- */
  function adjustBeanReserved(beanId, delta) {
    const bean = getBeanById(beanId);
    if (!bean) return null;
    bean.reserved = Math.max(0, (bean.reserved || 0) + delta);
    bean.updatedAt = new Date().toISOString();
    saveBean(bean);
    return bean;
  }

  /* ---------- 初始化测试数据 ---------- */
  function initTestData() {
    if (localStorage.getItem(KEYS.INIT_FLAG)) return;

    const now = new Date().toISOString();

    // Mard 全套色号 (221色)，库存统一 1000
    const mardSeries = [
      { prefix: 'A', count: 26 },
      { prefix: 'B', count: 32 },
      { prefix: 'C', count: 29 },
      { prefix: 'D', count: 26 },
      { prefix: 'E', count: 24 },
      { prefix: 'F', count: 25 },
      { prefix: 'G', count: 21 },
      { prefix: 'H', count: 23 },
      { prefix: 'M', count: 15 }
    ];

    const testBeans = [];
    mardSeries.forEach(function (s) {
      for (let i = 1; i <= s.count; i++) {
        const code = s.prefix + (i < 10 ? '0' + i : i);
        testBeans.push({
          id: genId('bean'),
          brand: 'Mard',
          colorCode: code,
          colorName: '',
          stock: 1000,
          lowStockThreshold: 200,
          reserved: 0,
          note: '',
          createdAt: now,
          updatedAt: now
        });
      }
    });
    write(KEYS.BEANS, testBeans);

    // 测试图纸：橘猫杯垫
    const testPattern = {
      id: genId('pat'),
      name: '橘猫杯垫',
      image: '',
      size: '32×32',
      category: '杯垫',
      brand: 'Mard',
      usage: [
        { colorCode: 'A01', colorName: '白色', quantity: 120 },
        { colorCode: 'A02', colorName: '黑色', quantity: 80 },
        { colorCode: 'B12', colorName: '橙色', quantity: 200 }
      ],
      totalBeads: 400,
      favorite: false,
      completeCount: 0,
      note: '可爱的橘猫杯垫图纸',
      createdAt: now,
      updatedAt: now
    };
    write(KEYS.PATTERNS, [testPattern]);

    write(KEYS.TODOS, []);
    write(KEYS.RECORDS, []);

    localStorage.setItem(KEYS.INIT_FLAG, '1');
  }

  /* ---------- 重置所有数据 ---------- */
  function resetAll() {
    localStorage.removeItem(KEYS.BEANS);
    localStorage.removeItem(KEYS.PATTERNS);
    localStorage.removeItem(KEYS.TODOS);
    localStorage.removeItem(KEYS.RECORDS);
    localStorage.removeItem(KEYS.INIT_FLAG);
    initTestData();
  }

  /* ---------- 导出/导入 ---------- */
  function exportAll() {
    return {
      beans: getBeans(),
      patterns: getPatterns(),
      todos: getTodos(),
      records: getRecords(),
      exportTime: new Date().toISOString()
    };
  }

  function importAll(data) {
    if (!data) return false;
    if (data.beans) write(KEYS.BEANS, data.beans);
    if (data.patterns) write(KEYS.PATTERNS, data.patterns);
    if (data.todos) write(KEYS.TODOS, data.todos);
    if (data.records) write(KEYS.RECORDS, data.records);
    localStorage.setItem(KEYS.INIT_FLAG, '1');
    return true;
  }

  return {
    KEYS,
    genId,
    getBeans,
    getBeanById,
    getBeanByCode,
    saveBean,
    deleteBean,
    getPatterns,
    getPatternById,
    savePattern,
    deletePattern,
    incrementPatternComplete,
    decrementPatternComplete,
    getTodos,
    getTodoById,
    saveTodo,
    deleteTodo,
    cleanupTodos,
    getRecords,
    addRecord,
    deleteRecord,
    adjustBeanStock,
    adjustBeanReserved,
    initTestData,
    resetAll,
    exportAll,
    importAll
  };
})();
