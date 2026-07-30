/* ==================== 数据同步（导出/导入） ==================== */

const SyncPage = (function () {
  let eventsBound = false;

  function render() {
    const beans = Storage.getBeans();
    const patterns = Storage.getPatterns();
    const todos = Storage.getTodos();
    const records = Storage.getRecords();

    // 估算数据大小
    const dataSize = JSON.stringify(Storage.exportAll()).length;
    const sizeKB = (dataSize / 1024).toFixed(1);
    const sizeMB = (dataSize / 1024 / 1024).toFixed(2);

    const html =
      '<div class="page-header">' +
      '  <div>' +
      '    <h1 class="page-title">数据同步</h1>' +
      '    <div class="page-subtitle">在手机和电脑之间同步数据</div>' +
      '  </div>' +
      '</div>' +

      // 数据概览
      '<div class="card mb-16">' +
      '  <div class="card-title">当前数据概览</div>' +
      '  <div class="flex gap-12" style="flex-wrap:wrap">' +
      '    <span class="badge badge-info">豆子 ' + beans.length + ' 条</span>' +
      '    <span class="badge badge-info">图纸 ' + patterns.length + ' 条</span>' +
      '    <span class="badge badge-info">待拼 ' + todos.length + ' 条</span>' +
      '    <span class="badge badge-info">记录 ' + records.length + ' 条</span>' +
      '    <span class="badge badge-gray">数据大小 ' + sizeMB + ' MB</span>' +
      '  </div>' +
      '</div>' +

      // 导出区域
      '<div class="card mb-16">' +
      '  <div class="card-title">📤 导出数据</div>' +
      '  <p class="small muted mb-12">将当前所有数据导出，用于同步到其他设备。</p>' +
      '  <div class="flex gap-12" style="flex-wrap:wrap">' +
      '    <button class="btn btn-primary" data-action="export-file">下载备份文件</button>' +
      '    <button class="btn btn-outline" data-action="export-copy">复制到剪贴板</button>' +
      '    <button class="btn btn-outline" data-action="export-show-text">显示数据文本</button>' +
      '  </div>' +
      '  <div id="exportTextWrap" style="display:none;margin-top:12px">' +
      '    <textarea id="exportText" style="width:100%;height:200px;font-size:12px;border:1px solid var(--gray-200);border-radius:6px;padding:8px;font-family:monospace" readonly></textarea>' +
      '  </div>' +
      '</div>' +

      // 导入区域
      '<div class="card mb-16">' +
      '  <div class="card-title">📥 导入数据</div>' +
      '  <p class="small muted mb-12">从备份文件导入数据，<b class="text-danger">会覆盖当前所有数据</b>。</p>' +
      '  <div class="flex gap-12" style="flex-wrap:wrap;align-items:center">' +
      '    <input type="file" id="importFile" accept=".json" style="font-size:13px">' +
      '    <button class="btn btn-primary" data-action="import-file" id="importFileBtn" disabled>导入文件</button>' +
      '  </div>' +
      '  <div style="margin-top:12px">' +
      '    <label class="small text-bold">或粘贴数据文本：</label>' +
      '    <textarea id="importText" placeholder="粘贴之前导出的数据文本…" style="width:100%;height:120px;font-size:12px;border:1px solid var(--gray-200);border-radius:6px;padding:8px;margin-top:4px;font-family:monospace"></textarea>' +
      '    <button class="btn btn-primary mt-8" data-action="import-text" id="importTextBtn" disabled>导入文本数据</button>' +
      '  </div>' +
      '</div>' +

      // 使用说明
      '<div class="card" style="background:var(--gray-50)">' +
      '  <div class="card-title">📱 同步到手机的方法</div>' +
      '  <ol style="padding-left:20px;line-height:2">' +
      '    <li>在电脑上点击<b>「下载备份文件」</b>，会得到一个 JSON 文件</li>' +
      '    <li>把文件发送到手机（微信/QQ/邮件均可）</li>' +
      '    <li>手机浏览器打开 <code>http://192.168.0.5:8080</code>（需同一 Wi-Fi）</li>' +
      '    <li>点击首页「数据同步」，选择<b>「导入文件」</b>，选择收到的 JSON 文件</li>' +
      '    <li>导入完成后即可在手机上使用全部数据</li>' +
      '  </ol>' +
      '  <div class="alert alert-warning" style="margin-top:8px">' +
      '    <span class="alert-icon">!</span>' +
      '    <div class="small">注意：导入会<b>覆盖</b>手机上的现有数据。每次修改后如需同步，请重新导出导入。</div>' +
      '  </div>' +
      '</div>';

    document.getElementById('page-sync').innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const page = document.getElementById('page-sync');

    page.addEventListener('click', function (e) {
      const btn = UI.closestAction(e.target, '[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');

      if (action === 'export-file') {
        exportToFile();
      } else if (action === 'export-copy') {
        exportToClipboard();
      } else if (action === 'export-show-text') {
        var wrap = page.querySelector('#exportTextWrap');
        var ta = page.querySelector('#exportText');
        if (wrap.style.display === 'none') {
          ta.value = JSON.stringify(Storage.exportAll());
          wrap.style.display = 'block';
          btn.textContent = '隐藏数据文本';
        } else {
          wrap.style.display = 'none';
          btn.textContent = '显示数据文本';
        }
      } else if (action === 'import-file') {
        importFromFile(page);
      } else if (action === 'import-text') {
        importFromText(page);
      }
    });

    // 文件选择后启用导入按钮
    page.querySelector('#importFile').addEventListener('change', function (e) {
      var importBtn = page.querySelector('#importFileBtn');
      importBtn.disabled = !e.target.files[0];
      if (e.target.files[0]) {
        importBtn.textContent = '导入：' + e.target.files[0].name;
      } else {
        importBtn.textContent = '导入文件';
      }
    });

    // 文本框输入后启用导入按钮
    page.querySelector('#importText').addEventListener('input', function (e) {
      var importBtn = page.querySelector('#importTextBtn');
      importBtn.disabled = !e.target.value.trim();
    });
  }

  /* ---------- 导出为文件 ---------- */
  function exportToFile() {
    var data = Storage.exportAll();
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var now = new Date();
    var ts = now.getFullYear() + '' +
      String(now.getMonth() + 1).padStart(2, '0') + '' +
      String(now.getDate()).padStart(2, '0') + '_' +
      String(now.getHours()).padStart(2, '0') + '' +
      String(now.getMinutes()).padStart(2, '0');
    a.href = url;
    a.download = 'pdb_backup_' + ts + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('备份文件已下载', 'success');
  }

  /* ---------- 复制到剪贴板 ---------- */
  function exportToClipboard() {
    var json = JSON.stringify(Storage.exportAll());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function () {
        UI.toast('数据已复制到剪贴板', 'success');
      }).catch(function () {
        fallbackCopy(json);
      });
    } else {
      fallbackCopy(json);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      UI.toast('数据已复制到剪贴板', 'success');
    } catch (e) {
      UI.toast('复制失败，请使用「显示数据文本」手动复制', 'error');
    }
    document.body.removeChild(ta);
  }

  /* ---------- 从文件导入 ---------- */
  function importFromFile(page) {
    var fileInput = page.querySelector('#importFile');
    if (!fileInput.files[0]) return;
    var file = fileInput.files[0];
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        doImport(data);
      } catch (err) {
        UI.alert({ title: '导入失败', message: '文件格式不正确，无法解析：' + err.message });
      }
    };
    reader.onerror = function () {
      UI.toast('读取文件失败', 'error');
    };
    reader.readAsText(file);
  }

  /* ---------- 从文本导入 ---------- */
  function importFromText(page) {
    var text = page.querySelector('#importText').value.trim();
    if (!text) return;
    try {
      var data = JSON.parse(text);
      doImport(data);
    } catch (err) {
      UI.alert({ title: '导入失败', message: '数据格式不正确，无法解析：' + err.message });
    }
  }

  /* ---------- 执行导入 ---------- */
  function doImport(data) {
    if (!data || !data.beans || !data.patterns) {
      UI.alert({ title: '导入失败', message: '数据不完整，缺少必要字段。' });
      return;
    }

    UI.confirm({
      title: '确认导入',
      message: '即将导入：豆子 ' + (data.beans ? data.beans.length : 0) + ' 条、图纸 ' + (data.patterns ? data.patterns.length : 0) + ' 条、待拼 ' + (data.todos ? data.todos.length : 0) + ' 条。',
      detail: '⚠️ 导入会覆盖当前所有数据，此操作不可撤销。',
      danger: true,
      okText: '确认导入'
    }).then(function (ok) {
      if (!ok) return;
      var success = Storage.importAll(data);
      if (success) {
        UI.toast('导入成功！', 'success');
        render();
        App.updateNavCounts();
        // 如果当前在首页则刷新
        if (typeof HomePage !== 'undefined') HomePage.render();
      } else {
        UI.alert({ title: '导入失败', message: '数据写入失败，可能是存储空间不足。' });
      }
    });
  }

  return { render: render };
})();
/* =========================================================
   拼豆工作台：数据导出 / 导入
   作用：
   1. 导出当前页面域名下的全部 localStorage 数据
   2. 将导出的 JSON 数据导入另一个访问地址
   3. 导入前自动下载当前数据备份
   ========================================================= */

(function () {
  'use strict';

  const BACKUP_VERSION = '1.0';
  const PANEL_ID = 'perler-data-transfer-panel';
  const FILE_INPUT_ID = 'perler-data-import-input';

  /**
   * 生成安全的日期时间字符串
   * 示例：2026-07-30_14-35-20
   */
  function getDateTimeString() {
    const now = new Date();

    const pad = (number) => String(number).padStart(2, '0');

    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join('-') +
      '_' +
      [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
      ].join('-');
  }

  /**
   * 获取当前 localStorage 的全部内容
   */
  function collectLocalStorageData() {
    const data = {};

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (key !== null) {
        data[key] = localStorage.getItem(key);
      }
    }

    return data;
  }

  /**
   * 创建完整备份对象
   */
  function createBackupObject() {
    return {
      appName: '拼豆工作台',
      backupVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      sourceUrl: window.location.href,
      sourceOrigin: window.location.origin,
      itemCount: localStorage.length,
      localStorage: collectLocalStorageData()
    };
  }

  /**
   * 将数据对象下载为 JSON
   */
  function downloadJson(data, filename) {
    const jsonText = JSON.stringify(data, null, 2);

    const blob = new Blob([jsonText], {
      type: 'application/json;charset=utf-8'
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = downloadUrl;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);
  }

  /**
   * 导出全部数据
   */
  function exportWorkbenchData(options = {}) {
    try {
      const backup = createBackupObject();

      const prefix = options.prefix || '拼豆工作台备份';
      const filename = `${prefix}-${getDateTimeString()}.json`;

      downloadJson(backup, filename);

      if (!options.silent) {
        alert(
          `数据导出成功！\n\n` +
          `共导出 ${backup.itemCount} 个数据项目。\n` +
          `文件名：${filename}\n\n` +
          `请妥善保存这个 JSON 文件。`
        );
      }

      return backup;
    } catch (error) {
      console.error('导出数据失败：', error);

      if (!options.silent) {
        alert(`数据导出失败：${error.message}`);
      }

      return null;
    }
  }

  /**
   * 检查备份文件格式
   */
  function validateBackup(backup) {
    if (!backup || typeof backup !== 'object') {
      throw new Error('备份内容不是有效对象');
    }

    if (
      !backup.localStorage ||
      typeof backup.localStorage !== 'object' ||
      Array.isArray(backup.localStorage)
    ) {
      throw new Error('备份文件中缺少 localStorage 数据');
    }

    const keys = Object.keys(backup.localStorage);

    if (keys.length === 0) {
      throw new Error('备份文件中没有可导入的数据');
    }

    return keys;
  }

  /**
   * 将备份数据写入 localStorage
   */
  function restoreLocalStorageData(backup, clearExistingData) {
    const data = backup.localStorage;

    if (clearExistingData) {
      localStorage.clear();
    }

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string') {
        localStorage.setItem(key, value);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    });
  }

  /**
   * 读取并导入 JSON 文件
   */
  function importWorkbenchData(file) {
    if (!file) {
      return;
    }

    if (
      !file.name.toLowerCase().endsWith('.json') &&
      file.type !== 'application/json'
    ) {
      alert('请选择 JSON 格式的备份文件。');
      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      try {
        const text = event.target.result;
        const backup = JSON.parse(text);
        const keys = validateBackup(backup);

        const backupInfo = [
          `文件：${file.name}`,
          `数据项目：${keys.length} 个`,
          `导出时间：${backup.exportedAt || '未知'}`,
          `来源：${backup.sourceUrl || '未知'}`
        ].join('\n');

        const confirmed = confirm(
          `即将导入以下备份：\n\n` +
          `${backupInfo}\n\n` +
          `导入会覆盖当前工作台的数据。\n` +
          `系统会先自动下载一份当前数据备份。\n\n` +
          `确定继续吗？`
        );

        if (!confirmed) {
          resetFileInput();
          return;
        }

        // 导入前自动下载当前数据
        exportWorkbenchData({
          prefix: '拼豆工作台-导入前自动备份',
          silent: true
        });

        // 使用短暂延迟，保证浏览器有时间开始下载自动备份
        setTimeout(() => {
          try {
            restoreLocalStorageData(backup, true);

            alert(
              `数据导入成功！\n\n` +
              `已恢复 ${keys.length} 个数据项目。\n` +
              `页面即将自动刷新。`
            );

            window.location.reload();
          } catch (restoreError) {
            console.error('恢复数据失败：', restoreError);

            alert(
              `数据写入失败：${restoreError.message}\n\n` +
              `请保留刚才自动下载的备份文件。`
            );

            resetFileInput();
          }
        }, 500);
      } catch (error) {
        console.error('导入数据失败：', error);

        alert(
          `导入失败：${error.message}\n\n` +
          `请确认选择的是由拼豆工作台导出的 JSON 备份文件。`
        );

        resetFileInput();
      }
    };

    reader.onerror = function () {
      alert('无法读取这个文件，请重新选择。');
      resetFileInput();
    };

    reader.readAsText(file, 'UTF-8');
  }

  /**
   * 重置文件选择框
   * 这样可以连续选择同一个文件
   */
  function resetFileInput() {
    const input = document.getElementById(FILE_INPUT_ID);

    if (input) {
      input.value = '';
    }
  }

  /**
   * 创建按钮
   */
  function createButton(text, type) {
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = text;

    button.style.cssText = [
      'border:none',
      'border-radius:8px',
      'padding:10px 14px',
      'font-size:14px',
      'font-weight:600',
      'cursor:pointer',
      'white-space:nowrap',
      'box-shadow:0 2px 8px rgba(0,0,0,0.12)',
      'transition:transform 0.15s ease, opacity 0.15s ease'
    ].join(';');

    if (type === 'export') {
      button.style.background = '#ff7043';
      button.style.color = '#ffffff';
    } else {
      button.style.background = '#ffffff';
      button.style.color = '#333333';
      button.style.border = '1px solid #dddddd';
    }

    button.addEventListener('mouseenter', () => {
      button.style.transform = 'translateY(-1px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
    });

    return button;
  }

  /**
   * 创建页面右下角的数据同步面板
   */
  function createDataTransferPanel() {
    if (document.getElementById(PANEL_ID)) {
      return;
    }

    const panel = document.createElement('div');
    panel.id = PANEL_ID;

    panel.style.cssText = [
      'position:fixed',
      'right:20px',
      'bottom:20px',
      'z-index:99999',
      'display:flex',
      'gap:10px',
      'align-items:center',
      'padding:10px',
      'border-radius:12px',
      'background:rgba(255,255,255,0.96)',
      'box-shadow:0 4px 20px rgba(0,0,0,0.16)',
      'backdrop-filter:blur(8px)'
    ].join(';');

    const exportButton = createButton('导出数据', 'export');
    const importButton = createButton('导入数据', 'import');

    const fileInput = document.createElement('input');
    fileInput.id = FILE_INPUT_ID;
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.hidden = true;

    exportButton.addEventListener('click', () => {
      exportWorkbenchData();
    });

    importButton.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const selectedFile = fileInput.files && fileInput.files[0];

      importWorkbenchData(selectedFile);
    });

    panel.appendChild(exportButton);
    panel.appendChild(importButton);
    panel.appendChild(fileInput);

    document.body.appendChild(panel);
  }

  /**
   * 暴露为全局方法，方便以后导航菜单调用
   */
  window.exportWorkbenchData = exportWorkbenchData;
  window.importWorkbenchData = importWorkbenchData;

  /**
   * 页面加载完成后创建按钮
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createDataTransferPanel);
  } else {
    createDataTransferPanel();
  }
})();
