// Options page script for FetchVideo Extension

document.addEventListener('DOMContentLoaded', initializeOptions);

// 默认设置
const defaultSettings = {
  downloadFolder: 'FetchVideo',
  namingRule: 'title',
  customFormat: '{domain}_{title}_{timestamp}',
  concurrentDownloads: 3,
  duplicateHandling: 'uniquify',
  autoDetect: true,
  detectionDepth: 'normal',
  minDuration: 5,
  supportedFormats: ['mp4', 'webm', 'm3u8'],
  showThumbnails: false,
  compactMode: false,
  showTechnicalInfo: true,
  debugMode: false,
  networkInterception: true,
  analytics: false
};

function initializeOptions() {
  loadSettings();
  bindEvents();
  updateCustomNamingVisibility();
}

function bindEvents() {
  // 命名规则变化
  document.getElementById('naming-rule').addEventListener('change', updateCustomNamingVisibility);
  
  // 保存按钮
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  
  // 重置按钮
  document.getElementById('reset-btn').addEventListener('click', resetSettings);
  
  // 导出按钮
  document.getElementById('export-btn').addEventListener('click', exportSettings);
  
  // 导入按钮
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  
  // 文件导入
  document.getElementById('import-file').addEventListener('change', importSettings);
  
  // 帮助按钮
  document.getElementById('folder-help').addEventListener('click', showFolderHelp);
}

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(defaultSettings);
    
    // 应用设置到界面
    document.getElementById('download-folder').value = result.downloadFolder || defaultSettings.downloadFolder;
    document.getElementById('naming-rule').value = result.namingRule || defaultSettings.namingRule;
    document.getElementById('custom-format').value = result.customFormat || defaultSettings.customFormat;
    document.getElementById('concurrent-downloads').value = result.concurrentDownloads || defaultSettings.concurrentDownloads;
    document.getElementById('duplicate-handling').value = result.duplicateHandling || defaultSettings.duplicateHandling;
    
    document.getElementById('auto-detect').checked = result.autoDetect !== false;
    document.getElementById('detection-depth').value = result.detectionDepth || defaultSettings.detectionDepth;
    document.getElementById('min-duration').value = result.minDuration || defaultSettings.minDuration;
    
    // 支持的格式
    const supportedFormats = result.supportedFormats || defaultSettings.supportedFormats;
    const formatCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
    formatCheckboxes.forEach(checkbox => {
      checkbox.checked = supportedFormats.includes(checkbox.value);
    });
    
    document.getElementById('show-thumbnails').checked = result.showThumbnails || false;
    document.getElementById('compact-mode').checked = result.compactMode || false;
    document.getElementById('show-technical-info').checked = result.showTechnicalInfo !== false;
    
    document.getElementById('debug-mode').checked = result.debugMode || false;
    document.getElementById('network-interception').checked = result.networkInterception !== false;
    document.getElementById('analytics').checked = result.analytics || false;
    
  } catch (error) {
    console.error('Failed to load settings:', error);
    showStatus('加载设置失败', true);
  }
}

async function saveSettings() {
  try {
    const supportedFormats = Array.from(document.querySelectorAll('.checkbox-group input[type="checkbox"]:checked'))
      .map(cb => cb.value);
    
    const settings = {
      downloadFolder: document.getElementById('download-folder').value,
      namingRule: document.getElementById('naming-rule').value,
      customFormat: document.getElementById('custom-format').value,
      concurrentDownloads: parseInt(document.getElementById('concurrent-downloads').value),
      duplicateHandling: document.getElementById('duplicate-handling').value,
      
      autoDetect: document.getElementById('auto-detect').checked,
      detectionDepth: document.getElementById('detection-depth').value,
      minDuration: parseInt(document.getElementById('min-duration').value),
      supportedFormats: supportedFormats,
      
      showThumbnails: document.getElementById('show-thumbnails').checked,
      compactMode: document.getElementById('compact-mode').checked,
      showTechnicalInfo: document.getElementById('show-technical-info').checked,
      
      debugMode: document.getElementById('debug-mode').checked,
      networkInterception: document.getElementById('network-interception').checked,
      analytics: document.getElementById('analytics').checked
    };
    
    await chrome.storage.sync.set(settings);
    showStatus('设置已保存');
    
    // 通知background script设置已更新
    chrome.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: settings
    });
    
  } catch (error) {
    console.error('Failed to save settings:', error);
    showStatus('保存设置失败', true);
  }
}

async function resetSettings() {
  if (confirm('确定要恢复默认设置吗？这将清除所有自定义配置。')) {
    try {
      await chrome.storage.sync.clear();
      await chrome.storage.sync.set(defaultSettings);
      location.reload();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      showStatus('重置设置失败', true);
    }
  }
}

function exportSettings() {
  chrome.storage.sync.get(null, (result) => {
    const dataStr = JSON.stringify(result, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'fetchvideo-settings.json';
    link.click();
    
    showStatus('设置已导出');
  });
}

function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const settings = JSON.parse(e.target.result);
      await chrome.storage.sync.set(settings);
      showStatus('设置已导入');
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      console.error('Failed to import settings:', error);
      showStatus('导入设置失败：文件格式错误', true);
    }
  };
  reader.readAsText(file);
}

function updateCustomNamingVisibility() {
  const namingRule = document.getElementById('naming-rule').value;
  const customNaming = document.getElementById('custom-naming');
  
  if (namingRule === 'custom') {
    customNaming.style.display = 'block';
  } else {
    customNaming.style.display = 'none';
  }
}

function showFolderHelp() {
  alert(`下载目录说明：
  
• 输入相对路径，文件将保存到默认下载文件夹的子目录
• 例如："FetchVideo" 将创建 Downloads/FetchVideo/ 目录
• 例如："Videos/Downloaded" 将创建 Downloads/Videos/Downloaded/ 目录
• 留空则直接保存到默认下载文件夹

注意：Chrome 扩展无法访问下载文件夹以外的位置。`);
}

function showStatus(message, isError = false) {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  statusElement.style.display = 'block';
  statusElement.style.color = isError ? '#d93025' : '#137333';
  statusElement.style.background = isError ? '#fce8e6' : '#e6f4ea';
  
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

console.log('FetchVideo options page initialized');
