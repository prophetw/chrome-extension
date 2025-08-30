// 内容脚本 - 检测页面中的视频
(function() {
  'use strict';
  
  console.log('视频下载助手已加载');
  
  // 存储已检测到的视频，避免重复
  const detectedUrls = new Set();
  
  // 检测视频元素
  function detectVideoElements() {
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
      if (video.src && !detectedUrls.has(video.src)) {
        detectedUrls.add(video.src);
        reportVideo({
          url: video.src,
          type: 'video element',
          title: getVideoTitle(video),
          duration: video.duration || 0,
          size: video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : 'unknown'
        });
      }
      
      // 检测source元素
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        if (source.src && !detectedUrls.has(source.src)) {
          detectedUrls.add(source.src);
          reportVideo({
            url: source.src,
            type: source.type || 'video source',
            title: getVideoTitle(video),
            duration: video.duration || 0,
            size: video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : 'unknown'
          });
        }
      });
    });
  }
  
  // 获取视频标题
  function getVideoTitle(element) {
    // 尝试多种方法获取标题
    let title = element.getAttribute('title') || 
                element.getAttribute('alt') || 
                element.getAttribute('data-title') ||
                document.title ||
                '未知视频';
    
    // 清理标题
    title = title.substring(0, 100); // 限制长度
    return title;
  }
  
  // 向后台脚本报告发现的视频
  function reportVideo(video) {
    chrome.runtime.sendMessage({
      type: 'VIDEO_DETECTED',
      video: video
    }).catch(error => {
      console.log('发送消息失败:', error);
    });
  }
  
  // 注入脚本来监听网络请求
  function injectNetworkListener() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }
  
  // 监听来自注入脚本的消息
  window.addEventListener('VIDEO_FOUND', function(event) {
    const videoData = event.detail;
    if (videoData && videoData.url && !detectedUrls.has(videoData.url)) {
      detectedUrls.add(videoData.url);
      reportVideo(videoData);
    }
  });
  
  // 监听XMLHttpRequest和fetch请求
  function monitorNetworkRequests() {
    // 监听XHR
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (isVideoUrl(url)) {
        this.addEventListener('load', function() {
          if (this.status === 200 && !detectedUrls.has(url)) {
            detectedUrls.add(url);
            reportVideo({
              url: url,
              type: getVideoTypeFromUrl(url),
              title: document.title || '网络视频',
              duration: 0,
              size: 'unknown'
            });
          }
        });
      }
      return originalXHROpen.call(this, method, url, ...args);
    };
    
    // 监听fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, ...args) {
      if (typeof url === 'string' && isVideoUrl(url)) {
        const promise = originalFetch.call(this, url, ...args);
        promise.then(response => {
          if (response.ok && !detectedUrls.has(url)) {
            detectedUrls.add(url);
            reportVideo({
              url: url,
              type: getVideoTypeFromUrl(url),
              title: document.title || '网络视频',
              duration: 0,
              size: 'unknown'
            });
          }
        }).catch(() => {});
        return promise;
      }
      return originalFetch.call(this, url, ...args);
    };
  }
  
  // 判断URL是否为视频
  function isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const videoExtensions = [
      '.mp4', '.webm', '.flv', '.avi', '.mov', '.wmv', '.mkv', '.m4v',
      '.m3u8', '.ts', '.f4v', '.3gp', '.ogv'
    ];
    
    const videoKeywords = [
      'video', 'stream', 'media', 'play', 'movie', 'film',
      'm3u8', 'hls', 'dash', 'rtmp', 'rtsp'
    ];
    
    const lowerUrl = url.toLowerCase();
    
    // 检查文件扩展名
    if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
      return true;
    }
    
    // 检查URL中的关键词
    if (videoKeywords.some(keyword => lowerUrl.includes(keyword))) {
      return true;
    }
    
    return false;
  }
  
  // 从URL获取视频类型
  function getVideoTypeFromUrl(url) {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('hls')) {
      return 'HLS (m3u8)';
    } else if (lowerUrl.includes('.mp4')) {
      return 'MP4';
    } else if (lowerUrl.includes('.webm')) {
      return 'WebM';
    } else if (lowerUrl.includes('.flv')) {
      return 'FLV';
    } else if (lowerUrl.includes('.ts')) {
      return 'TS (Transport Stream)';
    } else {
      return '视频流';
    }
  }
  
  // 初始化
  function init() {
    // 检测现有视频元素
    detectVideoElements();
    
    // 监听新添加的视频元素
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            if (node.tagName === 'VIDEO') {
              setTimeout(() => detectVideoElements(), 100);
            } else if (node.querySelector && node.querySelector('video')) {
              setTimeout(() => detectVideoElements(), 100);
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // 注入网络监听脚本
    injectNetworkListener();
    
    // 监听网络请求
    monitorNetworkRequests();
  }
  
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // 定期检测（某些视频可能延迟加载）
  setInterval(detectVideoElements, 3000);
  
})();
