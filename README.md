# 公司内部需求管理系统

基于 Next.js、Supabase 和 Cloudflare Pages 的内部需求协作平台，覆盖需求提交、分配、排期、状态流转、评分、统计和审计。

## 本地运行

前置条件：Node.js，以及项目所需的 Supabase、鉴权和第三方集成环境变量。

```bash
npm install
npm run dev
```

提交前验证：

```bash
node --test tests/*.test.mjs
npm run build
```

## 项目文档

- [最终产品需求文档](./PRD-final.md)
- [产品优化需求文档](./PRD-optimization-v2.md)
- [统计口径与内部排期说明](./STATISTICS-METHODOLOGY.md)
- [产品更新日志](./PRODUCT-CHANGELOG.md)
- [开发路线图](./DEVELOPMENT-ROADMAP.md)
- [前端响应式规范](./FRONTEND-RESPONSIVE-GUIDELINES.md)
- [创意部动态字段方案](./PRD-creative-dynamic-fields-v3.md)

生产环境由 Cloudflare Pages 承载，Supabase 提供数据库与认证服务。
