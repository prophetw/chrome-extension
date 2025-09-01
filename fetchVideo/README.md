# FetchVideo - 网页视频流下载插件

一个用于下载网页视频流的Chrome扩展插件。

## 功能特性

- 🎬 自动检测网页中的视频流
- 📥 支持多种视频格式下载 (MP4, WebM, M3U8等)
- 🔍 智能识别HLS流、DASH流等
- � **显示详细视频信息**：分辨率、文件大小、比特率、时长
- �💾 批量下载支持
- 🎯 右键菜单快速下载
- � 实时下载进度显示
- 🎖️ 智能质量检测和排序

## 安装方法

### 开发者模式安装

1. 打开Chrome浏览器
2. 地址栏输入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目的fetchVideo文件夹

### 商店安装

待发布到Chrome Web Store

## 使用方法

### 基本使用

1. 访问包含视频的网页
2. 插件会自动检测页面中的视频流
3. 点击浏览器工具栏中的插件图标
4. 在弹出窗口中选择要下载的视频
5. 点击下载按钮开始下载

### 右键菜单

1. 在视频元素上右键点击
2. 选择"下载视频"选项
3. 自动开始下载

### 批量下载

1. 打开插件弹窗
2. 勾选多个视频项
3. 点击"批量下载"按钮

## 技术实现

### 核心技术栈

- **Manifest V3**: 最新的Chrome扩展规范
- **Content Script**: 页面内容检测
- **Background Service Worker**: 后台处理
- **Chrome Downloads API**: 文件下载
- **FFmpeg.js**: 视频格式转换（可选）

### 智能检测优先级

#### 1. 流媒体优先检测 (优先级: 100)
```javascript
// 优先检测 HLS 流 (m3u8) - 真正的下载入口
searchScriptsForM3u8();        // script标签中的m3u8链接
searchHTMLForM3u8();          // HTML内容中的m3u8链接
searchAttributesForM3u8();    // 元素属性中的m3u8链接
searchPlayerConfigsForM3u8(); // 播放器配置中的m3u8链接
```

#### 2. DASH流检测 (优先级: 90)
```javascript
// 检测 DASH 流 (mpd)
detectDASHPlayer();
```

#### 3. 网络请求拦截 (优先级: 70-80)
```javascript
// 拦截流媒体网络请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isStreamingRequest(details.url)) {
      storeVideoRequest(details, 'streaming');
    }
  },
  {urls: ["*://*/*.m3u8*", "*://*/*.mpd*"]}
);
```

#### 4. 普通Video元素 (优先级: 30-60)
```javascript
// 最后检测普通video标签的src
const mediaElements = document.querySelectorAll('video, audio');
// 验证是否为真实下载源
const isValid = validateVideoSource(videoUrl);
```

### 视频检测机制

#### 1. DOM元素检测
```javascript
// 检测video和audio标签
const mediaElements = document.querySelectorAll('video, audio');
```

#### 2. 网络请求拦截
```javascript
// 拦截视频相关的网络请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // 检测视频文件请求
  },
  {urls: ["*://*/*.mp4", "*://*/*.webm", "*://*/*.m3u8"]}
);
```

#### 3. HLS/DASH流检测
```javascript
// 检测流媒体播放器
const players = document.querySelectorAll('[data-video-src], [data-hls-url]');
```

### 支持的视频格式

- **直接下载**: MP4, WebM, AVI, MOV
- **流媒体**: HLS (m3u8), DASH (mpd)
- **视频网站**: YouTube, Bilibili, 优酷等（需要特殊处理）

## 项目结构

```
fetchVideo/
├── manifest.json          # 插件配置文件
├── popup.html            # 弹窗界面
├── popup.js              # 弹窗逻辑
├── content.js            # 内容脚本
├── background.js         # 后台脚本
├── options.html          # 设置页面
├── options.js            # 设置逻辑
├── styles/
│   ├── popup.css         # 弹窗样式
│   └── options.css       # 设置页面样式
├── scripts/
│   ├── video-detector.js # 视频检测核心
│   ├── downloader.js     # 下载处理
│   └── utils.js          # 工具函数
└── icons/
    ├── icon16.png        # 16x16图标
    ├── icon48.png        # 48x48图标
    └── icon128.png       # 128x128图标
```

## 开发计划

### Phase 1: 基础功能
- [x] 项目初始化
- [ ] 基础视频检测
- [ ] 简单下载功能
- [ ] 基础UI界面

### Phase 2: 增强功能
- [ ] 流媒体支持
- [ ] 批量下载
- [ ] 下载管理
- [ ] 格式转换

### Phase 3: 高级功能
- [ ] 视频网站适配
- [ ] 自定义下载规则
- [ ] 云端同步设置
- [ ] 插件统计分析

## 注意事项

### 法律合规
- 仅用于个人学习和研究
- 请遵守视频网站的服务条款
- 不得用于商业用途或侵犯版权

### 技术限制
- 某些网站可能有防下载机制
- 加密视频流需要特殊处理
- 大文件下载可能需要分片处理

### 浏览器兼容性
- 主要支持Chrome 88+
- 部分功能需要Edge 88+
- 不支持Firefox（Manifest V3限制）

## 故障排除

### 常见问题

**Q: 检测不到视频**
A: 检查网页是否完全加载，某些动态加载的视频需要等待

**Q: 下载失败**
A: 检查网络连接，某些视频可能有防盗链保护

**Q: 插件无法启动**
A: 检查Chrome版本，确保支持Manifest V3

### 调试方法

1. 打开开发者工具
2. 查看Console标签页的错误信息
3. 检查Network标签页的网络请求
4. 在插件管理页面查看错误日志

## 贡献指南

1. Fork本项目
2. 创建特性分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -am 'Add new feature'`
4. 推送分支: `git push origin feature/new-feature`
5. 创建Pull Request

## 开发环境搭建

```bash
# 克隆项目
git clone https://github.com/your-username/chrome-extension.git
cd chrome-extension/fetchVideo

# 安装依赖（如果需要）
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

## 许可证

MIT License - 详见 [LICENSE](../LICENSE) 文件

## 更新日志

### v0.1.0 (开发中)
- 初始化项目结构
- 基础功能规划
- 图标设计完成

## 联系方式

- 项目主页: https://github.com/your-username/chrome-extension
- 问题反馈: https://github.com/your-username/chrome-extension/issues
- 作者邮箱: your-email@example.com

---

**免责声明**: 本插件仅用于技术学习和个人使用，请遵守相关法律法规和网站服务条款。