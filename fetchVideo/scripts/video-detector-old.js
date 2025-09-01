// 视频检测核心模块

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

  // 分析媒体元素
  analyzeMediaElement(element) {
    const videoData = this.extractVideoData(element);
    if (videoData && videoData.url) {
      // 检查是否是真正的下载源还是只是播放器
      const isRealSource = this.validateVideoSource(videoData.url);
      
      if (isRealSource) {
        videoData.priority = 60; // 中等优先级
        this.addVideo(videoData);
      } else {
        videoData.priority = 30; // 低优先级
        videoData.note = '可能不是直接下载源';
        this.addVideo(videoData);
      }
    }

    // 监听源变化
    element.addEventListener('loadstart', () => {
      const newData = this.extractVideoData(element);
      if (newData && newData.url) {
        const isRealSource = this.validateVideoSource(newData.url);
        newData.priority = isRealSource ? 60 : 30;
        this.addVideo(newData);
      }
    });

    // 监听错误事件
    element.addEventListener('error', (e) => {
      console.warn('Media element error:', e);
    });
  }

  // 验证视频源是否是有效的下载链接
  validateVideoSource(url) {
    const urlLower = url.toLowerCase();
    
    // 不是有效下载源的情况
    const invalidPatterns = [
      /blob:/,           // blob URL
      /data:/,           // data URL
      /javascript:/,     // javascript URL
      /about:/,          // about URL
      /chrome-extension:/, // 扩展URL
    ];
    
    if (invalidPatterns.some(pattern => pattern.test(urlLower))) {
      return false;
    }
    
    // 检查是否是直播流（通常不适合下载）
    const livePatterns = [
      /live/,
      /stream/,
      /rtmp/,
      /ws:/,
      /wss:/
    ];
    
    if (livePatterns.some(pattern => pattern.test(urlLower))) {
      return false;
    }
    
    // 有效的视频格式
    const validFormats = [
      /\.mp4/,
      /\.webm/,
      /\.avi/,
      /\.mov/,
      /\.mkv/,
      /\.flv/,
      /\.wmv/,
      /\.m3u8/,
      /\.mpd/
    ];
    
    return validFormats.some(pattern => pattern.test(urlLower));
  }

  // 提取视频数据
  extractVideoData(element) {
    const data = {
      id: generateId(),
      element: element,
      type: element.tagName.toLowerCase(),
      url: this.getVideoUrl(element),
      title: this.getVideoTitle(element),
      duration: element.duration || 0,
      currentTime: element.currentTime || 0,
      width: element.videoWidth || element.width || 0,
      height: element.videoHeight || element.height || 0,
      quality: '',
      resolution: '',
      size: 0,
      estimatedSize: 0,
      fileSize: 0,
      format: '',
      bitrate: 0,
      frameRate: 0,
      codec: '',
      isPlaying: !element.paused,
      timestamp: Date.now(),
      domain: window.location.hostname
    };

    // 设置分辨率和质量
    if (data.width && data.height) {
      data.resolution = `${data.width}x${data.height}`;
      data.quality = getVideoQuality(data.width, data.height);
    }

    // 设置格式
    if (data.url) {
      data.format = getFileExtension(data.url).replace('.', '').toUpperCase();
    }

    // 尝试获取更多技术信息
    this.extractTechnicalInfo(element, data);

    // 估算文件大小
    this.estimateFileSize(data);

    return data;
  }

  // 获取视频URL
  getVideoUrl(element) {
    // 直接源
    if (element.src && element.src !== window.location.href) {
      return element.src;
    }

    // source 元素
    const sources = element.querySelectorAll('source');
    for (const source of sources) {
      if (source.src) {
        return source.src;
      }
    }

    // 数据属性
    const dataAttrs = ['data-src', 'data-url', 'data-video-src', 'data-source'];
    for (const attr of dataAttrs) {
      const value = element.getAttribute(attr);
      if (value && isVideoUrl(value)) {
        return value;
      }
    }

    return null;
  }

  // 获取视频标题
  getVideoTitle(element) {
    // 尝试多种方式获取标题
    const titleSources = [
      element.title,
      element.getAttribute('data-title'),
      element.getAttribute('aria-label'),
      element.getAttribute('alt')
    ];

    for (const title of titleSources) {
      if (title && title.trim()) {
        return title.trim();
      }
    }

    // 从父元素获取标题
    let parent = element.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      const titleElement = parent.querySelector('h1, h2, h3, h4, h5, h6, .title, .video-title');
      if (titleElement && titleElement.textContent.trim()) {
        return titleElement.textContent.trim();
      }
      parent = parent.parentElement;
    }

    // 从页面标题获取
    return document.title || 'Untitled Video';
  }

  // 检测嵌入式播放器
  detectEmbeddedPlayers() {
    // YouTube 播放器
    this.detectYouTubePlayer();
    
    // Bilibili 播放器
    this.detectBilibiliPlayer();
    
    // 通用播放器检测
    this.detectGenericPlayers();
  }

  // 检测 YouTube 播放器
  detectYouTubePlayer() {
    const iframes = document.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
    iframes.forEach(iframe => {
      const videoData = {
        id: generateId(),
        element: iframe,
        type: 'youtube',
        url: iframe.src,
        title: this.getYouTubeTitle(),
        quality: '未知',
        format: 'YouTube',
        timestamp: Date.now(),
        domain: 'youtube.com'
      };
      this.addVideo(videoData);
    });
  }

  // 检测 Bilibili 播放器
  detectBilibiliPlayer() {
    const iframes = document.querySelectorAll('iframe[src*="bilibili.com"]');
    iframes.forEach(iframe => {
      const videoData = {
        id: generateId(),
        element: iframe,
        type: 'bilibili',
        url: iframe.src,
        title: document.title || 'Bilibili Video',
        quality: '未知',
        format: 'Bilibili',
        timestamp: Date.now(),
        domain: 'bilibili.com'
      };
      this.addVideo(videoData);
    });
  }

  // 获取 YouTube 标题
  getYouTubeTitle() {
    const titleElement = document.querySelector('h1.title, .watch-main-col h1, #watch-headline-title');
    return titleElement ? titleElement.textContent.trim() : 'YouTube Video';
  }

  // 检测通用播放器
  detectGenericPlayers() {
    const playerSelectors = [
      '[class*="player"]',
      '[class*="video"]',
      '[id*="player"]',
      '[id*="video"]',
      '.jwplayer',
      '.video-js',
      '.plyr'
    ];

    playerSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        this.analyzePlayerElement(element);
      });
    });
  }

  // 分析播放器元素
  analyzePlayerElement(element) {
    // 查找内部的视频元素
    const video = element.querySelector('video, audio');
    if (video) {
      this.analyzeMediaElement(video);
      return;
    }

    // 检查播放器配置
    this.extractPlayerConfig(element);
  }

  // 提取播放器配置
  extractPlayerConfig(element) {
    // 检查常见的数据属性
    const configAttrs = [
      'data-config',
      'data-setup',
      'data-player-config',
      'data-video-config'
    ];

    for (const attr of configAttrs) {
      const config = element.getAttribute(attr);
      if (config) {
        try {
          const configObj = JSON.parse(config);
          const videoUrl = this.extractUrlFromConfig(configObj);
          if (videoUrl) {
            const videoData = {
              id: generateId(),
              element: element,
              type: 'player',
              url: videoUrl,
              title: configObj.title || element.title || 'Video',
              quality: '未知',
              format: getFileExtension(videoUrl).replace('.', '').toUpperCase(),
              timestamp: Date.now(),
              domain: window.location.hostname
            };
            this.addVideo(videoData);
          }
        } catch (e) {
          console.warn('Failed to parse player config:', e);
        }
      }
    }
  }

  // 从配置对象中提取URL
  extractUrlFromConfig(config) {
    const urlFields = ['src', 'source', 'file', 'url', 'sources'];
    
    for (const field of urlFields) {
      if (config[field]) {
        if (typeof config[field] === 'string' && isVideoUrl(config[field])) {
          return config[field];
        }
        if (Array.isArray(config[field]) && config[field].length > 0) {
          const firstSource = config[field][0];
          if (typeof firstSource === 'string' && isVideoUrl(firstSource)) {
            return firstSource;
          }
          if (firstSource.src && isVideoUrl(firstSource.src)) {
            return firstSource.src;
          }
        }
      }
    }
    return null;
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

  // 提取技术信息
  extractTechnicalInfo(element, data) {
    try {
      // 获取视频轨道信息
      if (element.videoTracks && element.videoTracks.length > 0) {
        const track = element.videoTracks[0];
        if (track.label) {
          // 尝试从标签中提取质量信息
          const qualityMatch = track.label.match(/(\d+)p/i);
          if (qualityMatch) {
            data.quality = qualityMatch[1] + 'p';
          }
        }
      }

      // 获取音频轨道信息
      if (element.audioTracks && element.audioTracks.length > 0) {
        const track = element.audioTracks[0];
        data.hasAudio = true;
        data.audioLanguage = track.language || '';
      }

      // 尝试获取帧率
      if (element.getVideoPlaybackQuality) {
        const quality = element.getVideoPlaybackQuality();
        if (quality.totalVideoFrames && data.duration) {
          data.frameRate = Math.round(quality.totalVideoFrames / data.duration);
        }
      }

      // 检查编解码器信息
      this.detectCodec(element, data);

      // 尝试获取缓冲区信息来估算比特率
      this.detectBitrate(element, data);

    } catch (error) {
      console.warn('Failed to extract technical info:', error);
    }
  }

  // 检测编解码器
  detectCodec(element, data) {
    try {
      // 检查src属性中的编解码器信息
      const src = element.currentSrc || element.src;
      if (src) {
        // 从URL或MIME类型中提取编解码器信息
        const codecPatterns = {
          'h264': /h\.?264|avc1/i,
          'h265': /h\.?265|hevc|hev1/i,
          'vp8': /vp8/i,
          'vp9': /vp9/i,
          'av1': /av01/i
        };

        for (const [codec, pattern] of Object.entries(codecPatterns)) {
          if (pattern.test(src)) {
            data.codec = codec.toUpperCase();
            break;
          }
        }
      }

      // 检查source元素的type属性
      const sources = element.querySelectorAll('source');
      sources.forEach(source => {
        const type = source.getAttribute('type');
        if (type && !data.codec) {
          if (type.includes('avc1')) data.codec = 'H264';
          else if (type.includes('hev1')) data.codec = 'H265';
          else if (type.includes('vp9')) data.codec = 'VP9';
          else if (type.includes('vp8')) data.codec = 'VP8';
          else if (type.includes('av01')) data.codec = 'AV1';
        }
      });

    } catch (error) {
      console.warn('Failed to detect codec:', error);
    }
  }

  // 检测比特率
  detectBitrate(element, data) {
    try {
      if (element.buffered && element.buffered.length > 0 && data.duration) {
        // 通过缓冲区大小估算比特率（这只是粗略估算）
        const bufferedSeconds = element.buffered.end(0) - element.buffered.start(0);
        if (bufferedSeconds > 0) {
          // 这里需要实际的字节数，但浏览器通常不提供
          // 我们使用质量基础的估算
          const qualityBitrates = {
            '4K': 25000,
            '2K': 16000, 
            '1440p': 16000,
            '1080p': 8000,
            '720p': 4000,
            '480p': 2000,
            '360p': 1000,
            '240p': 500
          };
          
          data.bitrate = qualityBitrates[data.quality] || 2000;
        }
      }
    } catch (error) {
      console.warn('Failed to detect bitrate:', error);
    }
  }

  // 估算文件大小
  estimateFileSize(data) {
    if (!data.duration || data.duration <= 0) return;

    let bitrate = data.bitrate || 2000; // 默认2Mbps

    // 基于分辨率的比特率估算
    if (data.width && data.height) {
      const pixels = data.width * data.height;
      
      if (pixels >= 3840 * 2160) { // 4K
        bitrate = 25000;
      } else if (pixels >= 2560 * 1440) { // 2K/1440p
        bitrate = 16000;
      } else if (pixels >= 1920 * 1080) { // 1080p
        bitrate = 8000;
      } else if (pixels >= 1280 * 720) { // 720p
        bitrate = 4000;
      } else if (pixels >= 854 * 480) { // 480p
        bitrate = 2000;
      } else if (pixels >= 640 * 360) { // 360p
        bitrate = 1000;
      } else { // 更低分辨率
        bitrate = 500;
      }
    }

    // 计算估算大小（字节）
    data.estimatedSize = Math.round((bitrate * 1000 * data.duration) / 8);
    data.bitrate = bitrate;
  }

  // 从URL猜测质量
  guessQualityFromUrl(url) {
    const urlLower = url.toLowerCase();
    
    // 常见的质量标识符（按优先级排序）
    const qualityPatterns = [
      { pattern: /4k|2160p|uhd/i, quality: '4K', resolution: '3840x2160' },
      { pattern: /2k|1440p|qhd/i, quality: '2K', resolution: '2560x1440' },
      { pattern: /1080p?|fhd|full.*hd/i, quality: '1080p', resolution: '1920x1080' },
      { pattern: /720p?|hd/i, quality: '720p', resolution: '1280x720' },
      { pattern: /480p?|sd/i, quality: '480p', resolution: '854x480' },
      { pattern: /360p?/i, quality: '360p', resolution: '640x360' },
      { pattern: /240p?/i, quality: '240p', resolution: '426x240' }
    ];

    for (const { pattern, quality, resolution } of qualityPatterns) {
      if (pattern.test(urlLower)) {
        return quality;
      }
    }
    
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

  // 检测网络请求中的流媒体
  detectNetworkRequests() {
    // 检查已缓存的网络请求
    if (window.performance && window.performance.getEntriesByType) {
      const networkEntries = window.performance.getEntriesByType('resource');
      
      networkEntries.forEach(entry => {
        if (entry.name.includes('.m3u8') || entry.name.includes('.mpd')) {
          console.log('Found streaming URL in network entries:', entry.name);
          
          const videoData = {
            id: generateId(),
            element: null,
            type: entry.name.includes('.m3u8') ? 'hls' : 'dash',
            url: entry.name,
            title: 'Network Stream',
            quality: this.guessQualityFromUrl(entry.name),
            resolution: '未知',
            format: entry.name.includes('.m3u8') ? 'HLS' : 'DASH',
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
      if (content && (content.includes('.m3u8') || content.includes('.mpd'))) {
        console.log('Found stream in meta tag:', content);
        
        const videoData = {
          id: generateId(),
          element: meta,
          type: content.includes('.m3u8') ? 'hls' : 'dash',
          url: content,
          title: document.title || 'Meta Stream',
          quality: this.guessQualityFromUrl(content),
          resolution: '未知',
          format: content.includes('.m3u8') ? 'HLS' : 'DASH',
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
              timestamp: Date.now(),
              domain: window.location.hostname
            };
            this.addVideo(videoData);
          });
        }
      }
    });
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
    
    // 优先返回正在播放的视频
    const playingVideo = videos.find(v => v.element && !v.element.paused);
    if (playingVideo) return playingVideo;
    
    // 返回最近检测到的视频
    return videos.sort((a, b) => b.timestamp - a.timestamp)[0] || null;
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
