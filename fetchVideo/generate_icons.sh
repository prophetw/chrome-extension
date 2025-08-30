#!/bin/bash

# 视频下载助手图标生成脚本
# 需要安装 ImageMagick: sudo apt-get install imagemagick

# 创建一个简单的SVG图标
cat > icons/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2E7D32;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- 背景圆形 -->
  <circle cx="64" cy="64" r="60" fill="url(#gradient)" stroke="#1B5E20" stroke-width="2"/>
  
  <!-- 视频播放图标 -->
  <polygon points="45,40 45,88 85,64" fill="white" stroke="white" stroke-width="2"/>
  
  <!-- 下载箭头 -->
  <g transform="translate(85, 25)">
    <line x1="0" y1="5" x2="0" y2="20" stroke="white" stroke-width="3" stroke-linecap="round"/>
    <polyline points="-5,15 0,20 5,15" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  
  <!-- 装饰性圆点 -->
  <circle cx="25" cy="25" r="4" fill="rgba(255,255,255,0.6)"/>
  <circle cx="103" cy="103" r="4" fill="rgba(255,255,255,0.6)"/>
</svg>
EOF

echo "SVG图标已创建: icons/icon.svg"

# 如果安装了ImageMagick，生成PNG图标
if command -v convert >/dev/null 2>&1; then
    echo "检测到ImageMagick，正在生成PNG图标..."
    
    # 生成不同尺寸的PNG图标
    convert icons/icon.svg -resize 16x16 icons/icon16.png
    convert icons/icon.svg -resize 48x48 icons/icon48.png
    convert icons/icon.svg -resize 128x128 icons/icon128.png
    
    echo "PNG图标已生成:"
    echo "  - icons/icon16.png"
    echo "  - icons/icon48.png"
    echo "  - icons/icon128.png"
else
    echo "未检测到ImageMagick，跳过PNG图标生成"
    echo "如需生成PNG图标，请安装ImageMagick:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  CentOS/RHEL: sudo yum install ImageMagick"
    echo "  macOS: brew install imagemagick"
    echo ""
    echo "或者使用在线转换工具将SVG转换为PNG格式"
fi

echo ""
echo "图标生成完成！"
