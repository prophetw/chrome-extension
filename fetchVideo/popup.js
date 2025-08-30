// 弹窗脚本
(function() {
  'use strict';
  
  let currentVideos = [];
  
  // DOM元素
  const videoList = document.getElementById('videoList');
  const noVideos = document.getElementById('noVideos');
  const videoCount = document.getElementById('videoCount');
  const loading = document.getElementById('loading');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearBtn = document.getElementById('clearBtn');
  const toast = document.getElementById('toast');
  
  // 初始化
  document.addEventListener('DOMContentLoaded', function() {
    loadVideos();
    
    // 绑定事件
    refreshBtn.addEventListener('click', refreshVideos);
    clearBtn.addEventListener('click', clearVideos);
  });
  
  // 加载视频列表
  async function loadVideos() {
    try {
      showLoading(true);
      
      // 获取当前标签页
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const currentTab = tabs[0];
      
      if (!currentTab) {
        showToast('无法获取当前标签页', 'error');
        showLoading(false);
        return;
      }
      
      // 发送消息获取视频列表
      const response = await chrome.runtime.sendMessage({
        type: 'GET_VIDEOS',
        tabId: currentTab.id
      });
      
      currentVideos = response.videos || [];
      renderVideoList();
      showLoading(false);
      
    } catch (error) {
      console.error('加载视频失败:', error);
      showToast('加载视频失败', 'error');
      showLoading(false);
    }
  }
  
  // 刷新视频检测
  async function refreshVideos() {
    try {
      showLoading(true);
      showToast('正在重新检测视频...', 'info');
      
      // 获取当前标签页
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const currentTab = tabs[0];
      
      if (!currentTab) {
        showToast('无法获取当前标签页', 'error');
        showLoading(false);
        return;
      }
      
      // 清空当前视频列表
      chrome.runtime.sendMessage({
        type: 'CLEAR_VIDEOS',
        tabId: currentTab.id
      });
      
      // 重新注入content script（使用scripting API）
      try {
        await chrome.scripting.executeScript({
          target: {tabId: currentTab.id},
          files: ['content.js']
        });
      } catch (scriptError) {
        console.log('注入脚本可能失败，但继续检测:', scriptError);
      }
      
      // 等待一段时间让检测完成
      setTimeout(() => {
        loadVideos();
        showToast('检测完成', 'success');
      }, 2000);
      
    } catch (error) {
      console.error('刷新失败:', error);
      showToast('刷新失败: ' + error.message, 'error');
      showLoading(false);
    }
  }
  
  // 清空视频列表
  async function clearVideos() {
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const currentTab = tabs[0];
      
      if (currentTab) {
        await chrome.runtime.sendMessage({
          type: 'CLEAR_VIDEOS',
          tabId: currentTab.id
        });
      }
      
      currentVideos = [];
      renderVideoList();
      showToast('列表已清空', 'success');
      
    } catch (error) {
      console.error('清空失败:', error);
      showToast('清空失败', 'error');
    }
  }
  
  // 渲染视频列表
  function renderVideoList() {
    videoList.innerHTML = '';
    
    if (currentVideos.length === 0) {
      noVideos.style.display = 'block';
      videoCount.style.display = 'none';
      return;
    }
    
    noVideos.style.display = 'none';
    videoCount.style.display = 'block';
    videoCount.textContent = `发现 ${currentVideos.length} 个视频`;
    
    currentVideos.forEach((video, index) => {
      const videoItem = createVideoItem(video, index);
      videoList.appendChild(videoItem);
    });
  }
  
  // 创建视频项元素
  function createVideoItem(video, index) {
    const item = document.createElement('div');
    item.className = 'video-item';
    
    // 获取视频类型的颜色
    const typeColor = getTypeColor(video.type);
    
    item.innerHTML = `
      <div class="video-title" title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</div>
      <div class="video-info">
        <span class="video-type" style="background: ${typeColor.bg}; color: ${typeColor.text};">${escapeHtml(video.type)}</span>
        ${video.quality ? `<span class="video-quality">质量: ${video.quality}</span>` : ''}
        ${video.duration > 0 ? `<span>时长: ${formatDuration(video.duration)}</span>` : ''}
      </div>
      <div class="video-details">
        ${video.size !== 'unknown' ? `<span>分辨率: ${video.size}</span>` : ''}
        ${video.fileSize !== 'unknown' ? `<span>大小: ${video.fileSize}</span>` : ''}
      </div>
      <div class="video-url" title="${escapeHtml(video.url)}">${escapeHtml(truncateUrl(video.url))}</div>
      <div class="video-actions">
        <button class="btn btn-download" onclick="downloadVideo(${index})">📥 下载</button>
        <button class="btn btn-copy" onclick="copyUrl(${index})">📋 复制</button>
        <button class="btn btn-open" onclick="openVideo(${index})">🔗 打开</button>
      </div>
    `;
    
    return item;
  }
  
  // 获取类型颜色
  function getTypeColor(type) {
    const colors = {
      'HLS (m3u8)': { bg: '#e8f5e8', text: '#2e7d32' },
      'MP4': { bg: '#e3f2fd', text: '#1976d2' },
      'WebM': { bg: '#fff3e0', text: '#f57c00' },
      'FLV': { bg: '#fce4ec', text: '#c2185b' },
      'TS Fragment': { bg: '#f3e5f5', text: '#7b1fa2' },
      'DASH': { bg: '#e0f2f1', text: '#00695c' }
    };
    
    for (const [key, color] of Object.entries(colors)) {
      if (type.includes(key) || key.includes(type)) {
        return color;
      }
    }
    
    return { bg: '#f5f5f5', text: '#616161' };
  }
  
  // 下载视频
  window.downloadVideo = async function(index) {
    try {
      const video = currentVideos[index];
      if (!video) {
        showToast('视频不存在', 'error');
        return;
      }
      
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_VIDEO',
        video: video
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('发送消息失败:', chrome.runtime.lastError);
          showToast('下载失败: ' + chrome.runtime.lastError.message, 'error');
        } else if (response && response.success) {
          showToast('开始下载: ' + video.title, 'success');
        } else {
          showToast('下载失败', 'error');
        }
      });
      
    } catch (error) {
      console.error('下载失败:', error);
      showToast('下载失败: ' + error.message, 'error');
    }
  };
  
  // 复制视频链接
  window.copyUrl = async function(index) {
    try {
      const video = currentVideos[index];
      if (!video) {
        showToast('视频不存在', 'error');
        return;
      }
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(video.url);
        showToast('链接已复制', 'success');
      } else {
        // 备用方案：使用传统方法复制
        const textArea = document.createElement('textarea');
        textArea.value = video.url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('链接已复制', 'success');
      }
      
    } catch (error) {
      console.error('复制失败:', error);
      showToast('复制失败', 'error');
    }
  };
  
  // 在新标签页打开视频
  window.openVideo = async function(index) {
    try {
      const video = currentVideos[index];
      if (!video) {
        showToast('视频不存在', 'error');
        return;
      }
      
      chrome.tabs.create({ url: video.url }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('打开失败:', chrome.runtime.lastError);
          showToast('打开失败: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showToast('已在新标签页打开', 'success');
        }
      });
      
    } catch (error) {
      console.error('打开失败:', error);
      showToast('打开失败: ' + error.message, 'error');
    }
  };
  
  // 显示/隐藏加载状态
  function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
  }
  
  // 显示消息提示
  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
      toast.className = 'toast';
    }, 3000);
  }
  
  // 格式化时长
  function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '';
    
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    if (minutes === 0) {
      return `${secs}秒`;
    } else if (minutes < 60) {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }
  
  // 截断URL显示
  function truncateUrl(url, maxLength = 60) {
    if (url.length <= maxLength) return url;
    
    const start = url.substring(0, 30);
    const end = url.substring(url.length - 25);
    return start + '...' + end;
  }
  
  // HTML转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
})();
