# iWish 需求管理系统

一个基于 Next.js 和 Supabase 的可配置 SaaS 需求管理平台，支持动态表单、权限管理和多角色协作。

## 🚀 核心特性

### 🎯 可配置化设计
- **动态表单引擎**：根据不同部门和岗位自定义表单字段
- **权限管理系统**：细粒度的角色权限控制
- **动态导航**：可配置的菜单和路由系统
- **多租户支持**：支持不同组织的独立配置

### 📋 需求管理
- **智能表单**：基于岗位的动态字段显示
- **工作流管理**：可配置的需求处理流程
- **实时协作**：评论、状态更新、通知系统
- **数据统计**：多维度的需求分析和报表

### 👥 用户管理
- **三级权限**：超级管理员、管理员、员工
- **部门岗位**：灵活的组织架构管理
- **角色分配**：基于角色的权限控制(RBAC)
- **用户画像**：完整的用户信息管理

## 🛠 技术栈

- **前端框架**：Next.js 14 + TypeScript
- **UI 组件**：Tailwind CSS + Radix UI
- **后端服务**：Supabase (PostgreSQL + Auth + Storage)
- **状态管理**：React Hooks + Context
- **表单处理**：自研动态表单引擎
- **权限控制**：RBAC + ABAC 混合模式

## 📦 项目结构

```
iwish-requirement/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── dashboard/          # 仪表板页面
│   │   ├── login/              # 登录页面
│   │   └── layout.tsx          # 根布局
│   ├── components/             # React 组件
│   │   ├── ui/                 # 基础 UI 组件
│   │   └── DynamicForm.tsx     # 动态表单组件
│   ├── services/               # 业务逻辑层
│   │   ├── auth.ts             # 认证服务
│   │   ├── user.ts             # 用户管理
│   │   ├── requirement.ts      # 需求管理
│   │   ├── form.ts             # 表单配置
│   │   └── permission.ts       # 权限管理
│   ├── types/                  # TypeScript 类型定义
│   └── lib/                    # 工具函数
├── supabase/
│   └── migrations/             # 数据库迁移文件
└── docs/                       # 项目文档
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone <your-repo-url>
cd iwish-requirement

# 安装依赖
npm install
```

### 2. 配置 Supabase

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 复制项目 URL 和 anon key
3. 更新 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. 数据库初始化

```bash
# 应用数据库迁移
npx supabase db push

# 或者手动执行 SQL 文件
# 在 Supabase Dashboard 的 SQL Editor 中执行：
# - supabase/migrations/001_initial_schema.sql
# - supabase/migrations/002_initial_data.sql
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 5. 默认登录信息

- **邮箱**：lin88@iwishweb.com
- **密码**：123456
- **角色**：超级管理员

## 📚 功能模块

### 🔐 认证与权限

#### 用户角色
- **超级管理员**：系统完全控制权，包括权限配置
- **管理员**：业务管理权限，不包括用户角色管理
- **员工**：基础使用权限，只能管理自己的需求

#### 权限控制
- 页面级权限控制
- 功能级权限控制
- 数据级权限控制（部门、个人）
- 字段级权限控制

### 📝 动态表单系统

#### 表单配置
- 17+ 字段类型支持
- 条件显示逻辑
- 字段验证规则
- 表单模板管理

#### 字段类型
- 文本输入（单行、多行）
- 数字输入
- 日期时间选择
- 下拉选择、单选、多选
- 文件上传
- 富文本编辑器

### 📊 需求管理

#### 需求流程
1. **创建需求**：根据岗位显示对应表单
2. **分配处理**：自动或手动分配给相应人员
3. **进度跟踪**：实时更新需求状态
4. **完成验收**：需求完成后的验收流程

#### 状态管理
- 待处理 (pending)
- 进行中 (in_progress)
- 已完成 (completed)
- 已取消 (cancelled)

### 📈 数据统计

- 需求数量统计
- 处理时间分析
- 部门工作量分析
- 用户活跃度统计
- 表单使用情况

## 🔧 配置说明

### 表单配置

在 `/dashboard/forms` 中可以配置不同岗位的表单字段：

```typescript
// 示例：设计师表单配置
{
  "name": "创意设计需求",
  "department": "创意部",
  "position": "设计师",
  "fields": [
    {
      "name": "design_type",
      "label": "设计类型",
      "type": "select",
      "options": ["海报", "Logo", "宣传册", "网页设计"],
      "required": true
    },
    {
      "name": "dimensions",
      "label": "设计尺寸",
      "type": "text",
      "placeholder": "如：1920x1080px",
      "required": true
    }
  ]
}
```

### 权限配置

在 `/dashboard/roles` 中可以配置角色权限：

```typescript
// 示例：管理员角色权限
{
  "name": "管理员",
  "permissions": [
    "requirement.create",
    "requirement.read",
    "requirement.update",
    "requirement.delete",
    "user.read",
    "form.manage"
  ]
}
```

## 🚀 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署完成

### 自定义部署

```bash
# 构建项目
npm run build

# 启动生产服务器
npm start
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如有问题或建议，请：

1. 查看 [文档](./docs/)
2. 提交 [Issue](../../issues)
3. 联系开发团队

---

**iWish 需求管理系统** - 让需求管理更简单、更高效！