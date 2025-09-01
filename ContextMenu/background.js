// 默认搜索引擎配置
const DEFAULT_SEARCH_ENGINES = [
  {
    id: 'google',
    name: 'Google搜索',
    url: 'https://www.google.com/search?q=%s',
    enabled: true,
    groupId: 'general'
  },
  {
    id: 'douban',
    name: '豆瓣电影',
    url: 'https://movie.douban.com/subject_search?search_text=%s',
    enabled: true,
    groupId: 'movie'
  },
  {
    id: 'imdb',
    name: 'IMDb',
    url: 'https://www.imdb.com/find/?s=all&q=%s',
    enabled: true,
    groupId: 'movie'
  },
  {
    id: 'bing',
    name: 'Bing搜索',
    url: 'https://www.bing.com/search?q=%s',
    enabled: false,
    groupId: 'general'
  },
  {
    id: 'eastmoney',
    name: '东方财富股票',
    url: 'https://so.eastmoney.com/web/s?keyword=%s',
    enabled: true,
    groupId: 'stock'
  }
];

// 默认分组配置
const DEFAULT_GROUPS = [
  {
    id: 'general',
    name: '通用搜索',
    enabled: true
  },
  {
    id: 'movie',
    name: '影视搜索',
    enabled: true
  },
  {
    id: 'stock',
    name: '股票查询',
    enabled: true
  }
];

// 扩展安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  // 初始化存储的搜索引擎配置
  const result = await chrome.storage.sync.get(['searchEngines', 'batchSearchEngines', 'searchGroups', 'batchSearchGroups']);
  
  // 初始化分组配置
  if (!result.searchGroups) {
    await chrome.storage.sync.set({ searchGroups: DEFAULT_GROUPS });
  }
  
  if (!result.searchEngines) {
    await chrome.storage.sync.set({ searchEngines: DEFAULT_SEARCH_ENGINES });
  } else {
    // 迁移现有搜索引擎，为没有groupId的引擎添加默认分组
    const searchEngines = result.searchEngines;
    let needUpdate = false;
    
    searchEngines.forEach(engine => {
      if (!engine.groupId) {
        // 根据名称推测分组
        if (engine.name.includes('豆瓣') || engine.name.includes('imdb') || engine.name.includes('电影')) {
          engine.groupId = 'movie';
        } else if (engine.name.includes('股票') || engine.name.includes('财经') || engine.name.includes('东方财富')) {
          engine.groupId = 'stock';
        } else {
          engine.groupId = 'general';
        }
        needUpdate = true;
      }
    });
    
    if (needUpdate) {
      await chrome.storage.sync.set({ searchEngines });
    }
  }
  
  // 初始化批量搜索分组配置（默认启用影视和股票分组的批量搜索）
  if (!result.batchSearchGroups) {
    await chrome.storage.sync.set({ batchSearchGroups: ['movie', 'stock'] });
  }
  
  // 兼容旧版本：如果存在旧的单个引擎批量搜索配置，清理它
  if (result.batchSearchEngines) {
    await chrome.storage.sync.remove(['batchSearchEngines']);
  }
  
  // 创建右键菜单
  await createContextMenus();
});

// 监听存储变化，更新右键菜单
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.searchEngines || changes.batchSearchGroups || changes.searchGroups)) {
    createContextMenus();
  }
});

// 创建右键菜单
async function createContextMenus() {
  // 清除现有菜单
  await chrome.contextMenus.removeAll();
  
  // 获取搜索引擎配置
  const result = await chrome.storage.sync.get(['searchEngines', 'batchSearchGroups', 'searchGroups']);
  const searchEngines = result.searchEngines || DEFAULT_SEARCH_ENGINES;
  const batchSearchGroups = result.batchSearchGroups || [];
  const searchGroups = result.searchGroups || DEFAULT_GROUPS;
  
  // 过滤启用的搜索引擎和分组
  const enabledEngines = searchEngines.filter(engine => engine.enabled);
  const enabledGroups = searchGroups.filter(group => group.enabled);
  
  if (enabledEngines.length === 0) {
    return;
  }
  
  // 创建父菜单
  chrome.contextMenus.create({
    id: 'customSearch',
    title: '自定义搜索',
    contexts: ['selection']
  });
  
  // 为启用批量搜索的分组添加批量搜索选项
  const batchGroups = enabledGroups.filter(group => 
    batchSearchGroups.includes(group.id) && 
    enabledEngines.filter(engine => engine.groupId === group.id).length > 1
  );
  
  if (batchGroups.length > 0) {
    batchGroups.forEach(group => {
      const groupEngines = enabledEngines.filter(engine => engine.groupId === group.id);
      chrome.contextMenus.create({
        id: `batchSearch_${group.id}`,
        parentId: 'customSearch',
        title: `同时搜索${group.name} (${groupEngines.length}个引擎) "%s"`,
        contexts: ['selection']
      });
    });
    
    // 添加分隔符
    chrome.contextMenus.create({
      id: 'separator1',
      parentId: 'customSearch',
      type: 'separator',
      contexts: ['selection']
    });
  }
  
  // 按分组创建菜单
  enabledGroups.forEach(group => {
    const groupEngines = enabledEngines.filter(engine => engine.groupId === group.id);
    if (groupEngines.length === 0) return;
    
    if (enabledGroups.length > 1) {
      // 如果有多个分组，创建分组子菜单
      chrome.contextMenus.create({
        id: `group_${group.id}`,
        parentId: 'customSearch',
        title: group.name,
        contexts: ['selection']
      });
      
      // 为分组内的每个启用的搜索引擎创建子菜单
      groupEngines.forEach(engine => {
        chrome.contextMenus.create({
          id: `search_${engine.id}`,
          parentId: `group_${group.id}`,
          title: `用 ${engine.name} 搜索 "%s"`,
          contexts: ['selection']
        });
      });
    } else {
      // 如果只有一个分组，直接显示搜索引擎
      groupEngines.forEach(engine => {
        chrome.contextMenus.create({
          id: `search_${engine.id}`,
          parentId: 'customSearch',
          title: `用 ${engine.name} 搜索 "%s"`,
          contexts: ['selection']
        });
      });
    }
  });
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText;
  
  if (info.menuItemId.startsWith('batchSearch_')) {
    // 处理分组批量搜索
    const groupId = info.menuItemId.replace('batchSearch_', '');
    await handleGroupBatchSearch(groupId, selectedText);
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

// 处理分组批量搜索
async function handleGroupBatchSearch(groupId, selectedText) {
  // 获取配置
  const result = await chrome.storage.sync.get(['searchEngines']);
  const searchEngines = result.searchEngines || DEFAULT_SEARCH_ENGINES;
  
  // 过滤出指定分组的启用搜索引擎
  const groupEngines = searchEngines.filter(engine => 
    engine.enabled && engine.groupId === groupId
  );
  
  // 依次在新标签页中打开每个搜索结果
  for (let i = 0; i < groupEngines.length; i++) {
    const engine = groupEngines[i];
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
