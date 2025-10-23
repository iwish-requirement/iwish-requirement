# 静态资源文件夹

## 图片资源放置说明

### Logo 和图标文件放置位置：

```
public/
├── logo.png          # 主 Logo（建议 200x60px）
├── logo-dark.png     # 深色主题 Logo
├── favicon.ico       # 网站图标（16x16, 32x32, 48x48px）
├── icon-192.png      # PWA 图标 192x192px
├── icon-512.png      # PWA 图标 512x512px
└── images/
    ├── avatars/      # 用户头像
    ├── uploads/      # 上传文件
    └── icons/        # 其他图标
```

### 在代码中使用：

```jsx
// 在 React 组件中使用
<img src="/logo.png" alt="IWISH需求管理系统" />

// 或使用 Next.js Image 组件（推荐）
import Image from 'next/image'
<Image src="/logo.png" alt="IWISH需求管理系统" width={200} height={60} />
```

### 推荐的图片规格：

- **主 Logo**: 200x60px 或 300x90px（PNG 格式，透明背景）
- **Favicon**: 32x32px（ICO 格式）
- **移动端图标**: 192x192px, 512x512px（PNG 格式）

### 文件命名建议：

- 使用小写字母和连字符
- 避免中文文件名
- 例如：`iwish-logo.png`, `favicon.ico`