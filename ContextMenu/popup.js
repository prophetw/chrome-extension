// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadGroups();
  await loadSearchEngines();
  await loadBatchGroupSettings();
  await loadGroupOptions();
  
  // 绑定添加搜索引擎按钮事件
  document.getElementById('addEngineBtn').addEventListener('click', addSearchEngine);
  
  // 绑定添加分组按钮事件
  document.getElementById('addGroupBtn').addEventListener('click', addGroup);
  
  // 绑定回车键事件
  document.getElementById('newEngineUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSearchEngine();
    }
  });
  
  document.getElementById('newGroupName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addGroup();
    }
  });
});

// 加载并显示搜索引擎列表
async function loadSearchEngines() {
  const result = await chrome.storage.sync.get(['searchEngines', 'searchGroups']);
  const searchEngines = result.searchEngines || [];
  const searchGroups = result.searchGroups || [];
  
  const container = document.getElementById('searchEnginesList');
  container.innerHTML = '<h3>搜索引擎管理</h3>';
  
  // 按分组显示搜索引擎
  searchGroups.forEach(group => {
    const groupEngines = searchEngines.filter(engine => engine.groupId === group.id);
    
    if (groupEngines.length > 0) {
      const groupDiv = document.createElement('div');
      groupDiv.innerHTML = `<h4 style="margin: 20px 0 10px 0; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px;">${escapeHtml(group.name)}</h4>`;
      container.appendChild(groupDiv);
      
      groupEngines.forEach((engine, index) => {
        const engineDiv = document.createElement('div');
        engineDiv.className = `search-engine ${engine.enabled ? 'enabled' : ''}`;
        
        // 找到在原数组中的实际索引
        const actualIndex = searchEngines.findIndex(e => e.id === engine.id);
        
        engineDiv.innerHTML = `
          <input type="checkbox" id="engine_${actualIndex}" ${engine.enabled ? 'checked' : ''}>
          <div class="engine-info">
            <div class="engine-name">${escapeHtml(engine.name)}</div>
            <div class="engine-url">${escapeHtml(engine.url)}</div>
          </div>
          <select class="engine-group-select" id="group_${actualIndex}">
            ${searchGroups.map(g => `<option value="${g.id}" ${g.id === engine.groupId ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}
          </select>
          ${actualIndex >= 5 ? `<button class="delete-btn" onclick="deleteEngine(${actualIndex})">删除</button>` : ''}
        `;
        
        // 绑定复选框变化事件
        const checkbox = engineDiv.querySelector(`#engine_${actualIndex}`);
        checkbox.addEventListener('change', async () => {
          await toggleEngine(actualIndex, checkbox.checked);
          await loadBatchGroupSettings();
        });
        
        // 绑定分组选择变化事件
        const groupSelect = engineDiv.querySelector(`#group_${actualIndex}`);
        groupSelect.addEventListener('change', async () => {
          await changeEngineGroup(actualIndex, groupSelect.value);
        });
        
        container.appendChild(engineDiv);
      });
    }
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
  const groupSelect = document.getElementById('newEngineGroup');
  
  const name = nameInput.value.trim();
  const url = urlInput.value.trim();
  const groupId = groupSelect.value;
  
  if (!name || !url) {
    showSaveStatus('请填写完整的搜索引擎信息', false);
    return;
  }
  
  if (!groupId) {
    showSaveStatus('请选择一个分组', false);
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
    enabled: true,
    groupId
  });
  
  await chrome.storage.sync.set({ searchEngines });
  
  // 清空输入框
  nameInput.value = '';
  urlInput.value = '';
  groupSelect.value = '';
  
  showSaveStatus('搜索引擎添加成功');
  await loadSearchEngines();
  await loadBatchGroupSettings();
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
    await loadBatchGroupSettings();
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

// 加载分组批量搜索设置
async function loadBatchGroupSettings() {
  const result = await chrome.storage.sync.get(['searchEngines', 'batchSearchGroups', 'searchGroups']);
  const searchEngines = result.searchEngines || [];
  const batchSearchGroups = result.batchSearchGroups || [];
  const searchGroups = result.searchGroups || [];
  
  const container = document.getElementById('batchGroupsList');
  container.innerHTML = '';
  
  searchGroups.forEach(group => {
    const groupEngines = searchEngines.filter(engine => engine.enabled && engine.groupId === group.id);
    const isSelected = batchSearchGroups.includes(group.id);
    
    const groupDiv = document.createElement('div');
    groupDiv.className = `batch-group ${isSelected ? 'selected' : ''}`;
    
    groupDiv.innerHTML = `
      <input type="checkbox" id="batchGroup_${group.id}" ${isSelected ? 'checked' : ''} ${groupEngines.length < 2 ? 'disabled' : ''}>
      <div class="batch-group-info">
        <div class="batch-group-name">${escapeHtml(group.name)}</div>
        <div class="batch-group-engines">${groupEngines.length} 个启用的搜索引擎</div>
      </div>
    `;
    
    // 如果分组中少于2个启用的搜索引擎，禁用复选框
    if (groupEngines.length < 2) {
      groupDiv.style.opacity = '0.5';
    }
    
    // 绑定复选框变化事件
    const checkbox = groupDiv.querySelector(`#batchGroup_${group.id}`);
    checkbox.addEventListener('change', () => {
      toggleBatchGroup(group.id, checkbox.checked);
    });
    
    container.appendChild(groupDiv);
  });
}

// 切换分组批量搜索
async function toggleBatchGroup(groupId, enabled) {
  const result = await chrome.storage.sync.get(['batchSearchGroups']);
  let batchSearchGroups = result.batchSearchGroups || [];
  
  if (enabled) {
    if (!batchSearchGroups.includes(groupId)) {
      batchSearchGroups.push(groupId);
    }
  } else {
    batchSearchGroups = batchSearchGroups.filter(id => id !== groupId);
  }
  
  await chrome.storage.sync.set({ batchSearchGroups });
  await loadBatchGroupSettings();
  showSaveStatus('分组批量搜索设置已保存');
}

// 全选分组批量搜索
async function selectAllBatchGroups() {
  const result = await chrome.storage.sync.get(['searchGroups', 'searchEngines']);
  const searchGroups = result.searchGroups || [];
  const searchEngines = result.searchEngines || [];
  
  // 只选择有2个或以上启用搜索引擎的分组
  const batchSearchGroups = searchGroups.filter(group => {
    const groupEngines = searchEngines.filter(engine => engine.enabled && engine.groupId === group.id);
    return groupEngines.length >= 2;
  }).map(group => group.id);
  
  await chrome.storage.sync.set({ batchSearchGroups });
  await loadBatchGroupSettings();
  showSaveStatus('已全选所有可用分组');
}

// 清空分组批量搜索选择
async function clearAllBatchGroups() {
  await chrome.storage.sync.set({ batchSearchGroups: [] });
  await loadBatchGroupSettings();
  showSaveStatus('已清空分组批量搜索选择');
}

// 加载并显示分组列表
async function loadGroups() {
  const result = await chrome.storage.sync.get(['searchGroups', 'searchEngines']);
  const searchGroups = result.searchGroups || [];
  const searchEngines = result.searchEngines || [];
  
  const container = document.getElementById('groupsList');
  container.innerHTML = '';
  
  searchGroups.forEach((group, index) => {
    const groupEngines = searchEngines.filter(engine => engine.groupId === group.id);
    
    const groupDiv = document.createElement('div');
    groupDiv.className = `group-item ${group.enabled ? 'enabled' : ''}`;
    
    groupDiv.innerHTML = `
      <input type="checkbox" id="group_${index}" ${group.enabled ? 'checked' : ''}>
      <div class="group-info">
        <div class="group-name">${escapeHtml(group.name)}</div>
        <div class="group-engines-count">${groupEngines.length} 个搜索引擎</div>
      </div>
      ${index >= 3 ? `<button class="delete-btn" onclick="deleteGroup(${index})">删除</button>` : ''}
    `;
    
    // 绑定复选框变化事件
    const checkbox = groupDiv.querySelector(`#group_${index}`);
    checkbox.addEventListener('change', async () => {
      await toggleGroup(index, checkbox.checked);
    });
    
    container.appendChild(groupDiv);
  });
}

// 切换分组启用状态
async function toggleGroup(index, enabled) {
  const result = await chrome.storage.sync.get(['searchGroups']);
  const searchGroups = result.searchGroups || [];
  
  if (searchGroups[index]) {
    searchGroups[index].enabled = enabled;
    await chrome.storage.sync.set({ searchGroups });
    showSaveStatus('分组设置已保存');
    await loadGroups();
  }
}

// 添加新分组
async function addGroup() {
  const nameInput = document.getElementById('newGroupName');
  const name = nameInput.value.trim();
  
  if (!name) {
    showSaveStatus('请输入分组名称', false);
    return;
  }
  
  const result = await chrome.storage.sync.get(['searchGroups']);
  const searchGroups = result.searchGroups || [];
  
  // 检查是否已存在相同名称的分组
  if (searchGroups.some(group => group.name === name)) {
    showSaveStatus('已存在相同名称的分组', false);
    return;
  }
  
  // 生成唯一ID
  const id = 'group_' + Date.now();
  
  // 添加新分组
  searchGroups.push({
    id,
    name,
    enabled: true
  });
  
  await chrome.storage.sync.set({ searchGroups });
  
  // 清空输入框
  nameInput.value = '';
  
  showSaveStatus('分组添加成功');
  await loadGroups();
  await loadGroupOptions();
}

// 删除分组
async function deleteGroup(index) {
  const result = await chrome.storage.sync.get(['searchGroups', 'searchEngines']);
  const searchGroups = result.searchGroups || [];
  const searchEngines = result.searchEngines || [];
  
  if (!searchGroups[index]) return;
  
  const group = searchGroups[index];
  const groupEngines = searchEngines.filter(engine => engine.groupId === group.id);
  
  if (groupEngines.length > 0) {
    showSaveStatus('不能删除包含搜索引擎的分组，请先移动或删除其中的搜索引擎', false);
    return;
  }
  
  if (!confirm('确定要删除这个分组吗？')) {
    return;
  }
  
  searchGroups.splice(index, 1);
  await chrome.storage.sync.set({ searchGroups });
  showSaveStatus('分组删除成功');
  await loadGroups();
  await loadGroupOptions();
}

// 更改搜索引擎分组
async function changeEngineGroup(engineIndex, newGroupId) {
  const result = await chrome.storage.sync.get(['searchEngines']);
  const searchEngines = result.searchEngines || [];
  
  if (searchEngines[engineIndex]) {
    searchEngines[engineIndex].groupId = newGroupId;
    await chrome.storage.sync.set({ searchEngines });
    showSaveStatus('搜索引擎分组已更新');
    await loadSearchEngines();
    await loadGroups();
  }
}

// 加载分组选项到下拉菜单
async function loadGroupOptions() {
  const result = await chrome.storage.sync.get(['searchGroups']);
  const searchGroups = result.searchGroups || [];
  
  const select = document.getElementById('newEngineGroup');
  select.innerHTML = '<option value="">选择分组</option>';
  
  searchGroups.forEach(group => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    select.appendChild(option);
  });
}

// 全局函数供HTML调用
window.deleteEngine = deleteEngine;
window.deleteGroup = deleteGroup;
window.selectAllBatchGroups = selectAllBatchGroups;
window.clearAllBatchGroups = clearAllBatchGroups;
