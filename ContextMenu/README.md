# Chrome自定义搜索扩展 (支持分组功能)

这是一个Chrome浏览器扩展，允许用户在右键菜单中添加自定义搜索功能，支持搜索引擎分组管理、单个搜索和批量搜索。

## 🎯 功能特性

1. **🗂️ 搜索引擎分组**：将搜索引擎按用途分组（如影视搜索、股票查询、通用搜索）
2. **📋 右键菜单搜索**：选中文字后右键，可以看到按分组组织的"自定义搜索"菜单
3. **🔍 多搜索引擎支持**：预置Google、豆瓣电影、IMDb、东方财富股票等搜索引擎
4. **⚡ 批量搜索功能**：可以同时在多个搜索引擎中搜索，一次性打开多个搜索结果标签页
5. **➕ 自定义搜索引擎**：可以添加任意的搜索引擎到指定分组
6. **🎛️ 灵活配置**：可以启用/禁用不同的分组和搜索引擎
7. **📊 分组管理**：可以创建、删除、管理自定义分组
8. **🔧 引擎管理**：可以删除自定义添加的搜索引擎，修改引擎分组

## 📦 预设分组和搜索引擎

### 🔍 通用搜索
- Google搜索
- Bing搜索

### 🎬 影视搜索  
- 豆瓣电影
- IMDb

### 📈 股票查询
- 东方财富股票

## 🚀 安装方法

1. 打开Chrome浏览器
2. 进入扩展程序页面 (chrome://extensions/)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目文件夹

## 🎨 生成图标

项目中包含了SVG格式的图标文件，需要转换为PNG格式：

```bash
# 使用ImageMagick转换（需要先安装）
sudo apt-get install imagemagick

# 运行生成脚本
./generate_icons.sh
```

或者手动生成：

```bash
# 生成不同尺寸的图标
convert icons/icon.svg -resize 16x16 icons/icon16.png
convert icons/icon.svg -resize 48x48 icons/icon48.png
convert icons/icon.svg -resize 128x128 icons/icon128.png
```

## 📖 使用方法

### 1. 管理搜索分组

- 点击浏览器工具栏中的扩展图标
- 在"搜索分组管理"部分添加新分组（如：学术搜索、购物比价等）
- 启用/禁用不同分组
- 删除不需要的自定义分组

### 2. 配置搜索引擎

- 在扩展弹出窗口中管理搜索引擎
- 可以启用/禁用预置搜索引擎
- 可以添加自定义搜索引擎到指定分组
- 可以修改现有搜索引擎的分组归属

### 3. 配置批量搜索

- 在扩展弹出窗口的"批量搜索设置"部分
- 选择想要参与批量搜索的搜索引擎（需要至少选择2个）
- 可以使用"全选"或"清空"按钮快速操作

### 4. 使用右键搜索

#### 单个搜索引擎搜索：
- 在任意网页中选中文字
- 右键点击选中的文字
- 选择"自定义搜索"菜单
- 根据分组选择想要使用的搜索引擎

#### 批量搜索：
- 在任意网页中选中文字
- 右键点击选中的文字
- 选择"自定义搜索"菜单
- 选择"同时搜索"选项（仅当配置了多个批量搜索引擎时显示）
- 系统会依次在新标签页中打开每个搜索引擎的搜索结果

## 📝 添加自定义搜索引擎

在添加搜索引擎时，URL中需要使用 `%s` 作为搜索词的占位符。

### 🔗 常用搜索引擎URL示例：

#### 学术研究分组
- **Wikipedia**: `https://zh.wikipedia.org/wiki/%s`
- **Google Scholar**: `https://scholar.google.com/scholar?q=%s`
- **百度学术**: `https://xueshu.baidu.com/s?wd=%s`

#### 技术开发分组
- **GitHub**: `https://github.com/search?q=%s`
- **Stack Overflow**: `https://stackoverflow.com/search?q=%s`
- **MDN**: `https://developer.mozilla.org/en-US/search?q=%s`

#### 购物比价分组
- **淘宝**: `https://s.taobao.com/search?q=%s`
- **京东**: `https://search.jd.com/Search?keyword=%s`
- **天猫**: `https://list.tmall.com/search_product.htm?q=%s`

#### 社交媒体分组
- **YouTube**: `https://www.youtube.com/results?search_query=%s`
- **知乎**: `https://www.zhihu.com/search?q=%s`
- **微博**: `https://s.weibo.com/weibo?q=%s`

## 🧪 测试功能

项目包含测试页面 `test_groups.html`，提供了不同分组的测试用例：
- 影视搜索测试（电影名称）
- 股票查询测试（股票代码和公司名）
- 通用搜索测试（一般搜索词）

## 📁 文件结构

```
ContextMenu/
├── manifest.json          # 扩展清单文件
├── background.js          # 后台脚本，处理右键菜单和搜索逻辑
├── popup.html            # 扩展设置页面
├── popup.js              # 设置页面交互逻辑
├── test_groups.html      # 分组功能测试页面
├── GROUP_GUIDE.md        # 详细使用指南
├── README.md             # 项目说明文档
├── INSTALL.md            # 安装说明
├── generate_icons.sh     # 图标生成脚本
└── icons/                # 图标文件夹
    ├── icon.svg          # SVG源图标
    ├── icon16.png        # 16x16 PNG图标
    ├── icon48.png        # 48x48 PNG图标
    └── icon128.png       # 128x128 PNG图标
```

## 🔧 技术实现

- **Manifest V3**: 使用最新的Chrome扩展API
- **Service Worker**: 使用service worker处理后台逻辑
- **Chrome Storage API**: 使用同步存储保存用户配置
- **Context Menus API**: 创建和管理右键菜单
- **Tabs API**: 管理标签页的创建和导航

## 📊 版本历史

### v1.1.0 - 分组功能 🆕
- ✅ 新增搜索引擎分组功能
- ✅ 支持自定义分组管理  
- ✅ 右键菜单按分组显示
- ✅ 预设影视、股票等专业分组
- ✅ 改进UI和用户体验
- ✅ 添加详细使用指南和测试页面

### v1.0.0 - 基础功能
- ✅ 右键菜单搜索
- ✅ 自定义搜索引擎
- ✅ 批量搜索功能
- ✅ 搜索引擎管理

## 🤝 贡献

欢迎提交问题报告和功能请求！如果您想要贡献代码，请：

1. Fork 这个项目
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

这个项目基于 MIT 许可证。查看 `LICENSE` 文件了解更多信息。

## 🐛 问题反馈

如果您遇到任何问题或有功能建议，请：
- 查看 `GROUP_GUIDE.md` 获取详细使用说明
- 使用 `test_groups.html` 测试功能是否正常
- 在GitHub上提交Issue
│   ├── icon16.png        # 16x16 图标
│   ├── icon48.png        # 48x48 图标
│   └── icon128.png       # 128x128 图标
└── README.md            # 说明文档
```

## 技术实现

- **Manifest V3**: 使用最新的Chrome扩展API
- **Context Menus API**: 实现右键菜单功能
- **Storage API**: 保存用户配置
- **Tabs API**: 在新标签页中打开搜索结果

## 注意事项

- 扩展使用Chrome Storage Sync API保存配置，配置会在不同设备间同步
- 默认搜索引擎（Google、百度、Bing）无法删除，只能启用/禁用
- 自定义添加的搜索引擎可以删除
- 搜索URL必须包含 `%s` 占位符
