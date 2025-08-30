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
        
        // 获取详细的视频信息
        const videoInfo = getDetailedVideoInfo(video);
        reportVideo(videoInfo);
      }
      
      // 检测source元素
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        if (source.src && !detectedUrls.has(source.src)) {
          detectedUrls.add(source.src);
          
          // 使用父级video元素获取信息
          const videoInfo = getDetailedVideoInfo(video, source.src, source.type);
          reportVideo(videoInfo);
        }
      });
    });
  }
  
  // 获取详细的视频信息
  function getDetailedVideoInfo(videoElement, customUrl = null, customType = null) {
    const url = customUrl || videoElement.src;
    const type = customType || videoElement.getAttribute('type') || getVideoTypeFromUrl(url);
    
    // 获取视频尺寸信息
    let resolution = 'unknown';
    if (videoElement.videoWidth && videoElement.videoHeight) {
      resolution = `${videoElement.videoWidth}x${videoElement.videoHeight}`;
    } else if (videoElement.getAttribute('width') && videoElement.getAttribute('height')) {
      resolution = `${videoElement.getAttribute('width')}x${videoElement.getAttribute('height')}`;
    }
    
    // 获取视频质量信息
    let quality = '';
    if (videoElement.videoWidth) {
      const width = videoElement.videoWidth;
      if (width >= 3840) quality = '4K';
      else if (width >= 2560) quality = '2K';
      else if (width >= 1920) quality = '1080p';
      else if (width >= 1280) quality = '720p';
      else if (width >= 854) quality = '480p';
      else if (width >= 640) quality = '360p';
      else quality = '低分辨率';
    }
    
    // 获取文件大小（如果可用）
    let fileSize = 'unknown';
    if (videoElement.buffered && videoElement.buffered.length > 0 && videoElement.duration) {
      // 估算文件大小（粗略计算）
      const bufferedEnd = videoElement.buffered.end(videoElement.buffered.length - 1);
      const totalDuration = videoElement.duration;
      if (bufferedEnd > 0 && totalDuration > 0) {
        // 这里只是一个粗略的估算
        const estimatedSize = Math.round((bufferedEnd / totalDuration) * 50); // 假设每秒50KB
        if (estimatedSize > 1024) {
          fileSize = (estimatedSize / 1024).toFixed(1) + ' MB';
        } else {
          fileSize = estimatedSize + ' KB';
        }
      }
    }
    
    return {
      url: url,
      type: type,
      title: getVideoTitle(videoElement),
      duration: videoElement.duration || 0,
      size: resolution,
      quality: quality,
      fileSize: fileSize,
      width: videoElement.videoWidth || 0,
      height: videoElement.videoHeight || 0
    };
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
    } else if (lowerUrl.includes('.avi')) {
      return 'AVI';
    } else if (lowerUrl.includes('.mov')) {
      return 'MOV';
    } else if (lowerUrl.includes('.wmv')) {
      return 'WMV';
    } else if (lowerUrl.includes('.mkv')) {
      return 'MKV';
    } else {
      return '视频流';
    }
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
            
            // 获取响应头中的内容长度
            const contentLength = this.getResponseHeader('content-length');
            let fileSize = 'unknown';
            if (contentLength) {
              const sizeBytes = parseInt(contentLength);
              if (sizeBytes > 1024 * 1024) {
                fileSize = (sizeBytes / 1024 / 1024).toFixed(1) + ' MB';
              } else if (sizeBytes > 1024) {
                fileSize = (sizeBytes / 1024).toFixed(1) + ' KB';
              } else {
                fileSize = sizeBytes + ' B';
              }
            }
            
            reportVideo({
              url: url,
              type: getVideoTypeFromUrl(url),
              title: document.title || '网络视频',
              duration: 0,
              size: 'unknown',
              quality: '',
              fileSize: fileSize,
              width: 0,
              height: 0
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
            
            // 获取响应头中的内容长度
            const contentLength = response.headers.get('content-length');
            let fileSize = 'unknown';
            if (contentLength) {
              const sizeBytes = parseInt(contentLength);
              if (sizeBytes > 1024 * 1024) {
                fileSize = (sizeBytes / 1024 / 1024).toFixed(1) + ' MB';
              } else if (sizeBytes > 1024) {
                fileSize = (sizeBytes / 1024).toFixed(1) + ' KB';
              } else {
                fileSize = sizeBytes + ' B';
              }
            }
            
            reportVideo({
              url: url,
              type: getVideoTypeFromUrl(url),
              title: document.title || '网络视频',
              duration: 0,
              size: 'unknown',
              quality: '',
              fileSize: fileSize,
              width: 0,
              height: 0
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
