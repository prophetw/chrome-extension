# Chrome自定义搜索扩展

这是一个Chrome浏览器扩展，允许用户在右键菜单中添加自定义搜索功能，支持单个搜索和批量搜索。

## 功能特性

1. **右键菜单搜索**：选中文字后右键，可以看到"自定义搜索"菜单
2. **多搜索引擎支持**：预置Google、豆瓣、IMDB、Bing等搜索引擎
3. **批量搜索功能**：可以同时在多个搜索引擎中搜索，一次性打开多个搜索结果标签页
4. **自定义搜索引擎**：可以添加任意的搜索引擎
5. **灵活配置**：可以启用/禁用不同的搜索引擎
6. **批量搜索配置**：可以选择哪些搜索引擎参与批量搜索
7. **搜索引擎管理**：可以删除自定义添加的搜索引擎

## 安装方法

1. 打开Chrome浏览器
2. 进入扩展程序页面 (chrome://extensions/)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目文件夹

## 生成图标

项目中包含了SVG格式的图标文件，需要转换为PNG格式：

```bash
# 使用ImageMagick转换（需要先安装）
sudo apt-get install imagemagick

# 生成不同尺寸的图标
convert icons/icon.svg -resize 16x16 icons/icon16.png
convert icons/icon.svg -resize 48x48 icons/icon48.png
convert icons/icon.svg -resize 128x128 icons/icon128.png
```

或者使用在线SVG转PNG工具转换图标。

## 使用方法

### 1. 配置搜索引擎

- 点击浏览器工具栏中的扩展图标
- 在弹出窗口中管理搜索引擎
- 可以启用/禁用预置搜索引擎
- 可以添加自定义搜索引擎

### 2. 配置批量搜索

- 在扩展弹出窗口的"批量搜索设置"部分
- 选择想要参与批量搜索的搜索引擎（需要至少选择2个）
- 可以使用"全选"或"清空"按钮快速操作

### 3. 使用单个搜索

- 在任意网页中选中文字
- 右键点击选中的文字
- 选择"自定义搜索"菜单
- 选择想要使用的单个搜索引擎

### 4. 使用批量搜索

- 在任意网页中选中文字
- 右键点击选中的文字
- 选择"自定义搜索"菜单
- 选择"同时搜索"选项（仅当配置了多个批量搜索引擎时显示）
- 系统会依次在新标签页中打开每个搜索引擎的搜索结果

## 添加自定义搜索引擎

在添加搜索引擎时，URL中需要使用 `%s` 作为搜索词的占位符。

### 常用搜索引擎URL示例：

- **Wikipedia**: https://zh.wikipedia.org/wiki/%s
- **GitHub**: https://github.com/search?q=%s
- **Stack Overflow**: https://stackoverflow.com/search?q=%s
- **淘宝**: https://s.taobao.com/search?q=%s
- **YouTube**: https://www.youtube.com/results?search_query=%s
- **知乎**: https://www.zhihu.com/search?q=%s

## 文件结构

```
chrome-extension/
├── manifest.json          # 扩展清单文件
├── background.js          # 后台脚本，处理右键菜单和搜索逻辑
├── popup.html            # 扩展设置页面
├── popup.js              # 设置页面交互逻辑
├── icons/                # 图标文件夹
│   ├── icon.svg          # SVG源图标
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
