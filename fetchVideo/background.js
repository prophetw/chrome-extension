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
      try {
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'FetchVideo',
            message: '开始下载视频...'
          });
        }
      } catch (error) {
        console.log('通知创建失败:', error);
      }
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
      
      try {
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'FetchVideo',
            message: `开始批量下载 ${results.videos.length} 个视频`
          });
        }
      } catch (error) {
        console.log('通知创建失败:', error);
      }
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
      
    case "getM3u8Downloads":
      getM3u8Downloads()
        .then(downloads => sendResponse({success: true, downloads}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true;
      
    case "cancelDownload":
      chrome.downloads.cancel(request.downloadId)
        .then(() => sendResponse({success: true}))
        .catch(error => sendResponse({success: false, error: error.message}));
      return true;
        
    case "cancelM3u8Download":
      cancelM3u8Download(request.taskId)
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
  
  // 检查是否是 m3u8 文件
  if (isM3u8Url(videoData.url)) {
    return await downloadM3u8Video(videoData, tab);
  } else {
    return await downloadVideo(videoData.url, tab, videoData.title);
  }
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

// 获取 M3U8 下载任务
async function getM3u8Downloads() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['m3u8Downloads'], (result) => {
      const downloads = result.m3u8Downloads || {};
      const downloadList = Object.values(downloads);
      // 按开始时间排序，最新的在前
      downloadList.sort((a, b) => b.startTime - a.startTime);
      resolve(downloadList);
    });
  });
}

// 取消 M3U8 下载任务
async function cancelM3u8Download(taskId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['m3u8Downloads'], async (result) => {
      const downloads = result.m3u8Downloads || {};
      const task = downloads[taskId];
      
      if (!task) {
        reject(new Error('下载任务不存在'));
        return;
      }
      
      if (task.status === 'downloading') {
        // 取消所有正在进行的下载
        const cancelPromises = task.downloadedSegments
          .filter(segment => segment.downloadId && !segment.error)
          .map(segment => chrome.downloads.cancel(segment.downloadId).catch(() => {}));
        
        await Promise.all(cancelPromises);
        
        // 更新任务状态
        task.status = 'cancelled';
        task.endTime = Date.now();
        downloads[taskId] = task;
        
        chrome.storage.local.set({ m3u8Downloads: downloads }, () => {
          // 发送取消通知
          try {
            if (chrome.notifications) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'FetchVideo - 下载已取消',
                message: 'M3U8 下载任务已取消'
              });
            }
          } catch (error) {
            console.log('取消通知创建失败:', error);
          }
          
          resolve();
        });
      } else {
        reject(new Error('任务无法取消'));
      }
    });
  });
}

// 下载 M3U8 视频
async function downloadM3u8Video(videoData, tab) {
  try {
    console.log('开始下载 M3U8 视频:', videoData.url);
    
    // 获取 m3u8 内容
    const m3u8Content = await fetchM3u8Content(videoData.url);
    console.log('M3U8 内容获取成功，解析片段...');
    
    // 解析 m3u8 内容获取片段链接
    const segments = parseM3u8Content(m3u8Content, videoData.url);
    console.log(`解析到 ${segments.length} 个视频片段`);
    
    if (segments.length === 0) {
      throw new Error('M3U8 文件中没有找到视频片段');
    }
    
    // 发送通知开始下载
    try {
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'progress',
          iconUrl: 'icons/icon48.png',
          title: 'FetchVideo - M3U8 下载',
          message: `开始下载 ${segments.length} 个视频片段...`,
          progress: 0
        });
      }
    } catch (error) {
      console.log('通知创建失败:', error);
    }
    
    // 创建下载任务
    const downloadTask = {
      id: generateDownloadId(),
      videoData: videoData,
      segments: segments,
      downloadedSegments: [],
      totalSegments: segments.length,
      currentIndex: 0,
      status: 'downloading',
      startTime: Date.now()
    };
    
    // 存储下载任务
    await storeDownloadTask(downloadTask);
    
    // 开始分段下载
    downloadM3u8Segments(downloadTask);
    
    return downloadTask.id;
  } catch (error) {
    console.error('M3U8 下载失败:', error);
    
    // 发送错误通知
    try {
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'FetchVideo - 下载失败',
          message: `M3U8 下载失败: ${error.message}`
        });
      }
    } catch (notificationError) {
      console.log('通知创建失败:', notificationError);
    }
    
    throw error;
  }
}

// 获取 M3U8 内容
async function fetchM3u8Content(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    if (!content || !content.includes('#EXTM3U')) {
      throw new Error('无效的 M3U8 文件格式');
    }
    
    return content;
  } catch (error) {
    console.error('获取 M3U8 内容失败:', error);
    throw new Error(`获取 M3U8 内容失败: ${error.message}`);
  }
}

// 解析 M3U8 内容获取视频片段链接
function parseM3u8Content(content, baseUrl) {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  const segments = [];
  const baseUri = getBaseUrl(baseUrl);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过注释和元数据行
    if (line.startsWith('#')) {
      continue;
    }
    
    // 这是一个片段URL
    if (line && !line.startsWith('#')) {
      let segmentUrl = line;
      
      // 处理相对URL
      if (!segmentUrl.startsWith('http://') && !segmentUrl.startsWith('https://')) {
        if (segmentUrl.startsWith('/')) {
          // 绝对路径
          const urlObj = new URL(baseUrl);
          segmentUrl = `${urlObj.protocol}//${urlObj.host}${segmentUrl}`;
        } else {
          // 相对路径
          segmentUrl = baseUri + '/' + segmentUrl;
        }
      }
      
      segments.push({
        url: segmentUrl,
        index: segments.length,
        duration: extractDurationFromPreviousLine(lines, i) || 10.0
      });
    }
  }
  
  return segments;
}

// 从前一行提取时长信息
function extractDurationFromPreviousLine(lines, currentIndex) {
  for (let i = currentIndex - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([0-9.]+)/);
      return match ? parseFloat(match[1]) : null;
    }
    // 如果遇到其他片段，停止查找
    if (!line.startsWith('#')) {
      break;
    }
  }
  return null;
}

// 获取基础URL
function getBaseUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/');
    pathSegments.pop(); // 移除文件名
    urlObj.pathname = pathSegments.join('/');
    return urlObj.toString().replace(/\/$/, ''); // 移除末尾的斜杠
  } catch (error) {
    console.error('解析基础URL失败:', error);
    return url.substring(0, url.lastIndexOf('/'));
  }
}

// 分段下载 M3U8 视频片段
async function downloadM3u8Segments(downloadTask) {
  const { segments, videoData } = downloadTask;
  
  try {
    // 串行下载片段以避免服务器压力
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      console.log(`下载片段 ${i + 1}/${segments.length}: ${segment.url}`);
      
      try {
        // 下载单个片段
        const downloadId = await chrome.downloads.download({
          url: segment.url,
          filename: `FetchVideo/temp/${downloadTask.id}/segment_${i.toString().padStart(4, '0')}.ts`,
          conflictAction: 'uniquify'
        });
        
        downloadTask.downloadedSegments.push({
          index: i,
          downloadId: downloadId,
          url: segment.url,
          filename: `segment_${i.toString().padStart(4, '0')}.ts`
        });
        
        downloadTask.currentIndex = i + 1;
        
        // 更新进度
        const progress = Math.round((i + 1) / segments.length * 100);
        updateDownloadProgress(downloadTask.id, progress);
        
        // 等待片段下载完成
        await waitForDownloadComplete(downloadId);
        
        // 添加小延迟避免过快请求
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`片段 ${i + 1} 下载失败:`, error);
        // 记录失败但继续下载其他片段
        downloadTask.downloadedSegments.push({
          index: i,
          error: error.message,
          url: segment.url
        });
      }
    }
    
    downloadTask.status = 'completed';
    downloadTask.endTime = Date.now();
    
    // 更新下载任务状态
    await storeDownloadTask(downloadTask);
    
    // 发送完成通知
    try {
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'FetchVideo - 下载完成',
          message: `M3U8 视频下载完成！已下载 ${downloadTask.downloadedSegments.filter(s => !s.error).length} 个片段`
        });
      }
    } catch (error) {
      console.log('通知创建失败:', error);
    }
    
    console.log('M3U8 视频下载完成:', downloadTask);
    
  } catch (error) {
    console.error('M3U8 下载过程中出错:', error);
    downloadTask.status = 'error';
    downloadTask.error = error.message;
    downloadTask.endTime = Date.now();
    
    await storeDownloadTask(downloadTask);
    
    try {
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'FetchVideo - 下载失败',
          message: `M3U8 下载失败: ${error.message}`
        });
      }
    } catch (notificationError) {
      console.log('通知创建失败:', notificationError);
    }
  }
}

// 等待下载完成
function waitForDownloadComplete(downloadId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('下载超时'));
    }, 30000); // 30秒超时
    
    const listener = (downloadDelta) => {
      if (downloadDelta.id === downloadId) {
        if (downloadDelta.state && downloadDelta.state.current === 'complete') {
          clearTimeout(timeout);
          chrome.downloads.onChanged.removeListener(listener);
          resolve(downloadId);
        } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
          clearTimeout(timeout);
          chrome.downloads.onChanged.removeListener(listener);
          reject(new Error('下载被中断'));
        }
      }
    };
    
    chrome.downloads.onChanged.addListener(listener);
  });
}

// 更新下载进度
function updateDownloadProgress(taskId, progress) {
  try {
    if (chrome.notifications) {
      chrome.notifications.update(taskId, {
        progress: progress
      }).catch(() => {
        // 如果通知不存在或更新失败，创建新的进度通知
        chrome.notifications.create(taskId, {
          type: 'progress',
          iconUrl: 'icons/icon48.png',
          title: 'FetchVideo - M3U8 下载',
          message: `下载进度: ${progress}%`,
          progress: progress
        }).catch(error => {
          console.log('进度通知创建失败:', error);
        });
      });
    }
  } catch (error) {
    console.log('更新下载进度失败:', error);
  }
}

// 生成下载任务ID
function generateDownloadId() {
  return 'm3u8_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 存储下载任务
async function storeDownloadTask(task) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['m3u8Downloads'], (result) => {
      const downloads = result.m3u8Downloads || {};
      downloads[task.id] = task;
      
      // 只保留最近的20个下载任务
      const taskIds = Object.keys(downloads);
      if (taskIds.length > 20) {
        taskIds.sort((a, b) => downloads[b].startTime - downloads[a].startTime);
        const toKeep = taskIds.slice(0, 20);
        const newDownloads = {};
        toKeep.forEach(id => {
          newDownloads[id] = downloads[id];
        });
        chrome.storage.local.set({ m3u8Downloads: newDownloads }, resolve);
      } else {
        chrome.storage.local.set({ m3u8Downloads: downloads }, resolve);
      }
    });
  });
}

// 检查是否是 M3U8 URL
function isM3u8Url(url) {
  if (!url || typeof url !== 'string') return false;
  const urlLower = url.toLowerCase();
  return urlLower.includes('.m3u8') || urlLower.includes('m3u8');
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
  try {
    if (downloadDelta.state && downloadDelta.state.current === 'complete') {
      // 下载完成通知
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'FetchVideo',
          message: '视频下载完成！'
        });
      }
    } else if (downloadDelta.state && downloadDelta.state.current === 'interrupted') {
      // 下载失败通知
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'FetchVideo',
          message: '视频下载失败，请重试'
        });
      }
    }
  } catch (error) {
    console.log('下载状态通知创建失败:', error);
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
