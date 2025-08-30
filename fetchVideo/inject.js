// 注入到页面的脚本 - 在页面上下文中运行，可以访问页面的JavaScript变量
(function() {
  'use strict';
  
  console.log('视频检测注入脚本已加载');
  
  // 监听网络请求的更深层拦截
  function interceptNetworkRequests() {
    // 拦截所有可能的视频请求
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
      if (isVideoUrl(url)) {
        this.addEventListener('readystatechange', function() {
          if (this.readyState === 4 && this.status === 200) {
            dispatchVideoFound({
              url: url,
              type: getVideoTypeFromUrl(url),
              title: document.title || '检测到的视频',
              duration: 0,
              size: 'unknown',
              source: 'XHR请求'
            });
          }
        });
      }
      return originalOpen.call(this, method, url, async, user, password);
    };
    
    // 监听WebSocket连接（某些流媒体使用）
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      if (isVideoUrl(url)) {
        dispatchVideoFound({
          url: url,
          type: 'WebSocket 流',
          title: document.title || 'WebSocket视频流',
          duration: 0,
          size: 'unknown',
          source: 'WebSocket'
        });
      }
      return new originalWebSocket(url, protocols);
    };
  }
  
  // 监听媒体源API (Media Source Extensions)
  function interceptMediaSource() {
    if (window.MediaSource) {
      const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
      MediaSource.prototype.addSourceBuffer = function(mimeType) {
        console.log('检测到Media Source:', mimeType);
        // 这里可以进一步分析媒体源
        return originalAddSourceBuffer.call(this, mimeType);
      };
    }
  }
  
  // 监听HLS.js库（如果页面使用）
  function interceptHLS() {
    // 监听Hls对象创建
    const originalHls = window.Hls;
    if (originalHls) {
      window.Hls = function(...args) {
        const hls = new originalHls(...args);
        
        // 监听manifest加载
        hls.on(originalHls.Events.MANIFEST_PARSED, function(event, data) {
          const url = hls.url;
          if (url) {
            // 获取流的分辨率信息
            let resolution = 'unknown';
            let quality = '';
            if (data.levels && data.levels.length > 0) {
              const level = data.levels[data.levels.length - 1]; // 获取最高质量
              if (level.width && level.height) {
                resolution = `${level.width}x${level.height}`;
                const width = level.width;
                if (width >= 3840) quality = '4K';
                else if (width >= 2560) quality = '2K'; 
                else if (width >= 1920) quality = '1080p';
                else if (width >= 1280) quality = '720p';
                else if (width >= 854) quality = '480p';
                else if (width >= 640) quality = '360p';
                else quality = '低分辨率';
              }
            }
            
            dispatchVideoFound({
              url: url,
              type: 'HLS (m3u8)',
              title: document.title || 'HLS视频流',
              duration: data.totalduration || 0,
              size: resolution,
              quality: quality,
              fileSize: 'unknown',
              width: data.levels && data.levels.length > 0 ? data.levels[data.levels.length - 1].width || 0 : 0,
              height: data.levels && data.levels.length > 0 ? data.levels[data.levels.length - 1].height || 0 : 0,
              source: 'HLS.js'
            });
          }
        });
        
        return hls;
      };
      
      // 复制静态属性
      Object.setPrototypeOf(window.Hls, originalHls);
      Object.getOwnPropertyNames(originalHls).forEach(name => {
        window.Hls[name] = originalHls[name];
      });
    }
  }
  
  // 监听Video.js播放器（如果页面使用）
  function interceptVideoJS() {
    if (window.videojs) {
      const originalVideoJS = window.videojs;
      window.videojs = function(id, options, ready) {
        const player = originalVideoJS(id, options, ready);
        
        // 监听源变化
        player.ready(() => {
          const src = player.currentSrc();
          if (src && isVideoUrl(src)) {
            // 获取播放器的视频尺寸
            let resolution = 'unknown';
            let quality = '';
            const videoWidth = player.videoWidth();
            const videoHeight = player.videoHeight();
            
            if (videoWidth && videoHeight) {
              resolution = `${videoWidth}x${videoHeight}`;
              if (videoWidth >= 3840) quality = '4K';
              else if (videoWidth >= 2560) quality = '2K';
              else if (videoWidth >= 1920) quality = '1080p';
              else if (videoWidth >= 1280) quality = '720p';
              else if (videoWidth >= 854) quality = '480p';
              else if (videoWidth >= 640) quality = '360p';
              else quality = '低分辨率';
            }
            
            dispatchVideoFound({
              url: src,
              type: getVideoTypeFromUrl(src),
              title: document.title || 'Video.js视频',
              duration: player.duration() || 0,
              size: resolution,
              quality: quality,
              fileSize: 'unknown',
              width: videoWidth || 0,
              height: videoHeight || 0,
              source: 'Video.js'
            });
          }
        });
        
        return player;
      };
      
      // 复制静态属性
      Object.setPrototypeOf(window.videojs, originalVideoJS);
      Object.getOwnPropertyNames(originalVideoJS).forEach(name => {
        window.videojs[name] = originalVideoJS[name];
      });
    }
  }
  
  // 检查URL是否为视频
  function isVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const videoExtensions = [
      '.mp4', '.webm', '.flv', '.avi', '.mov', '.wmv', '.mkv', '.m4v',
      '.m3u8', '.ts', '.f4v', '.3gp', '.ogv', '.mpd'
    ];
    
    const videoKeywords = [
      'video', 'stream', 'media', 'play', 'movie', 'film',
      'm3u8', 'hls', 'dash', 'rtmp', 'rtsp', 'blob:'
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
    
    // 检查MIME类型
    if (lowerUrl.includes('video/') || lowerUrl.includes('application/vnd.apple.mpegurl')) {
      return true;
    }
    
    return false;
  }
  
  // 从URL获取视频类型
  function getVideoTypeFromUrl(url) {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('hls') || lowerUrl.includes('application/vnd.apple.mpegurl')) {
      return 'HLS (m3u8)';
    } else if (lowerUrl.includes('.mpd') || lowerUrl.includes('dash')) {
      return 'DASH';
    } else if (lowerUrl.includes('.mp4')) {
      return 'MP4';
    } else if (lowerUrl.includes('.webm')) {
      return 'WebM';
    } else if (lowerUrl.includes('.flv')) {
      return 'FLV';
    } else if (lowerUrl.includes('.ts')) {
      return 'TS Fragment';
    } else if (lowerUrl.includes('blob:')) {
      return 'Blob 视频';
    } else {
      return '视频流';
    }
  }
  
  // 向content script发送消息
  function dispatchVideoFound(videoData) {
    window.dispatchEvent(new CustomEvent('VIDEO_FOUND', {
      detail: videoData
    }));
  }
  
  // 扫描页面中的所有变量寻找视频链接
  function scanPageVariables() {
    try {
      // 扫描window对象的属性
      for (let prop in window) {
        try {
          const value = window[prop];
          if (typeof value === 'string' && isVideoUrl(value)) {
            dispatchVideoFound({
              url: value,
              type: getVideoTypeFromUrl(value),
              title: document.title || '页面变量中的视频',
              duration: 0,
              size: 'unknown',
              quality: '',
              fileSize: 'unknown',
              width: 0,
              height: 0,
              source: '页面变量'
            });
          }
        } catch (e) {
          // 忽略访问限制的属性
        }
      }
    } catch (e) {
      console.log('扫描页面变量失败:', e);
    }
  }
  
  // 初始化所有拦截
  function init() {
    interceptNetworkRequests();
    interceptMediaSource();
    interceptHLS();
    interceptVideoJS();
    
    // 延迟扫描页面变量，等待页面加载完成
    setTimeout(scanPageVariables, 2000);
  }
  
  // 立即执行
  init();
  
})();
