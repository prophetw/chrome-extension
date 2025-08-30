// 后台脚本 - 处理消息和下载
let detectedVideos = new Map();

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VIDEO_DETECTED') {
    const tabId = sender.tab.id;
    if (!detectedVideos.has(tabId)) {
      detectedVideos.set(tabId, []);
    }
    
    const videos = detectedVideos.get(tabId);
    const existingVideo = videos.find(v => v.url === message.video.url);
    
    if (!existingVideo) {
      videos.push(message.video);
      detectedVideos.set(tabId, videos);
    }
    
    // 更新badge显示视频数量
    chrome.action.setBadgeText({
      text: videos.length > 0 ? videos.length.toString() : '',
      tabId: tabId
    });
    chrome.action.setBadgeBackgroundColor({color: '#4CAF50'});
    
    sendResponse({success: true});
  }
  
  if (message.type === 'GET_VIDEOS') {
    const tabId = sender.tab?.id || message.tabId;
    const videos = detectedVideos.get(tabId) || [];
    sendResponse({videos: videos});
  }
  
  if (message.type === 'DOWNLOAD_VIDEO') {
    downloadVideo(message.video, sender.tab.id);
    sendResponse({success: true});
  }
  
  if (message.type === 'CLEAR_VIDEOS') {
    const tabId = sender.tab?.id || message.tabId;
    detectedVideos.set(tabId, []);
    chrome.action.setBadgeText({
      text: '',
      tabId: tabId
    });
    sendResponse({success: true});
  }
  
  return true; // 保持消息通道开放
});

// 下载视频函数
async function downloadVideo(video, tabId) {
  try {
    let filename = video.title || `video_${Date.now()}`;
    
    // 根据视频类型添加扩展名
    if (video.type.includes('m3u8') || video.type.includes('hls')) {
      filename += '.m3u8';
    } else if (video.type.includes('mp4')) {
      filename += '.mp4';
    } else if (video.type.includes('webm')) {
      filename += '.webm';
    } else if (video.type.includes('flv')) {
      filename += '.flv';
    } else {
      // 从URL获取扩展名
      const urlExtension = video.url.split('.').pop().split('?')[0];
      if (['mp4', 'webm', 'flv', 'm3u8'].includes(urlExtension)) {
        filename += '.' + urlExtension;
      } else {
        filename += '.video';
      }
    }
    
    // 清理文件名中的非法字符
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    chrome.downloads.download({
      url: video.url,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('下载失败:', chrome.runtime.lastError);
        // 尝试在新标签页中打开视频链接
        chrome.tabs.create({url: video.url});
      } else {
        console.log('开始下载:', filename);
      }
    });
  } catch (error) {
    console.error('下载出错:', error);
    // 如果下载失败，在新标签页中打开视频链接
    chrome.tabs.create({url: video.url});
  }
}

// 清理已关闭标签页的数据
chrome.tabs.onRemoved.addListener((tabId) => {
  detectedVideos.delete(tabId);
});

// 标签页更新时重置badge
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    detectedVideos.set(tabId, []);
    chrome.action.setBadgeText({
      text: '',
      tabId: tabId
    });
  }
});
