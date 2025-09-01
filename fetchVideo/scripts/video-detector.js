// 视频检测核心模块 - 专注于M3U8流媒体检测

class VideoDetector {
  constructor() {
    this.detectedVideos = new Map();
    this.observers = [];
    this.networkRequests = new Set();
    this.isInitialized = false;
  }

  // 初始化检测器 - 仅检测m3u8流媒体
  init() {
    if (this.isInitialized) return;
    
    // 只检测流媒体播放器（专注于m3u8）
    this.detectStreamingPlayers(); // 检测流媒体播放器
    this.setupNetworkInterception(); // 网络请求拦截
    this.setupDOMObserver(); // DOM变化监听
    
    this.isInitialized = true;
    console.log('VideoDetector initialized - M3U8 only mode');
  }

  // 设置DOM观察器 - 仅关注动态加载的流媒体
  setupDOMObserver() {
    const observer = new MutationObserver(debounce((mutations) => {
      let shouldRescan = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // 检查新添加的script标签中可能包含m3u8
              if (node.tagName === 'SCRIPT') {
                this.searchScriptsForM3u8([node]);
                shouldRescan = true;
              }
              
              // 检查新元素的属性中是否有m3u8
              this.searchAttributesForM3u8([node]);
            }
          });
        }
      });
      
      if (shouldRescan) {
        console.log('DOM changed, rescanning for m3u8...');
        this.detectStreamingPlayers();
      }
    }, 1000));

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observers.push(observer);
  }

  // 设置网络拦截（通过覆盖原生方法）- 专注于m3u8检测
  setupNetworkInterception() {
    // 拦截 XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (isM3u8Url(url)) {
        console.log('XHR M3U8 request detected:', url);
        window.videoDetector && window.videoDetector.addNetworkVideo(url);
      }
      return originalOpen.apply(this, [method, url, ...args]);
    };

    // 拦截 fetch
    const originalFetch = window.fetch;
    window.fetch = function(input, ...args) {
      const url = typeof input === 'string' ? input : input.url;
      if (isM3u8Url(url)) {
        console.log('Fetch M3U8 request detected:', url);
        window.videoDetector && window.videoDetector.addNetworkVideo(url);
      }
      return originalFetch.apply(this, [input, ...args]);
    };
  }

  // 添加网络检测到的m3u8视频
  addNetworkVideo(url) {
    if (this.networkRequests.has(url)) return;
    
    this.networkRequests.add(url);
    const videoData = {
      id: generateId(),
      element: null,
      type: 'hls',
      url: url,
      title: getFilenameFromUrl(url) || 'HLS Stream',
      quality: this.guessQualityFromUrl(url),
      resolution: '未知',
      format: 'HLS',
      priority: 100,
      timestamp: Date.now(),
      domain: window.location.hostname,
      source: 'network_m3u8'
    };
    
    this.addVideo(videoData);
  }

  // 检测流媒体播放器
  detectStreamingPlayers() {
    console.log('Starting M3U8 streaming detection...');
    
    // 1. 优先检测 HLS 播放器 (m3u8)
    this.detectHLSPlayer();
    
    // 2. 检测 DASH 播放器 (mpd) - 可选
    this.detectDASHPlayer();
    
    // 3. 检测JavaScript变量中的流媒体URL
    this.detectJavaScriptStreams();
    
    // 4. 检测页面中的流媒体配置
    this.detectPageStreamConfig();
    
    // 5. 检测网络历史记录
    this.detectNetworkRequests();
  }

  // 增强的HLS检测 - 多种方式查找m3u8
  detectHLSPlayer() {
    console.log('Detecting HLS streams (m3u8)...');
    
    // 方法1: 检查所有script标签内容
    this.searchScriptsForM3u8();
    
    // 方法2: 检查页面HTML中的m3u8链接
    this.searchHTMLForM3u8();
    
    // 方法3: 检查元素属性中的m3u8
    this.searchAttributesForM3u8();
    
    // 方法4: 检查已知播放器的配置
    this.searchPlayerConfigsForM3u8();
  }

  // 在script标签中搜索m3u8
  searchScriptsForM3u8(scripts = null) {
    const scriptElements = scripts || document.querySelectorAll('script');
    const m3u8Pattern = /(['"])(https?:\/\/[^'"]*\.m3u8[^'"]*)\1/gi;
    
    scriptElements.forEach((script, index) => {
      if (script.textContent) {
        let match;
        while ((match = m3u8Pattern.exec(script.textContent)) !== null) {
          const url = match[2];
          console.log(`Found m3u8 in script ${index}:`, url);
          
          const videoData = {
            id: generateId(),
            element: script,
            type: 'hls',
            url: url,
            title: this.extractTitleFromContext(script) || 'HLS Stream',
            quality: this.guessQualityFromUrl(url),
            resolution: '未知',
            format: 'HLS',
            priority: 100, // 最高优先级
            timestamp: Date.now(),
            domain: window.location.hostname,
            source: 'script_content'
          };
          
          this.addVideo(videoData);
        }
      }
    });
  }

  // 在HTML中搜索m3u8链接
  searchHTMLForM3u8() {
    const htmlContent = document.documentElement.outerHTML;
    const m3u8Pattern = /https?:\/\/[^\s"'<>]*\.m3u8[^\s"'<>]*/gi;
    
    let match;
    while ((match = m3u8Pattern.exec(htmlContent)) !== null) {
      const url = match[0];
      console.log('Found m3u8 in HTML:', url);
      
      const videoData = {
        id: generateId(),
        element: null,
        type: 'hls',
        url: url,
        title: document.title || 'HLS Stream',
        quality: this.guessQualityFromUrl(url),
        resolution: '未知',
        format: 'HLS',
        priority: 95,
        timestamp: Date.now(),
        domain: window.location.hostname,
        source: 'html_content'
      };
      
      this.addVideo(videoData);
    }
  }

  // 在元素属性中搜索m3u8
  searchAttributesForM3u8(elements = null) {
    const targetElements = elements || document.querySelectorAll('*');
    const m3u8Attributes = [
      'data-src', 'data-url', 'data-stream', 'data-hls', 'data-source',
      'src', 'href', 'data-video-src', 'data-stream-url'
    ];
    
    targetElements.forEach(element => {
      m3u8Attributes.forEach(attr => {
        const value = element.getAttribute(attr);
        if (value && value.includes('.m3u8')) {
          console.log(`Found m3u8 in ${attr} attribute:`, value);
          
          const videoData = {
            id: generateId(),
            element: element,
            type: 'hls',
            url: value,
            title: this.extractTitleFromElement(element) || 'HLS Stream',
            quality: this.guessQualityFromUrl(value),
            resolution: '未知',
            format: 'HLS',
            priority: 90,
            timestamp: Date.now(),
            domain: window.location.hostname,
            source: 'element_attribute'
          };
          
          this.addVideo(videoData);
        }
      });
    });
  }

  // 搜索已知播放器配置中的m3u8
  searchPlayerConfigsForM3u8() {
    // 检查常见的播放器配置对象
    const playerVars = ['jwplayer', 'videojs', 'hls', 'player', 'config'];
    
    playerVars.forEach(varName => {
      try {
        if (window[varName]) {
          const config = window[varName];
          this.extractM3u8FromObject(config, `window.${varName}`);
        }
      } catch (e) {
        // 忽略访问错误
      }
    });
    
    // 检查页面中的JSON配置
    const jsonElements = document.querySelectorAll('script[type="application/json"]');
    jsonElements.forEach(element => {
      try {
        const config = JSON.parse(element.textContent);
        this.extractM3u8FromObject(config, 'json_config');
      } catch (e) {
        // 忽略解析错误
      }
    });
  }

  // 从对象中递归提取m3u8链接
  extractM3u8FromObject(obj, source) {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      const value = obj[key];
      
      if (typeof value === 'string' && value.includes('.m3u8')) {
        console.log(`Found m3u8 in ${source}.${key}:`, value);
        
        const videoData = {
          id: generateId(),
          element: null,
          type: 'hls',
          url: value,
          title: obj.title || obj.name || 'HLS Stream',
          quality: this.guessQualityFromUrl(value),
          resolution: '未知',
          format: 'HLS',
          priority: 85,
          timestamp: Date.now(),
          domain: window.location.hostname,
          source: source
        };
        
        this.addVideo(videoData);
      } else if (typeof value === 'object') {
        this.extractM3u8FromObject(value, `${source}.${key}`);
      }
    }
  }

  // 检测JavaScript变量中的流媒体
  detectJavaScriptStreams() {
    // 检查window对象中可能包含流媒体链接的属性
    const streamVars = ['streamUrl', 'videoUrl', 'hlsUrl', 'm3u8Url', 'source', 'src'];
    
    streamVars.forEach(varName => {
      try {
        if (window[varName] && typeof window[varName] === 'string' && window[varName].includes('.m3u8')) {
          console.log(`Found m3u8 in window.${varName}:`, window[varName]);
          
          const videoData = {
            id: generateId(),
            element: null,
            type: 'hls',
            url: window[varName],
            title: `JS Variable: ${varName}`,
            quality: this.guessQualityFromUrl(window[varName]),
            resolution: '未知',
            format: 'HLS',
            priority: 88,
            timestamp: Date.now(),
            domain: window.location.hostname,
            source: `window.${varName}`
          };
          
          this.addVideo(videoData);
        }
      } catch (e) {
        // 忽略访问错误
      }
    });
  }

  // 检测网络请求中的流媒体
  detectNetworkRequests() {
    // 检查已缓存的网络请求
    if (window.performance && window.performance.getEntriesByType) {
      const networkEntries = window.performance.getEntriesByType('resource');
      
      networkEntries.forEach(entry => {
        if (entry.name.includes('.m3u8')) {
          console.log('Found m3u8 URL in network entries:', entry.name);
          
          const videoData = {
            id: generateId(),
            element: null,
            type: 'hls',
            url: entry.name,
            title: 'Network Stream',
            quality: this.guessQualityFromUrl(entry.name),
            resolution: '未知',
            format: 'HLS',
            priority: 80,
            timestamp: Date.now(),
            domain: window.location.hostname,
            source: 'network_entry'
          };
          
          this.addVideo(videoData);
        }
      });
    }
  }

  // 检测页面流媒体配置
  detectPageStreamConfig() {
    // 检查meta标签中的流媒体信息
    const metaTags = document.querySelectorAll('meta[property*="video"], meta[name*="video"]');
    metaTags.forEach(meta => {
      const content = meta.getAttribute('content');
      if (content && content.includes('.m3u8')) {
        console.log('Found m3u8 in meta tag:', content);
        
        const videoData = {
          id: generateId(),
          element: meta,
          type: 'hls',
          url: content,
          title: document.title || 'Meta Stream',
          quality: this.guessQualityFromUrl(content),
          resolution: '未知',
          format: 'HLS',
          priority: 75,
          timestamp: Date.now(),
          domain: window.location.hostname,
          source: 'meta_tag'
        };
        
        this.addVideo(videoData);
      }
    });
  }

  // 检测 DASH 播放器
  detectDASHPlayer() {
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      if (script.textContent && script.textContent.includes('.mpd')) {
        const matches = script.textContent.match(/['"]([^'"]*\.mpd[^'"]*)['"]/g);
        if (matches) {
          matches.forEach(match => {
            const url = match.slice(1, -1);
            const videoData = {
              id: generateId(),
              element: null,
              type: 'dash',
              url: url,
              title: 'DASH Stream',
              quality: '未知',
              format: 'DASH',
              priority: 85,
              timestamp: Date.now(),
              domain: window.location.hostname,
              source: 'script_dash'
            };
            this.addVideo(videoData);
          });
        }
      }
    });
  }

  // 从URL猜测质量
  guessQualityFromUrl(url) {
    if (!url || typeof url !== 'string') return '未知';
    
    const urlLower = url.toLowerCase();
    
    // 常见的质量标识符
    if (urlLower.includes('4k') || urlLower.includes('2160p')) return '4K';
    if (urlLower.includes('2k') || urlLower.includes('1440p')) return '2K';
    if (urlLower.includes('1080p') || urlLower.includes('fhd')) return '1080p';
    if (urlLower.includes('720p') || urlLower.includes('hd')) return '720p';
    if (urlLower.includes('480p') || urlLower.includes('sd')) return '480p';
    if (urlLower.includes('360p')) return '360p';
    if (urlLower.includes('240p')) return '240p';
    
    return '未知';
  }

  // 从上下文提取标题
  extractTitleFromContext(element) {
    // 向上查找父元素中的标题
    let current = element.parentElement;
    let depth = 0;
    
    while (current && depth < 5) {
      // 查找标题元素
      const titleElement = current.querySelector('h1, h2, h3, h4, h5, h6, .title, .video-title, [class*="title"]');
      if (titleElement && titleElement.textContent.trim()) {
        return titleElement.textContent.trim();
      }
      
      // 查找data-title属性
      if (current.dataset && current.dataset.title) {
        return current.dataset.title;
      }
      
      current = current.parentElement;
      depth++;
    }
    
    // 尝试从页面标题提取
    const pageTitle = document.title;
    if (pageTitle && pageTitle !== 'Untitled') {
      return pageTitle;
    }
    
    return null;
  }

  // 从元素提取标题
  extractTitleFromElement(element) {
    // 检查常见的标题属性
    const titleAttrs = ['title', 'data-title', 'aria-label', 'alt'];
    
    for (const attr of titleAttrs) {
      const value = element.getAttribute(attr);
      if (value && value.trim()) {
        return value.trim();
      }
    }
    
    // 检查元素内容
    if (element.textContent && element.textContent.trim()) {
      const text = element.textContent.trim();
      if (text.length > 0 && text.length < 200) {
        return text;
      }
    }
    
    return this.extractTitleFromContext(element);
  }

  // 实时获取文件大小（通过HEAD请求）
  async getActualFileSize(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength) : 0;
    } catch (error) {
      console.warn('Failed to get file size:', error);
      return 0;
    }
  }

  // 添加视频到检测列表
  addVideo(videoData) {
    if (!videoData || !videoData.url) return;
    
    // 避免重复添加相同URL
    const existing = Array.from(this.detectedVideos.values()).find(v => v.url === videoData.url);
    if (existing) {
      // 如果新数据优先级更高或有更好的信息，则更新
      const shouldUpdate = (videoData.priority || 0) > (existing.priority || 0) ||
                          (videoData.width && videoData.height && (!existing.width || !existing.height));
      
      if (shouldUpdate) {
        console.log('Updating video data with higher priority:', videoData.url);
        Object.assign(existing, videoData);
      }
      return;
    }
    
    // 设置默认优先级
    if (!videoData.priority) {
      if (videoData.type === 'hls') videoData.priority = 100;
      else if (videoData.type === 'dash') videoData.priority = 90;
      else if (videoData.type === 'network') videoData.priority = 70;
      else videoData.priority = 50; // 普通video元素
    }
    
    this.detectedVideos.set(videoData.id, videoData);
    console.log(`M3U8 Video detected (priority: ${videoData.priority}):`, videoData);
    
    // 异步获取实际文件大小（仅对非blob/data URL）
    if (videoData.url && !videoData.url.startsWith('blob:') && !videoData.url.startsWith('data:')) {
      this.getActualFileSize(videoData.url).then(size => {
        if (size > 0) {
          videoData.fileSize = size;
          videoData.actualSize = size;
          console.log('File size detected:', size, 'for', videoData.url);
        }
      });
    }
    
    // 发送消息到background script
    if (chrome.runtime) {
      chrome.runtime.sendMessage({
        action: 'videoDetected',
        video: videoData
      }).catch(e => console.warn('Failed to send video detection message:', e));
    }
  }

  // 获取所有检测到的视频（按优先级排序）
  getAllVideos() {
    const videos = Array.from(this.detectedVideos.values());
    
    // 按优先级和质量排序
    return videos.sort((a, b) => {
      // 首先按优先级排序
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      
      // 然后按质量排序
      const qualityScore = (video) => {
        if (video.width && video.height) {
          return video.width * video.height;
        }
        const qualityScores = {
          '4K': 8000000, '2K': 4000000, '1080p': 2000000,
          '720p': 1000000, '480p': 500000, '360p': 200000, '240p': 100000
        };
        return qualityScores[video.quality] || 0;
      };
      
      return qualityScore(b) - qualityScore(a);
    });
  }

  // 获取当前活动的视频
  getActiveVideo() {
    const videos = this.getAllVideos();
    
    // 返回最近检测到的优先级最高的视频
    return videos.sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return b.timestamp - a.timestamp;
    })[0] || null;
  }

  // 检测现有视频元素
  detectExistingVideos() {
    console.log('Detecting existing video elements...');
    
    // 检测页面中的 video 和 audio 元素
    const mediaElements = document.querySelectorAll('video, audio');
    
    mediaElements.forEach(element => {
      const videoData = this.extractVideoDataFromElement(element);
      if (videoData) {
        this.addVideo(videoData);
      }
    });
    
    // 重新检测流媒体播放器
    this.detectStreamingPlayers();
  }

  // 从媒体元素提取视频数据
  extractVideoDataFromElement(element) {
    const src = element.src || element.currentSrc;
    if (!src || src.startsWith('blob:') || src.startsWith('data:')) {
      return null;
    }
    
    const videoData = {
      id: generateId(),
      element: element,
      type: element.tagName.toLowerCase() === 'video' ? 'video' : 'audio',
      url: src,
      title: this.extractTitleFromElement(element) || document.title || 'Media Element',
      width: element.videoWidth || 0,
      height: element.videoHeight || 0,
      duration: element.duration || 0,
      quality: this.getVideoQuality(element.videoWidth, element.videoHeight),
      resolution: element.videoWidth && element.videoHeight ? 
        `${element.videoWidth}x${element.videoHeight}` : '未知',
      format: this.getFormatFromUrl(src),
      priority: 60,
      timestamp: Date.now(),
      domain: window.location.hostname,
      source: 'existing_element'
    };
    
    return videoData;
  }

  // 获取视频质量
  getVideoQuality(width, height) {
    if (!width || !height) return '未知';
    
    const pixels = width * height;
    
    // 更精确的质量判断
    if (height >= 2160 || pixels >= 3840 * 2160) return '4K';
    if (height >= 1440 || pixels >= 2560 * 1440) return '2K';
    if (height >= 1080 || pixels >= 1920 * 1080) return '1080p';
    if (height >= 720 || pixels >= 1280 * 720) return '720p';
    if (height >= 480 || pixels >= 854 * 480) return '480p';
    if (height >= 360 || pixels >= 640 * 360) return '360p';
    if (height >= 240 || pixels >= 426 * 240) return '240p';
    
    return `${width}x${height}`;
  }

  // 从URL获取格式
  getFormatFromUrl(url) {
    const extension = url.split('.').pop().split('?')[0].toLowerCase();
    const formatMap = {
      'mp4': 'MP4',
      'webm': 'WebM',
      'ogg': 'OGG',
      'avi': 'AVI',
      'mov': 'MOV',
      'mkv': 'MKV',
      'm3u8': 'HLS',
      'mpd': 'DASH'
    };
    
    return formatMap[extension] || 'Video';
  }

  // 清理检测器
  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.detectedVideos.clear();
    this.networkRequests.clear();
    this.isInitialized = false;
  }
}

// 全局实例
window.videoDetector = new VideoDetector();
