#!/bin/bash

# 创建基本的PNG图标文件的脚本
# 如果系统没有图像处理工具，可以使用在线工具转换SVG到PNG

echo "生成Chrome扩展图标..."

# 检查是否有ImageMagick
if command -v convert &> /dev/null; then
    echo "发现ImageMagick，正在生成PNG图标..."
    convert icons/icon.svg -resize 16x16 icons/icon16.png
    convert icons/icon.svg -resize 48x48 icons/icon48.png
    convert icons/icon.svg -resize 128x128 icons/icon128.png
    echo "图标生成完成！"
elif command -v inkscape &> /dev/null; then
    echo "发现Inkscape，正在生成PNG图标..."
    inkscape icons/icon.svg -w 16 -h 16 -o icons/icon16.png
    inkscape icons/icon.svg -w 48 -h 48 -o icons/icon48.png
    inkscape icons/icon.svg -w 128 -h 128 -o icons/icon128.png
    echo "图标生成完成！"
else
    echo "未找到图像处理工具。"
    echo "请安装ImageMagick或Inkscape，或者使用在线工具转换icons/icon.svg到PNG格式。"
    echo ""
    echo "安装ImageMagick："
    echo "sudo apt-get install imagemagick"
    echo ""
    echo "或者访问在线转换工具："
    echo "https://convertio.co/svg-png/"
    echo ""
    echo "需要生成以下尺寸的图标："
    echo "- icon16.png (16x16)"
    echo "- icon48.png (48x48)" 
    echo "- icon128.png (128x128)"
fi
