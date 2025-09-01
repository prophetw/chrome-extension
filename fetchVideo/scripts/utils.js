// 工具函数库

// 视频URL检测函数
function isVideoUrl(url) {
  if (!url) return false;
  
  const videoExtensions = [
    '.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', 
    '.m4v', '.3gp', '.ogv', '.m3u8', '.mpd', '.f4v', '.asf'
  ];
  
  const videoMimeTypes = [
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi',
    'video/quicktime', 'video/x-msvideo', 'application/x-mpegURL',
    'application/dash+xml'
  ];
  
  const urlLower = url.toLowerCase();
  
  // 检查文件扩展名
  if (videoExtensions.some(ext => urlLower.includes(ext))) {
    return true;
  }
  
  // 检查URL模式
  const videoPatterns = [
    /\/video\//i,
    /\/stream\//i,
    /\/media\//i,
    /\.m3u8/i,
    /\.mpd/i,
    /hls\//i,
    /dash\//i
  ];
  
  return videoPatterns.some(pattern => pattern.test(url));
}

// M3U8 URL检测函数
function isM3u8Url(url) {
  if (!url || typeof url !== 'string') return false;
  const urlLower = url.toLowerCase();
  return urlLower.includes('.m3u8') || urlLower.includes('m3u8');
}

// 检测是否为 DASH URL
function isDashUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const urlLower = url.toLowerCase();
  return urlLower.includes('.mpd') || urlLower.includes('mpd');
}

// 检测流媒体类型
function getStreamType(url) {
  if (isM3u8Url(url)) return 'hls';
  if (isDashUrl(url)) return 'dash';
  return 'direct';
}

// 从 M3U8 URL 猜测视频质量
function guessQualityFromM3u8Url(url) {
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
  
  // 比特率相关的推测
  if (urlLower.includes('high') || urlLower.includes('max')) return '高清';
  if (urlLower.includes('medium') || urlLower.includes('mid')) return '标清';
  if (urlLower.includes('low') || urlLower.includes('min')) return '流畅';
  
  return '未知';
}

// 估算 M3U8 视频大小
function estimateM3u8Size(duration, quality) {
  if (!duration || duration <= 0) return 0;
  
  // 基于质量的比特率估算（kbps）
  const qualityBitrates = {
    '4K': 25000,
    '2K': 16000,
    '1440p': 16000,
    '1080p': 8000,
    '720p': 4000,
    '480p': 2000,
    '360p': 1000,
    '240p': 500,
    '高清': 6000,
    '标清': 3000,
    '流畅': 1000
  };
  
  const bitrate = qualityBitrates[quality] || 2000;
  
  // 计算估算大小（字节）
  return Math.round((bitrate * 1000 * duration) / 8);
}

// 解析 M3U8 URL 获取基础信息
function parseM3u8UrlInfo(url) {
  const info = {
    baseUrl: '',
    fileName: '',
    quality: '',
    isRelative: false,
    domain: ''
  };
  
  try {
    const urlObj = new URL(url);
    info.domain = urlObj.hostname;
    
    // 获取基础 URL（移除文件名）
    const pathSegments = urlObj.pathname.split('/');
    pathSegments.pop(); // 移除最后的文件名
    urlObj.pathname = pathSegments.join('/');
    info.baseUrl = urlObj.toString().replace(/\/$/, '');
    
    // 获取文件名
    const fullPath = new URL(url).pathname;
    info.fileName = fullPath.split('/').pop() || 'playlist.m3u8';
    
    // 猜测质量
    info.quality = guessQualityFromM3u8Url(url);
    
  } catch (error) {
    console.warn('解析 M3U8 URL 失败:', error);
    info.fileName = 'playlist.m3u8';
    info.quality = '未知';
  }
  
  return info;
}

// 生成 M3U8 下载任务的显示名称
function generateM3u8DisplayName(url, title) {
  const urlInfo = parseM3u8UrlInfo(url);
  
  let displayName = title || 'HLS Stream';
  
  // 添加质量信息
  if (urlInfo.quality && urlInfo.quality !== '未知') {
    displayName += ` (${urlInfo.quality})`;
  }
  
  // 添加来源域名
  if (urlInfo.domain) {
    displayName += ` - ${urlInfo.domain}`;
  }
  
  return displayName;
}

// 验证 M3U8 文件内容
function validateM3u8Content(content) {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'M3U8 内容为空' };
  }
  
  const lines = content.trim().split('\n');
  
  // 检查第一行是否是 M3U8 标识
  if (!lines[0].trim().startsWith('#EXTM3U')) {
    return { valid: false, error: '不是有效的 M3U8 文件格式' };
  }
  
  // 检查是否包含片段信息
  const hasSegments = lines.some(line => 
    !line.trim().startsWith('#') && line.trim().length > 0
  );
  
  if (!hasSegments) {
    return { valid: false, error: 'M3U8 文件中没有找到视频片段' };
  }
  
  return { valid: true };
}

// 从 M3U8 内容中提取基本信息
function extractM3u8Info(content) {
  const info = {
    totalDuration: 0,
    segmentCount: 0,
    targetDuration: 0,
    isLive: false,
    version: 1
  };
  
  if (!content) return info;
  
  const lines = content.split('\n').map(line => line.trim());
  
  lines.forEach(line => {
    // 提取版本
    if (line.startsWith('#EXT-X-VERSION:')) {
      info.version = parseInt(line.split(':')[1]) || 1;
    }
    
    // 提取目标片段时长
    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      info.targetDuration = parseFloat(line.split(':')[1]) || 0;
    }
    
    // 检查是否是直播流
    if (line.includes('#EXT-X-PLAYLIST-TYPE:VOD')) {
      info.isLive = false;
    } else if (line.includes('#EXT-X-PLAYLIST-TYPE:EVENT')) {
      info.isLive = true;
    }
    
    // 统计片段信息
    if (line.startsWith('#EXTINF:')) {
      const duration = parseFloat(line.split(':')[1]) || 0;
      info.totalDuration += duration;
      info.segmentCount++;
    }
  });
  
  return info;
}

// 从URL获取文件名
function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    
    // 移除查询参数
    pathname = pathname.split('?')[0];
    
    // 获取文件名
    const segments = pathname.split('/');
    let filename = segments[segments.length - 1];
    
    // 如果没有文件名，生成一个
    if (!filename || filename.length === 0) {
      filename = 'video_' + Date.now();
    }
    
    // 移除扩展名
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex > 0) {
      filename = filename.substring(0, dotIndex);
    }
    
    return filename;
  } catch (error) {
    return 'video_' + Date.now();
  }
}

// 获取文件扩展名
function getFileExtension(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.split('?')[0]; // 移除查询参数
    const match = pathname.match(/\.([^./]+)$/);
    return match ? '.' + match[1] : '.mp4'; // 默认为mp4
  } catch (error) {
    return '.mp4';
  }
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化时间
function formatDuration(seconds) {
  if (!seconds || seconds === 0) return '未知';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

// 清理文件名
function sanitizeFilename(filename) {
  // 移除或替换不合法的文件名字符
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200); // 限制长度
}

// 检测视频质量
function getVideoQuality(width, height) {
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

// 格式化分辨率显示
function formatResolution(width, height) {
  if (!width || !height) return '未知';
  
  const quality = getVideoQuality(width, height);
  const resolution = `${width}x${height}`;
  
  // 如果质量标签与分辨率不同，显示两者
  if (quality !== resolution && !quality.includes('x')) {
    return `${resolution} (${quality})`;
  }
  
  return resolution;
}

// 增强的文件大小格式化
function formatFileSize(bytes, precision = 1) {
  if (!bytes || bytes === 0) return '未知大小';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  // 根据大小调整精度
  if (size >= 100) precision = 0;
  else if (size >= 10) precision = 1;
  else precision = 2;
  
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

// 估算下载时间
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

// 获取比特率显示
function formatBitrate(bitrate) {
  if (!bitrate || bitrate <= 0) return '';
  
  if (bitrate >= 1000) {
    return `${(bitrate / 1000).toFixed(1)} Mbps`;
  } else {
    return `${bitrate} Kbps`;
  }
}

// 获取帧率显示
function formatFrameRate(frameRate) {
  if (!frameRate || frameRate <= 0) return '';
  return `${frameRate} fps`;
}

// 分析视频URL获取额外信息
function analyzeVideoUrl(url) {
  const info = {
    isStream: false,
    isLive: false,
    platform: 'unknown',
    hasQualityOptions: false
  };
  
  const urlLower = url.toLowerCase();
  
  // 检测流媒体
  if (urlLower.includes('.m3u8')) {
    info.isStream = true;
    info.format = 'HLS';
  } else if (urlLower.includes('.mpd')) {
    info.isStream = true;
    info.format = 'DASH';
  }
  
  // 检测直播
  if (urlLower.includes('live') || urlLower.includes('stream')) {
    info.isLive = true;
  }
  
  // 检测平台
  if (urlLower.includes('youtube')) info.platform = 'YouTube';
  else if (urlLower.includes('bilibili')) info.platform = 'Bilibili';
  else if (urlLower.includes('vimeo')) info.platform = 'Vimeo';
  else if (urlLower.includes('twitch')) info.platform = 'Twitch';
  
  return info;
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 等待元素出现
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// 获取元素的所有属性
function getAllAttributes(element) {
  const attrs = {};
  if (element && element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

// 检查URL是否可访问
async function checkUrlAccessible(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// 提取域名
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return '';
  }
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 深度克隆对象
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

// 检测移动设备
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 检测浏览器类型
function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  
  return {
    name: browser,
    userAgent: ua,
    isMobile: isMobile()
  };
}

// 导出函数（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isVideoUrl,
    isM3u8Url,
    isDashUrl,
    getStreamType,
    guessQualityFromM3u8Url,
    estimateM3u8Size,
    parseM3u8UrlInfo,
    generateM3u8DisplayName,
    validateM3u8Content,
    extractM3u8Info,
    getFilenameFromUrl,
    getFileExtension,
    formatFileSize,
    formatDuration,
    sanitizeFilename,
    getVideoQuality,
    formatResolution,
    formatBitrate,
    formatFrameRate,
    analyzeVideoUrl,
    estimateDownloadTime,
    debounce,
    throttle,
    waitForElement,
    getAllAttributes,
    checkUrlAccessible,
    extractDomain,
    generateId,
    deepClone,
    isMobile,
    getBrowserInfo
  };
}
