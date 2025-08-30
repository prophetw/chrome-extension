// 默认搜索引擎配置
const DEFAULT_SEARCH_ENGINES = [
  {
    id: 'google',
    name: 'Google搜索',
    url: 'https://www.google.com/search?q=%s',
    enabled: true
  },
  {
    id: 'douban',
    name: '豆瓣',
    url: 'https://movie.douban.com/subject_search?search_text=%s',
    enabled: true
  },
  {
    id: 'imdb',
    name: 'imdb百度搜索',
    url: 'https://www.imdb.com/find/?s=all&q=%s',
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
  const result = await chrome.storage.sync.get(['searchEngines', 'batchSearchEngines']);
  if (!result.searchEngines) {
    await chrome.storage.sync.set({ searchEngines: DEFAULT_SEARCH_ENGINES });
  }
  
  // 初始化批量搜索配置（默认选择前两个启用的搜索引擎）
  if (!result.batchSearchEngines) {
    const enabledEngines = DEFAULT_SEARCH_ENGINES.filter(engine => engine.enabled);
    const defaultBatchEngines = enabledEngines.slice(0, 2).map(engine => engine.id);
    await chrome.storage.sync.set({ batchSearchEngines: defaultBatchEngines });
  }
  
  // 创建右键菜单
  await createContextMenus();
});

// 监听存储变化，更新右键菜单
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.searchEngines || changes.batchSearchEngines)) {
    createContextMenus();
  }
});

// 创建右键菜单
async function createContextMenus() {
  // 清除现有菜单
  await chrome.contextMenus.removeAll();
  
  // 获取搜索引擎配置
  const result = await chrome.storage.sync.get(['searchEngines', 'batchSearchEngines']);
  const searchEngines = result.searchEngines || DEFAULT_SEARCH_ENGINES;
  const batchSearchEngines = result.batchSearchEngines || [];
  
  // 过滤启用的搜索引擎
  const enabledEngines = searchEngines.filter(engine => engine.enabled);
  const batchEnabledEngines = enabledEngines.filter(engine => 
    batchSearchEngines.includes(engine.id)
  );
  
  if (enabledEngines.length === 0) {
    return;
  }
  
  // 创建父菜单
  chrome.contextMenus.create({
    id: 'customSearch',
    title: '自定义搜索',
    contexts: ['selection']
  });
  
  // 如果有批量搜索引擎，添加批量搜索选项
  if (batchEnabledEngines.length > 1) {
    chrome.contextMenus.create({
      id: 'batchSearch',
      parentId: 'customSearch',
      title: `同时搜索 (${batchEnabledEngines.length}个引擎) "%s"`,
      contexts: ['selection']
    });
    
    // 添加分隔符
    chrome.contextMenus.create({
      id: 'separator1',
      parentId: 'customSearch',
      type: 'separator',
      contexts: ['selection']
    });
  }
  
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
  const selectedText = info.selectionText;
  
  if (info.menuItemId === 'batchSearch') {
    // 处理批量搜索
    await handleBatchSearch(selectedText);
  } else if (info.menuItemId.startsWith('search_')) {
    // 处理单个搜索引擎搜索
    const engineId = info.menuItemId.replace('search_', '');
    await handleSingleSearch(engineId, selectedText);
  }
});

// 处理单个搜索引擎搜索
async function handleSingleSearch(engineId, selectedText) {
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

// 处理批量搜索
async function handleBatchSearch(selectedText) {
  // 获取配置
  const result = await chrome.storage.sync.get(['searchEngines', 'batchSearchEngines']);
  const searchEngines = result.searchEngines || DEFAULT_SEARCH_ENGINES;
  const batchSearchEngines = result.batchSearchEngines || [];
  
  // 过滤出批量搜索启用的搜索引擎
  const enabledEngines = searchEngines.filter(engine => 
    engine.enabled && batchSearchEngines.includes(engine.id)
  );
  
  // 依次在新标签页中打开每个搜索结果
  for (let i = 0; i < enabledEngines.length; i++) {
    const engine = enabledEngines[i];
    const searchUrl = engine.url.replace('%s', encodeURIComponent(selectedText));
    
    // 添加延迟避免同时打开太多标签页
    setTimeout(() => {
      chrome.tabs.create({ 
        url: searchUrl,
        active: i === 0 // 只有第一个标签页设为活跃状态
      });
    }, i * 300); // 每个标签页间隔300ms
  }
}
