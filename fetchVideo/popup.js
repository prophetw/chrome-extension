// Popup script for FetchVideo Extension

document.addEventListener('DOMContentLoaded', initializePopup);

// 全局变量
let currentVideos = [];
let selectedVideos = new Set();
let isLoading = false;

// DOM元素
let elements = {};

function initializePopup() {
  // 获取DOM元素
  elements = {
    videoCount: document.getElementById('video-count'),
    pageDomain: document.getElementById('page-domain'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    loading: document.getElementById('loading'),
    noVideos: document.getElementById('no-videos'),
    videoList: document.getElementById('video-list'),
    batchControls: document.getElementById('batch-controls'),
    selectedCount: document.getElementById('selected-count'),
    downloadStatus: document.getElementById('download-status'),
    
    refreshBtn: document.getElementById('refresh-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    retryBtn: document.getElementById('retry-btn'),
    selectAllBtn: document.getElementById('select-all-btn'),
    clearSelectionBtn: document.getElementById('clear-selection-btn'),
    batchDownloadBtn: document.getElementById('batch-download-btn'),
    helpLink: document.getElementById('help-link'),
    feedbackLink: document.getElementById('feedback-link')
  };

  // 绑定事件
  bindEvents();
  
  // 初始化加载
  loadVideos();
  loadPageInfo();
}

function bindEvents() {
  // 刷新按钮
  elements.refreshBtn.addEventListener('click', handleRefresh);
  
  // 设置按钮
  elements.settingsBtn.addEventListener('click', handleSettings);
  
  // 重试按钮
  elements.retryBtn.addEventListener('click', handleRefresh);
  
  // 搜索
  elements.searchInput.addEventListener('input', handleSearch);
  elements.searchClear.addEventListener('click', clearSearch);
  
  // 批量操作
  elements.selectAllBtn.addEventListener('click', selectAllVideos);
  elements.clearSelectionBtn.addEventListener('click', clearSelection);
  elements.batchDownloadBtn.addEventListener('click', batchDownload);
  
  // 链接
  elements.helpLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/your-username/chrome-extension#usage' });
  });
  
  elements.feedbackLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/your-username/chrome-extension/issues' });
  });
}

// 加载视频列表
async function loadVideos() {
  if (isLoading) return;
  
  isLoading = true;
  showLoading();
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getAllVideos'
    });
    
    if (response && response.success) {
      currentVideos = response.videos || [];
      displayVideos(currentVideos);
    } else {
      console.error('Failed to get videos:', response?.error);
      showNoVideos();
    }
  } catch (error) {
    console.error('Error loading videos:', error);
    showNoVideos();
  } finally {
    isLoading = false;
    hideLoading();
  }
}

// 加载页面信息
async function loadPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getPageInfo'
    });
    
    if (response && response.success) {
      const pageInfo = response.pageInfo;
      elements.pageDomain.textContent = pageInfo.domain || '-';
    }
  } catch (error) {
    console.error('Error loading page info:', error);
  }
}

// 显示视频列表
function displayVideos(videos) {
  const filteredVideos = filterVideos(videos);
  
  elements.videoCount.textContent = filteredVideos.length;
  
  if (filteredVideos.length === 0) {
    showNoVideos();
    return;
  }
  
  showVideoList();
  renderVideoList(filteredVideos);
  updateBatchControls();
}

// 渲染视频列表
function renderVideoList(videos) {
  const template = document.getElementById('video-item-template');
  const videoList = elements.videoList;
  
  // 清空现有列表
  videoList.innerHTML = '';
  
  videos.forEach(video => {
    const videoItem = createVideoItem(video, template);
    videoList.appendChild(videoItem);
  });
}

// 创建视频项
function createVideoItem(video, template) {
  const clone = template.content.cloneNode(true);
  const videoItem = clone.querySelector('.video-item');
  
  // 设置数据
  videoItem.dataset.videoId = video.id;
  
  // 填充内容
  const title = clone.querySelector('.video-title');
  const resolution = clone.querySelector('.video-resolution');
  const quality = clone.querySelector('.video-quality');
  const format = clone.querySelector('.video-format');
  const duration = clone.querySelector('.video-duration');
  const size = clone.querySelector('.video-size');
  const bitrate = clone.querySelector('.video-bitrate');
  const url = clone.querySelector('.video-url');
  const checkbox = clone.querySelector('.video-select');
  const downloadBtn = clone.querySelector('.download-btn');
  const copyBtn = clone.querySelector('.copy-url-btn');
  
  title.textContent = video.title || 'Untitled Video';
  title.title = video.title || 'Untitled Video';
  
  // 分辨率信息
  if (video.width && video.height) {
    resolution.textContent = `${video.width}x${video.height}`;
    resolution.style.display = '';
  } else if (video.resolution && video.resolution !== '未知') {
    resolution.textContent = video.resolution;
    resolution.style.display = '';
  } else {
    resolution.style.display = 'none';
  }
  
  // 质量信息
  if (video.quality && video.quality !== '未知') {
    quality.textContent = video.quality;
    quality.style.display = '';
  } else {
    quality.style.display = 'none';
  }
  
  // 格式信息（增强显示）
  let formatText = video.format || 'Video';
  
  // 为流媒体格式添加特殊标识
  if (video.type === 'hls') {
    formatText = '🎬 ' + formatText; // HLS流添加电影图标
    format.classList.add('streaming-format');
  } else if (video.type === 'dash') {
    formatText = '📺 ' + formatText; // DASH流添加电视图标
    format.classList.add('streaming-format');
  } else if (video.type === 'network') {
    formatText = '🌐 ' + formatText; // 网络请求添加网络图标
  }
  
  format.textContent = formatText;
  
  // 时长信息
  if (video.duration && video.duration > 0) {
    duration.textContent = formatDuration(video.duration);
    duration.style.display = '';
  } else {
    duration.style.display = 'none';
  }
  
  // 文件大小信息
  const fileSize = video.fileSize || video.actualSize || video.estimatedSize;
  if (fileSize && fileSize > 0) {
    let sizeText = formatFileSize(fileSize);
    
    // 如果是估算大小，添加标识
    if (!video.fileSize && !video.actualSize && video.estimatedSize) {
      sizeText = '~' + sizeText;
    }
    
    size.textContent = sizeText;
    size.style.display = '';
    
    // 添加下载时间估算到title
    const downloadTime = estimateDownloadTime(fileSize);
    size.title = `预计下载时间: ${downloadTime}`;
  } else {
    size.style.display = 'none';
  }
  
  // 比特率信息
  if (video.bitrate && video.bitrate > 0) {
    bitrate.textContent = formatBitrate(video.bitrate);
    bitrate.style.display = '';
  } else {
    bitrate.style.display = 'none';
  }
  
  url.textContent = video.url;
  url.title = video.url;
  
  // 绑定事件
  checkbox.addEventListener('change', (e) => {
    handleVideoSelection(video.id, e.target.checked);
  });
  
  downloadBtn.addEventListener('click', () => {
    downloadVideo(video);
  });
  
  copyBtn.addEventListener('click', () => {
    copyToClipboard(video.url);
  });
  
  // 设置选中状态
  if (selectedVideos.has(video.id)) {
    checkbox.checked = true;
    videoItem.classList.add('selected');
  }
  
  return clone;
}

// 处理视频选择
function handleVideoSelection(videoId, isSelected) {
  if (isSelected) {
    selectedVideos.add(videoId);
  } else {
    selectedVideos.delete(videoId);
  }
  
  // 更新视觉状态
  const videoItem = document.querySelector(`[data-video-id="${videoId}"]`);
  if (videoItem) {
    videoItem.classList.toggle('selected', isSelected);
  }
  
  updateBatchControls();
}

// 更新批量控制
function updateBatchControls() {
  elements.selectedCount.textContent = selectedVideos.size;
  
  if (selectedVideos.size > 0) {
    elements.batchControls.style.display = 'flex';
  } else {
    elements.batchControls.style.display = 'none';
  }
}

// 下载单个视频
async function downloadVideo(video) {
  const videoItem = document.querySelector(`[data-video-id="${video.id}"]`);
  const downloadBtn = videoItem?.querySelector('.download-btn');
  
  if (downloadBtn) {
    downloadBtn.classList.add('downloading');
    downloadBtn.disabled = true;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadVideo',
      videoData: video
    });
    
    if (response && response.success) {
      showDownloadStatus('下载开始: ' + video.title);
      videoItem?.classList.add('success');
      
      // 显示成功状态一段时间后恢复
      setTimeout(() => {
        videoItem?.classList.remove('success');
        downloadBtn?.classList.remove('downloading');
        if (downloadBtn) downloadBtn.disabled = false;
      }, 3000);
    } else {
      throw new Error(response?.error || '下载失败');
    }
  } catch (error) {
    console.error('Download error:', error);
    showDownloadStatus('下载失败: ' + error.message, true);
    videoItem?.classList.add('error');
    
    setTimeout(() => {
      videoItem?.classList.remove('error');
      downloadBtn?.classList.remove('downloading');
      if (downloadBtn) downloadBtn.disabled = false;
    }, 3000);
  }
}

// 批量下载
async function batchDownload() {
  if (selectedVideos.size === 0) return;
  
  const selectedVideoList = currentVideos.filter(v => selectedVideos.has(v.id));
  elements.batchDownloadBtn.disabled = true;
  
  showDownloadStatus(`开始批量下载 ${selectedVideoList.length} 个视频...`);
  
  try {
    for (let i = 0; i < selectedVideoList.length; i++) {
      const video = selectedVideoList[i];
      showDownloadStatus(`下载进度: ${i + 1}/${selectedVideoList.length} - ${video.title}`);
      
      await downloadVideo(video);
      
      // 添加延迟避免过快下载
      if (i < selectedVideoList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    showDownloadStatus('批量下载完成!');
    clearSelection();
  } catch (error) {
    showDownloadStatus('批量下载失败: ' + error.message, true);
  } finally {
    elements.batchDownloadBtn.disabled = false;
    setTimeout(() => {
      hideDownloadStatus();
    }, 3000);
  }
}

// 选择全部
function selectAllVideos() {
  const checkboxes = document.querySelectorAll('.video-select');
  checkboxes.forEach(checkbox => {
    if (!checkbox.checked) {
      checkbox.checked = true;
      const videoId = checkbox.closest('.video-item').dataset.videoId;
      handleVideoSelection(videoId, true);
    }
  });
}

// 清除选择
function clearSelection() {
  selectedVideos.clear();
  const checkboxes = document.querySelectorAll('.video-select');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  const videoItems = document.querySelectorAll('.video-item');
  videoItems.forEach(item => {
    item.classList.remove('selected');
  });
  updateBatchControls();
}

// 搜索功能
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  
  if (query) {
    elements.searchClear.style.display = 'block';
  } else {
    elements.searchClear.style.display = 'none';
  }
  
  displayVideos(currentVideos);
}

function clearSearch() {
  elements.searchInput.value = '';
  elements.searchClear.style.display = 'none';
  displayVideos(currentVideos);
}

function filterVideos(videos) {
  const query = elements.searchInput.value.toLowerCase().trim();
  
  if (!query) return videos;
  
  return videos.filter(video => {
    return video.title.toLowerCase().includes(query) ||
           video.url.toLowerCase().includes(query) ||
           video.format.toLowerCase().includes(query);
  });
}

// 刷新
async function handleRefresh() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    await chrome.tabs.sendMessage(tab.id, {
      action: 'refreshDetection'
    });
    
    // 等待一下再加载视频
    setTimeout(() => {
      loadVideos();
    }, 1500);
  } catch (error) {
    console.error('Refresh error:', error);
    // 直接重新加载
    loadVideos();
  }
}

// 设置
function handleSettings() {
  chrome.runtime.openOptionsPage();
}

// 复制到剪贴板
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showDownloadStatus('链接已复制到剪贴板');
    setTimeout(() => {
      hideDownloadStatus();
    }, 2000);
  } catch (error) {
    console.error('Copy failed:', error);
  }
}

// 显示状态
function showLoading() {
  elements.loading.style.display = 'flex';
  elements.noVideos.style.display = 'none';
  elements.videoList.style.display = 'none';
}

function hideLoading() {
  elements.loading.style.display = 'none';
}

function showNoVideos() {
  elements.noVideos.style.display = 'block';
  elements.videoList.style.display = 'none';
}

function showVideoList() {
  elements.noVideos.style.display = 'none';
  elements.videoList.style.display = 'block';
}

function showDownloadStatus(message, isError = false) {
  elements.downloadStatus.style.display = 'block';
  elements.downloadStatus.querySelector('.status-text').textContent = message;
  elements.downloadStatus.style.background = isError ? '#fce8e6' : '#e6f4ea';
}

function hideDownloadStatus() {
  elements.downloadStatus.style.display = 'none';
}

// 工具函数
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '未知大小';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  // 根据大小调整精度
  let precision = 1;
  if (size >= 100) precision = 0;
  else if (size >= 10) precision = 1;
  else precision = 2;
  
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

function formatBitrate(bitrate) {
  if (!bitrate || bitrate <= 0) return '';
  
  if (bitrate >= 1000) {
    return `${(bitrate / 1000).toFixed(1)} Mbps`;
  } else {
    return `${bitrate} Kbps`;
  }
}

function estimateDownloadTime(fileSize, connectionSpeed = 10) {
  if (!fileSize || fileSize <= 0) return '未知';
  
  // connectionSpeed in Mbps, fileSize in bytes
  const speedBytesPerSecond = (connectionSpeed * 1000000) / 8;
  const timeSeconds = fileSize / speedBytesPerSecond;
  
  if (timeSeconds < 60) {
    return `约 ${Math.ceil(timeSeconds)} 秒`;
  } else if (timeSeconds < 3600) {
    const minutes = Math.ceil(timeSeconds / 60);
    return `约 ${minutes} 分钟`;
  } else {
    const hours = Math.floor(timeSeconds / 3600);
    const minutes = Math.ceil((timeSeconds % 3600) / 60);
    return `约 ${hours} 小时 ${minutes} 分钟`;
  }
}

console.log('FetchVideo popup initialized');
