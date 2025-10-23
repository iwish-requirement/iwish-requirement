import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Textarea 组件属性接口
 * 
 * 继承所有标准 HTML textarea 元素的属性，包括但不限于：
 * - value: 文本域的值（受控组件）
 * - defaultValue: 文本域的默认值（非受控组件）
 * - placeholder: 占位符文本
 * - disabled: 是否禁用
 * - readOnly: 是否只读
 * - required: 是否必填
 * - rows: 显示行数
 * - cols: 显示列数
 * - maxLength: 最大字符长度
 * - minLength: 最小字符长度
 * - wrap: 文本换行方式
 * - autoComplete: 自动完成
 * - autoFocus: 自动聚焦
 * - form: 关联的表单ID
 * - name: 表单字段名称
 * - onChange: 值变化回调
 * - onFocus: 获得焦点回调
 * - onBlur: 失去焦点回调
 * - onKeyDown: 键盘按下回调
 * - onKeyUp: 键盘抬起回调
 * - className: 自定义样式类名
 * - style: 内联样式
 * - id: 元素ID
 * - title: 提示文本
 * - tabIndex: Tab键顺序
 * - aria-*: 无障碍属性
 * - data-*: 自定义数据属性
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * 自定义样式类名
   * 会与默认样式类名合并
   */
  className?: string;
}

/**
 * 纯展示 Textarea 组件
 * 
 * 特性：
 * - 完全无状态，所有数据通过 props 传入
 * - 支持 ref 转发，便于父组件直接访问 DOM 元素
 * - 完整支持所有 HTML textarea 原生属性
 * - 使用 Tailwind CSS 进行样式管理
 * - 不包含任何前端数据存储逻辑
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // 基础布局和尺寸
          "flex min-h-[80px] w-full",
          // 边框和圆角
          "rounded-md border border-input",
          // 背景和内边距
          "bg-background px-3 py-2",
          // 文字样式
          "text-sm placeholder:text-muted-foreground",
          // 焦点状态
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // 禁用状态
          "disabled:cursor-not-allowed disabled:opacity-50",
          // 环形偏移
          "ring-offset-background",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Textarea.displayName = "Textarea"

export { Textarea }