# Textarea 组件重构 - 移除前端数据存储

## Core Features

- 纯展示组件

- 属性透传

- 样式系统

- 类型安全

- Ref转发

## Tech Stack

{
  "Web": {
    "arch": "react",
    "component": "tdesign"
  }
}

## Design

保持现有 Tailwind CSS 样式系统，确保组件的一致性和可维护性

## Plan

Note: 

- [ ] is holding
- [/] is doing
- [X] is done

---

[X] 审查现有 textarea 组件代码，识别任何潜在的状态管理或数据存储逻辑

[X] 重构组件为完全无状态的纯函数组件，确保所有数据通过 props 传入

[X] 优化 TypeScript 类型定义，确保完整的 HTML textarea 属性支持

[X] 验证组件的 ref 转发功能和样式系统的正确性
