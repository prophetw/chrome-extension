// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSearchEngines();
  await loadBatchSearchSettings();
  
  // 绑定添加搜索引擎按钮事件
  document.getElementById('addEngineBtn').addEventListener('click', addSearchEngine);
  
  // 绑定回车键事件
  document.getElementById('newEngineUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSearchEngine();
    }
  });
});

// 加载并显示搜索引擎列表
async function loadSearchEngines() {
  const result = await chrome.storage.sync.get(['searchEngines']);
  const searchEngines = result.searchEngines || [];
  
  const container = document.getElementById('searchEnginesList');
  container.innerHTML = '';
  
  searchEngines.forEach((engine, index) => {
    const engineDiv = document.createElement('div');
    engineDiv.className = `search-engine ${engine.enabled ? 'enabled' : ''}`;
    
    engineDiv.innerHTML = `
      <input type="checkbox" id="engine_${index}" ${engine.enabled ? 'checked' : ''}>
      <div class="engine-info">
        <div class="engine-name">${escapeHtml(engine.name)}</div>
        <div class="engine-url">${escapeHtml(engine.url)}</div>
      </div>
      ${index >= 3 ? `<button class="delete-btn" onclick="deleteEngine(${index})">删除</button>` : ''}
    `;
    
    // 绑定复选框变化事件
    const checkbox = engineDiv.querySelector(`#engine_${index}`);
    checkbox.addEventListener('change', async () => {
      await toggleEngine(index, checkbox.checked);
      // 重新加载批量搜索设置以更新可用选项
      await loadBatchSearchSettings();
    });
    
    container.appendChild(engineDiv);
  });
}

// 切换搜索引擎启用状态
async function toggleEngine(index, enabled) {
  const result = await chrome.storage.sync.get(['searchEngines']);
  const searchEngines = result.searchEngines || [];
  
  if (searchEngines[index]) {
    searchEngines[index].enabled = enabled;
    await chrome.storage.sync.set({ searchEngines });
    showSaveStatus('设置已保存');
    await loadSearchEngines(); // 重新加载以更新样式
  }
}

// 添加新搜索引擎
async function addSearchEngine() {
  const nameInput = document.getElementById('newEngineName');
  const urlInput = document.getElementById('newEngineUrl');
  
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  
  if (!name || !url) {
    showSaveStatus('请填写完整的搜索引擎信息', false);
    return;
  }
  
  if (!url.includes('%s')) {
    showSaveStatus('URL中必须包含 %s 作为搜索词占位符', false);
    return;
  }
  
  // 验证URL格式
  try {
    new URL(url.replace('%s', 'test'));
  } catch (e) {
    showSaveStatus('请输入有效的URL格式', false);
    return;
  }
  
  const result = await chrome.storage.sync.get(['searchEngines']);
  const searchEngines = result.searchEngines || [];
  
  // 检查是否已存在相同名称的搜索引擎
  if (searchEngines.some(engine => engine.name === name)) {
    showSaveStatus('已存在相同名称的搜索引擎', false);
    return;
  }
  
  // 生成唯一ID
  const id = 'custom_' + Date.now();
  
  // 添加新搜索引擎
  searchEngines.push({
    id,
    name,
    url,
    enabled: true
  });
  
  await chrome.storage.sync.set({ searchEngines });
  
  // 清空输入框
  nameInput.value = '';
  urlInput.value = '';
  
  showSaveStatus('搜索引擎添加成功');
  await loadSearchEngines();
  await loadBatchSearchSettings();
}

// 删除搜索引擎
async function deleteEngine(index) {
  if (!confirm('确定要删除这个搜索引擎吗？')) {
    return;
  }
  
  const result = await chrome.storage.sync.get(['searchEngines']);
  const searchEngines = result.searchEngines || [];
  
  if (searchEngines[index]) {
    searchEngines.splice(index, 1);
    await chrome.storage.sync.set({ searchEngines });
    showSaveStatus('搜索引擎删除成功');
    await loadSearchEngines();
    await loadBatchSearchSettings();
  }
}

// 显示保存状态信息
function showSaveStatus(message, isSuccess = true) {
  const statusDiv = document.getElementById('saveStatus');
  statusDiv.textContent = message;
  statusDiv.className = `save-status ${isSuccess ? 'success' : 'error'}`;
  statusDiv.style.display = 'block';
  
  // 3秒后隐藏
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// HTML转义函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 加载批量搜索设置
async function loadBatchSearchSettings() {
  const result = await chrome.storage.sync.get(['searchEngines', 'batchSearchEngines']);
  const searchEngines = result.searchEngines || [];
  const batchSearchEngines = result.batchSearchEngines || [];
  
  // 只显示启用的搜索引擎
  const enabledEngines = searchEngines.filter(engine => engine.enabled);
  
  const container = document.getElementById('batchSearchList');
  container.innerHTML = '';
  
  enabledEngines.forEach(engine => {
    const isSelected = batchSearchEngines.includes(engine.id);
    
    const engineDiv = document.createElement('div');
    engineDiv.className = `batch-engine ${isSelected ? 'selected' : ''}`;
    
    engineDiv.innerHTML = `
      <input type="checkbox" id="batch_${engine.id}" ${isSelected ? 'checked' : ''}>
      <div class="batch-engine-name">${escapeHtml(engine.name)}</div>
    `;
    
    // 绑定复选框变化事件
    const checkbox = engineDiv.querySelector(`#batch_${engine.id}`);
    checkbox.addEventListener('change', () => {
      toggleBatchEngine(engine.id, checkbox.checked);
    });
    
    container.appendChild(engineDiv);
  });
}

// 切换批量搜索引擎
async function toggleBatchEngine(engineId, enabled) {
  const result = await chrome.storage.sync.get(['batchSearchEngines']);
  let batchSearchEngines = result.batchSearchEngines || [];
  
  if (enabled) {
    if (!batchSearchEngines.includes(engineId)) {
      batchSearchEngines.push(engineId);
    }
  } else {
    batchSearchEngines = batchSearchEngines.filter(id => id !== engineId);
  }
  
  await chrome.storage.sync.set({ batchSearchEngines });
  await loadBatchSearchSettings();
  showSaveStatus('批量搜索设置已保存');
}

// 全选批量搜索引擎
async function selectAllBatch() {
  const result = await chrome.storage.sync.get(['searchEngines']);
  const searchEngines = result.searchEngines || [];
  const enabledEngines = searchEngines.filter(engine => engine.enabled);
  const batchSearchEngines = enabledEngines.map(engine => engine.id);
  
  await chrome.storage.sync.set({ batchSearchEngines });
  await loadBatchSearchSettings();
  showSaveStatus('已全选所有搜索引擎');
}

// 清空批量搜索引擎选择
async function clearAllBatch() {
  await chrome.storage.sync.set({ batchSearchEngines: [] });
  await loadBatchSearchSettings();
  showSaveStatus('已清空批量搜索选择');
}

// 全局函数供HTML调用
window.deleteEngine = deleteEngine;
