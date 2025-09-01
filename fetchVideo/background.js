// Background Service Worker for FetchVideo Extension

// 安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 创建视频下载菜单项
  chrome.contextMenus.create({
    id: "download-video",
    title: "下载视频",
    contexts: ["video", "audio", "link", "page"]
  });
  
  // 创建批量下载菜单项
  chrome.contextMenus.create({
    id: "download-all-videos",
    title: "下载页面所有视频",
    contexts: ["page"]
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "download-video":
      handleVideoDownload(info, tab);
      break;
    case "download-all-videos":
      handleBatchDownload(tab);
      break;
  }
});

// 处理单个视频下载
async function handleVideoDownload(info, tab) {
  try {
    let videoUrl = null;
    
    // 如果点击的是视频元素
    if (info.mediaType === 'video' || info.mediaType === 'audio') {
      videoUrl = info.srcUrl;
    }
    // 如果点击的是链接
    else if (info.linkUrl) {
      const url = info.linkUrl;
      if (isVideoUrl(url)) {
        videoUrl = url;
      }
    }
    // 如果在页面上点击，尝试检测当前活动视频
    else {
      const results = await chrome.tabs.sendMessage(tab.id, {
        action: "getActiveVideo"
      });
      videoUrl = results?.url;
    }
    
    if (videoUrl) {
      await downloadVideo(videoUrl, tab);
      // 发送通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FetchVideo',
        message: '开始下载视频...'
      });
    } else {
      console.log('未找到可下载的视频');
    }
  } catch (error) {
    console.error('下载视频时出错:', error);
  }
}

// 处理批量下载
async function handleBatchDownload(tab) {
  try {
    const results = await chrome.tabs.sendMessage(tab.id, {
      action: "getAllVideos"
    });
    
    if (results && results.videos && results.videos.length > 0) {
      for (const video of results.videos) {
        await downloadVideo(video.url, tab, video.title);
        // 添加延迟避免过快下载
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'FetchVideo',
        message: `开始批量下载 ${results.videos.length} 个视频`
      });
    }
  } catch (error) {
    console.error('批量下载时出错:', error);
  }
}

// 下载视频函数
async function downloadVideo(url, tab, customName = null) {
  try {
    // 获取文件名
    const filename = customName || getFilenameFromUrl(url) || `video_${Date.now()}`;
    const extension = getFileExtension(url) || '.mp4';
    
    // 开始下载
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: `FetchVideo/${filename}${extension}`,
      conflictAction: 'uniquify'
    });
    
    console.log(`开始下载: ${url}, downloadId: ${downloadId}`);
    return downloadId;
  } catch (error) {
    console.error('下载失败:', error);
    throw error;
  }
}

// 监听来自content script和popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "downloadVideo":
      handleDownloadRequest(request.videoData, sender.tab)
        .then(result => sendResponse({success: true, result}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true; // 异步响应
      
    case "getDownloads":
      getRecentDownloads()
        .then(downloads => sendResponse({success: true, downloads}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true;
      
    case "cancelDownload":
      chrome.downloads.cancel(request.downloadId)
        .then(() => sendResponse({success: true}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true;
  }
});

// 处理下载请求
async function handleDownloadRequest(videoData, tab) {
  if (!videoData || !videoData.url) {
    throw new Error('无效的视频数据');
  }
  
  return await downloadVideo(videoData.url, tab, videoData.title);
}

// 获取最近的下载记录
async function getRecentDownloads() {
  return new Promise((resolve) => {
    chrome.downloads.search({
      filenameRegex: 'FetchVideo/.*',
      limit: 10,
      orderBy: ['-startTime']
    }, resolve);
  });
}

// 工具函数
function isVideoUrl(url) {
  const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m3u8', '.mpd'];
  const urlLower = url.toLowerCase();
  return videoExtensions.some(ext => urlLower.includes(ext));
}

function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    return filename.split('.')[0]; // 不包含扩展名
  } catch (error) {
    return null;
  }
}

function getFileExtension(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\.[^.]+$/);
    return match ? match[0] : null;
  } catch (error) {
    return null;
  }
}

// 监听下载状态变化
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    // 下载完成通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'FetchVideo',
      message: '视频下载完成！'
    });
  } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
    // 下载失败通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'FetchVideo',
      message: '视频下载失败，请重试'
    });
  }
});

// 网络请求拦截 - 专门检测m3u8流媒体
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // 只处理m3u8请求
    if (isM3u8Request(details.url)) {
      console.log('M3U8 request detected:', details.url);
      storeM3u8Request(details);
    }
  },
  {
    urls: [
      "*://*/*.m3u8*",   // HLS 流
      "*://*/*.M3U8*",   // 大写版本
      "*://*/*m3u8*",    // 包含m3u8的URL
      "*://*/*M3U8*"     // 包含M3U8的URL
    ]
  }
);

// 监听响应头，获取更多m3u8信息
chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    if (isM3u8Request(details.url)) {
      console.log('M3U8 response detected:', details.url, details.responseHeaders);
      updateM3u8RequestInfo(details);
    }
  },
  {
    urls: [
      "*://*/*.m3u8*",
      "*://*/*.M3U8*",
      "*://*/*m3u8*",
      "*://*/*M3U8*"
    ]
  },
  ["responseHeaders"]
);

function isM3u8Request(url) {
  const urlLower = url.toLowerCase();
  return urlLower.includes('.m3u8') || urlLower.includes('m3u8');
}

function storeM3u8Request(details) {
  chrome.storage.local.get(['detectedVideos'], (result) => {
    const videos = result.detectedVideos || [];
    
    const newVideo = {
      id: generateM3u8Id(details.url),
      url: details.url,
      tabId: details.tabId,
      timestamp: Date.now(),
      type: 'hls',
      format: 'HLS',
      priority: 100,
      method: details.method,
      source: 'network_m3u8',
      title: extractTitleFromUrl(details.url) || 'HLS Stream',
      quality: guessQualityFromUrl(details.url)
    };
    
    // 避免重复添加相同的m3u8 URL
    const existingIndex = videos.findIndex(v => v.url === newVideo.url);
    if (existingIndex >= 0) {
      // 更新现有记录
      videos[existingIndex] = { ...videos[existingIndex], ...newVideo };
    } else {
      videos.push(newVideo);
    }
    
    // 按优先级排序，只保留最近50个
    videos.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    if (videos.length > 50) {
      videos.splice(50);
    }
    
    chrome.storage.local.set({detectedVideos: videos});
    
    // 通知content script有新的m3u8发现
    chrome.tabs.sendMessage(details.tabId, {
      action: 'newM3u8Detected',
      video: newVideo
    }).catch(e => console.warn('Failed to notify content script:', e));
  });
}

function updateM3u8RequestInfo(details) {
  // 从响应头获取更多信息
  const contentLength = details.responseHeaders?.find(h => 
    h.name.toLowerCase() === 'content-length'
  )?.value;
  
  const contentType = details.responseHeaders?.find(h => 
    h.name.toLowerCase() === 'content-type'
  )?.value;
  
  if (contentLength || contentType) {
    chrome.storage.local.get(['detectedVideos'], (result) => {
      const videos = result.detectedVideos || [];
      const videoIndex = videos.findIndex(v => v.url === details.url);
      
      if (videoIndex >= 0) {
        if (contentLength) {
          videos[videoIndex].fileSize = parseInt(contentLength);
        }
        if (contentType) {
          videos[videoIndex].contentType = contentType;
        }
        
        chrome.storage.local.set({detectedVideos: videos});
      }
    });
  }
}

function generateM3u8Id(url) {
  return 'm3u8_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function extractTitleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/').filter(s => s.length > 0);
    
    // 尝试从路径中提取有意义的名称
    for (let i = segments.length - 1; i >= 0; i--) {
      const segment = segments[i];
      if (segment && !segment.includes('.m3u8') && segment.length > 2) {
        return decodeURIComponent(segment).replace(/[_-]/g, ' ');
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function guessQualityFromUrl(url) {
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
