/* ==================== 主应用入口和路由 ==================== */

const App = (function () {
  const PAGES = [
    { key: 'home', label: '首页', icon: '🏠', renderer: () => HomePage.render() },
    { key: 'beans', label: '我的豆子', icon: '🫘', renderer: () => BeansPage.render() },
    { key: 'patterns', label: '我的图纸', icon: '🖼️', renderer: () => PatternsPage.render() },
    { key: 'todo', label: '待拼清单', icon: '📝', renderer: () => TodoPage.render() },
    { key: 'records', label: '库存记录', icon: '📋', renderer: () => RecordsPage.render() },
    { key: 'sync', label: '数据同步', icon: '🔄', renderer: () => SyncPage.render() }
  ];

  let currentPage = 'home';

  /* ---------- 初始化 ---------- */
  function init() {
    // 初始化测试数据
    Storage.initTestData();

    // 清理待拼清单中的冗余大字段（旧版本会在 todo 中存储 base64 图片）
    Storage.cleanupTodos();

    // 渲染导航
    renderNav();

    // 读取 hash 路由
    const hash = window.location.hash.replace('#', '');
    const validKeys = PAGES.map(p => p.key);
    if (hash && validKeys.indexOf(hash) >= 0) {
      currentPage = hash;
    }

    // 渲染当前页面
    navigate(currentPage);

    // 监听 hash 变化
    window.addEventListener('hashchange', function () {
      const h = window.location.hash.replace('#', '');
      if (h && validKeys.indexOf(h) >= 0 && h !== currentPage) {
        navigate(h);
      }
    });
  }

  /* ---------- 渲染导航 ---------- */
  function renderNav() {
    const navMenu = document.querySelector('.nav-menu');
    const bottomNav = document.querySelector('.bottom-nav');

    const topHtml = PAGES.map(p =>
      '<li><a data-nav="' + p.key + '">' + p.label + '</a></li>'
    ).join('');

    const bottomHtml = PAGES.map(p =>
      '<a data-nav="' + p.key + '"><span class="nav-icon">' + p.icon + '</span><span>' + p.label + '</span></a>'
    ).join('');

    if (navMenu) navMenu.innerHTML = topHtml;
    if (bottomNav) bottomNav.innerHTML = bottomHtml;

    // 绑定导航点击
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        navigate(this.getAttribute('data-nav'));
      });
    });
  }

  /* ---------- 页面切换 ---------- */
  function navigate(pageKey) {
    const page = PAGES.find(p => p.key === pageKey);
    if (!page) return;

    currentPage = pageKey;

    // 切换页面显示
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('page-' + pageKey);
    if (target) target.classList.add('active');

    // 更新导航高亮
    document.querySelectorAll('[data-nav]').forEach(el => {
      if (el.getAttribute('data-nav') === pageKey) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // 更新 URL hash
    if (window.location.hash !== '#' + pageKey) {
      window.location.hash = pageKey;
    }

    // 渲染页面内容
    try {
      page.renderer();
    } catch (e) {
      console.error('渲染页面失败:', pageKey, e);
      document.getElementById('page-' + pageKey).innerHTML =
        '<div class="empty-state"><div class="empty-state-icon">⚠️</div>' +
        '<div class="empty-state-text">页面加载失败：' + e.message + '</div></div>';
    }

    // 滚动到顶部
    window.scrollTo(0, 0);

    // 更新导航计数
    updateNavCounts();
  }

  /* ---------- 更新导航上的计数徽章 ---------- */
  function updateNavCounts() {
    const beans = Storage.getBeans();
    const todos = Storage.getTodos();

    const lowStockCount = beans.filter(b => {
      const s = UI.getBeanStatus(b);
      return s.key === 'low' || s.key === 'out' || s.key === 'insufficient';
    }).length;

    const pendingTodoCount = todos.filter(t =>
      t.status === '想拼' || t.status === '准备中' || t.status === '正在拼' || t.status === '已暂停'
    ).length;

    // 给"我的豆子"导航加上低库存红点
    const beansNav = document.querySelector('.nav-menu [data-nav="beans"]');
    if (beansNav) {
      if (lowStockCount > 0) {
        beansNav.innerHTML = '我的豆子 <span class="badge badge-danger" style="margin-left:4px;font-size:10px">' + lowStockCount + '</span>';
      } else {
        beansNav.innerHTML = '我的豆子';
      }
    }

    // 给"待拼清单"导航加上待办计数
    const todoNav = document.querySelector('.nav-menu [data-nav="todo"]');
    if (todoNav) {
      if (pendingTodoCount > 0) {
        todoNav.innerHTML = '待拼清单 <span class="badge badge-warning" style="margin-left:4px;font-size:10px">' + pendingTodoCount + '</span>';
      } else {
        todoNav.innerHTML = '待拼清单';
      }
    }

    // 底部导航也加
    const beansBottom = document.querySelector('.bottom-nav [data-nav="beans"]');
    if (beansBottom) {
      const label = beansBottom.querySelector('span:last-child');
      if (label) {
        label.textContent = lowStockCount > 0 ? '豆子(' + lowStockCount + ')' : '我的豆子';
      }
    }

    const todoBottom = document.querySelector('.bottom-nav [data-nav="todo"]');
    if (todoBottom) {
      const label = todoBottom.querySelector('span:last-child');
      if (label) {
        label.textContent = pendingTodoCount > 0 ? '待拼(' + pendingTodoCount + ')' : '待拼清单';
      }
    }
  }

  return {
    init: init,
    navigate: navigate,
    updateNavCounts: updateNavCounts,
    getCurrentPage: () => currentPage
  };
})();

/* ---------- DOM 加载完成后启动 ---------- */
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
