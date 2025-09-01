// Content Script for FetchVideo Extension

console.log('FetchVideo content script loaded');

// 等待页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDetector);
} else {
  initializeDetector();
}

function initializeDetector() {
  // 延迟初始化，等待其他脚本加载
  setTimeout(() => {
    if (window.videoDetector) {
      window.videoDetector.init();
    }
  }, 1000);
}

// 监听来自popup和background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  switch (request.action) {
    case 'getAllVideos':
      handleGetAllVideos(sendResponse);
      return true; // 异步响应
      
    case 'getActiveVideo':
      handleGetActiveVideo(sendResponse);
      return true;
      
    case 'refreshDetection':
      handleRefreshDetection(sendResponse);
      return true;
      
    case 'downloadVideo':
      handleDownloadVideo(request.videoData, sendResponse);
      return true;
      
    case 'getPageInfo':
      handleGetPageInfo(sendResponse);
      return true;
  }
});

// 处理获取所有视频请求
function handleGetAllVideos(sendResponse) {
  try {
    if (!window.videoDetector) {
      sendResponse({ success: false, error: 'Video detector not initialized' });
      return;
    }
    
    const videos = window.videoDetector.getAllVideos();
    console.log('Found videos:', videos);
    
    // 增强视频信息
    const enhancedVideos = videos.map(video => {
      const enhanced = {
        ...video,
        title: sanitizeTitle(video.title),
        downloadable: isDownloadable(video),
        estimatedSize: video.estimatedSize || estimateFileSize(video),
        displaySize: getDisplaySize(video),
        displayResolution: getDisplayResolution(video),
        qualityScore: calculateQualityScore(video)
      };
      
      return enhanced;
    });
    
    // 按质量分数排序（高质量优先）
    enhancedVideos.sort((a, b) => b.qualityScore - a.qualityScore);
    
    sendResponse({ 
      success: true, 
      videos: enhancedVideos,
      count: enhancedVideos.length 
    });
  } catch (error) {
    console.error('Error getting all videos:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理获取活动视频请求
function handleGetActiveVideo(sendResponse) {
  try {
    if (!window.videoDetector) {
      sendResponse({ success: false, error: 'Video detector not initialized' });
      return;
    }
    
    const activeVideo = window.videoDetector.getActiveVideo();
    if (activeVideo) {
      const enhanced = {
        ...activeVideo,
        title: sanitizeTitle(activeVideo.title),
        downloadable: isDownloadable(activeVideo),
        estimatedSize: estimateFileSize(activeVideo)
      };
      sendResponse({ success: true, video: enhanced });
    } else {
      sendResponse({ success: false, error: 'No active video found' });
    }
  } catch (error) {
    console.error('Error getting active video:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理刷新检测请求
function handleRefreshDetection(sendResponse) {
  try {
    if (window.videoDetector) {
      window.videoDetector.cleanup();
      setTimeout(() => {
        window.videoDetector.init();
        const videos = window.videoDetector.getAllVideos();
        sendResponse({ 
          success: true, 
          videos: videos,
          message: 'Detection refreshed' 
        });
      }, 1000);
    } else {
      sendResponse({ success: false, error: 'Video detector not available' });
    }
  } catch (error) {
    console.error('Error refreshing detection:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理下载视频请求
function handleDownloadVideo(videoData, sendResponse) {
  try {
    if (!videoData || !videoData.url) {
      sendResponse({ success: false, error: 'Invalid video data' });
      return;
    }
    
    // 发送到background script处理下载
    chrome.runtime.sendMessage({
      action: 'downloadVideo',
      videoData: videoData
    }).then(response => {
      sendResponse(response);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
  } catch (error) {
    console.error('Error downloading video:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 处理获取页面信息请求
function handleGetPageInfo(sendResponse) {
  try {
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      domain: window.location.hostname,
      hasVideos: document.querySelectorAll('video, audio').length > 0,
      videoCount: window.videoDetector ? window.videoDetector.getAllVideos().length : 0,
      timestamp: Date.now()
    };
    
    sendResponse({ success: true, pageInfo: pageInfo });
  } catch (error) {
    console.error('Error getting page info:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 工具函数

// 清理标题
function sanitizeTitle(title) {
  if (!title) return 'Untitled Video';
  
  return title
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

// 检查是否可下载
function isDownloadable(video) {
  if (!video || !video.url) return false;
  
  // 检查URL格式
  if (!isVideoUrl(video.url)) return false;
  
  // 检查是否是本地文件
  if (video.url.startsWith('blob:') || video.url.startsWith('data:')) {
    return false;
  }
  
  // 检查协议
  if (!video.url.startsWith('http://') && !video.url.startsWith('https://')) {
    return false;
  }
  
  return true;
}

// 估计文件大小
function estimateFileSize(video) {
  if (!video) return 0;
  
  // 如果已有实际大小或估算大小，直接返回
  if (video.fileSize) return video.fileSize;
  if (video.actualSize) return video.actualSize;
  if (video.estimatedSize) return video.estimatedSize;
  
  // 如果有duration，进行估计
  if (video.duration && video.duration > 0) {
    // 基于质量和时长的粗略估计
    let bitrate = 2000; // 默认 2 Mbps
    
    if (video.bitrate && video.bitrate > 0) {
      bitrate = video.bitrate;
    } else if (video.width && video.height) {
      // 基于分辨率估算比特率
      const pixels = video.width * video.height;
      
      if (pixels >= 3840 * 2160) bitrate = 25000; // 4K
      else if (pixels >= 2560 * 1440) bitrate = 16000; // 2K
      else if (pixels >= 1920 * 1080) bitrate = 8000; // 1080p
      else if (pixels >= 1280 * 720) bitrate = 4000; // 720p
      else if (pixels >= 854 * 480) bitrate = 2000; // 480p
      else if (pixels >= 640 * 360) bitrate = 1000; // 360p
      else bitrate = 500; // 更低分辨率
    } else if (video.quality) {
      // 基于质量标签估算
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
      bitrate = qualityBitrates[video.quality] || 2000;
    }
    
    return Math.round((bitrate * 1000 * video.duration) / 8); // bytes
  }
  
  return 0;
}

// 获取显示用的文件大小
function getDisplaySize(video) {
  const size = video.fileSize || video.actualSize || video.estimatedSize || estimateFileSize(video);
  
  if (!size || size <= 0) return '';
  
  // 如果是估算大小，添加波浪号标识
  const isEstimated = !video.fileSize && !video.actualSize;
  const prefix = isEstimated ? '~' : '';
  
  return prefix + formatFileSize(size);
}

// 获取显示用的分辨率
function getDisplayResolution(video) {
  if (video.width && video.height) {
    return `${video.width}x${video.height}`;
  } else if (video.resolution && video.resolution !== '未知') {
    return video.resolution;
  }
  return '';
}

// 计算质量分数（用于排序）
function calculateQualityScore(video) {
  let score = 0;
  
  // 基于类型的优先级分数
  if (video.type === 'hls') score += 10000;        // m3u8 最高优先级
  else if (video.type === 'dash') score += 9000;   // mpd 次高优先级
  else if (video.type === 'network') score += 8000; // 网络请求
  else score += 5000;                               // 普通video元素
  
  // 基于分辨率的分数
  if (video.width && video.height) {
    const pixels = video.width * video.height;
    score += pixels / 1000; // 像素数除以1000作为基础分数
  } else if (video.quality) {
    // 基于质量标签的分数
    const qualityScores = {
      '4K': 8000,
      '2K': 4000,
      '1440p': 4000,
      '1080p': 2000,
      '720p': 1000,
      '480p': 500,
      '360p': 250,
      '240p': 100
    };
    score += qualityScores[video.quality] || 100;
  }
  
  // 基于时长的分数加成
  if (video.duration && video.duration > 0) {
    score += video.duration * 0.1; // 时长加成
  }
  
  // 基于比特率的分数加成
  if (video.bitrate && video.bitrate > 0) {
    score += video.bitrate * 0.01;
  }
  
  // 如果有实际文件大小，给予额外分数
  if (video.fileSize || video.actualSize) {
    score += 100;
  }
  
  // 基于优先级的分数
  if (video.priority) {
    score += video.priority * 10;
  }
  
  // 源可靠性分数
  if (video.source === 'script_content') score += 500;
  else if (video.source === 'html_content') score += 400;
  else if (video.source === 'element_attribute') score += 300;
  else if (video.source === 'network_intercept') score += 200;
  
  return score;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  let precision = 1;
  if (size >= 100) precision = 0;
  else if (size >= 10) precision = 1;
  else precision = 2;
  
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

// 定期检查新视频（用于动态加载的内容）
setInterval(() => {
  if (window.videoDetector && window.videoDetector.isInitialized) {
    // 检查是否有新的视频元素
    const currentVideoCount = document.querySelectorAll('video, audio').length;
    const detectedCount = window.videoDetector.getAllVideos().length;
    
    if (currentVideoCount > detectedCount) {
      console.log('New video elements detected, rescanning...');
      window.videoDetector.detectExistingVideos();
    }
  }
}, 5000);

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.videoDetector) {
    // 页面变为可见时，刷新检测
    setTimeout(() => {
      window.videoDetector.detectExistingVideos();
    }, 1000);
  }
});

// 监听URL变化（SPA应用）
let currentUrl = window.location.href;
setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    console.log('URL changed, refreshing video detection');
    
    if (window.videoDetector) {
      setTimeout(() => {
        window.videoDetector.cleanup();
        window.videoDetector.init();
      }, 2000);
    }
  }
}, 1000);

console.log('FetchVideo content script initialized');
