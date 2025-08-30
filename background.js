// 默认搜索引擎配置
const DEFAULT_SEARCH_ENGINES = [
  {
    id: 'google',
    name: 'Google搜索',
    url: 'https://www.google.com/search?q=%s',
    enabled: true
  },
  {
    id: 'baidu',
    name: '百度搜索',
    url: 'https://www.baidu.com/s?wd=%s',
    enabled: true
  },
  {
    id: 'bing',
    name: 'Bing搜索',
    url: 'https://www.bing.com/search?q=%s',
    enabled: false
  }
];

// 扩展安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  // 初始化存储的搜索引擎配置
  const result = await chrome.storage.sync.get(['searchEngines']);
  if (!result.searchEngines) {
    await chrome.storage.sync.set({ searchEngines: DEFAULT_SEARCH_ENGINES });
  }
  
  // 创建右键菜单
  await createContextMenus();
});

// 监听存储变化，更新右键菜单
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.searchEngines) {
    createContextMenus();
  }
});

// 创建右键菜单
async function createContextMenus() {
  // 清除现有菜单
  await chrome.contextMenus.removeAll();
  
  // 获取搜索引擎配置
  const result = await chrome.storage.sync.get(['searchEngines']);
  const searchEngines = result.searchEngines || DEFAULT_SEARCH_ENGINES;
  
  // 过滤启用的搜索引擎
  const enabledEngines = searchEngines.filter(engine => engine.enabled);
  
  if (enabledEngines.length === 0) {
    return;
  }
  
  // 创建父菜单
  chrome.contextMenus.create({
    id: 'customSearch',
    title: '自定义搜索',
    contexts: ['selection']
  });
  
  // 为每个启用的搜索引擎创建子菜单
  enabledEngines.forEach(engine => {
    chrome.contextMenus.create({
      id: `search_${engine.id}`,
      parentId: 'customSearch',
      title: `用 ${engine.name} 搜索 "%s"`,
      contexts: ['selection']
    });
  });
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith('search_')) {
    const engineId = info.menuItemId.replace('search_', '');
    const selectedText = info.selectionText;
    
    // 获取搜索引擎配置
    const result = await chrome.storage.sync.get(['searchEngines']);
    const searchEngines = result.searchEngines || DEFAULT_SEARCH_ENGINES;
    
    // 找到对应的搜索引擎
    const engine = searchEngines.find(e => e.id === engineId);
    if (engine) {
      // 构建搜索URL
      const searchUrl = engine.url.replace('%s', encodeURIComponent(selectedText));
      
      // 在新标签页中打开搜索结果
      chrome.tabs.create({ url: searchUrl });
    }
  }
});
