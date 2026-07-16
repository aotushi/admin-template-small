import type { FormItemRule } from "element-plus";

// 查询表单（AdminSearchForm）与抽屉表单（AdminFormDrawer）共用的字段 schema
export type AdminFormFieldComponent =
  | "date-range"
  | "input"
  | "radio-group"
  | "select"
  | "textarea";

export interface AdminFormFieldOption {
  label: string;
  value: number | string;
}

export interface AdminFormField {
  component: AdminFormFieldComponent;
  /** 初始值；缺省时按组件类型推导（date-range 为 []，其余为 ""） */
  defaultValue?: unknown;
  key: string;
  label: string;
  /** select / radio-group 的选项 */
  options?: AdminFormFieldOption[];
  placeholder?: string;
  /** 透传给底层 Element Plus 控件的额外属性 */
  props?: Record<string, unknown>;
  /** required 快捷校验，自动生成"请输入/请选择 {label}" */
  required?: boolean;
  /** 自定义校验规则，追加在 required 快捷规则之后 */
  rules?: FormItemRule[];
  /** 自定义渲染插槽名，命中后由使用方通过 #field-{slot} 接管控件区域 */
  slot?: string;
  /** 条件显隐：返回 false 时该字段不渲染（值仍保留在 model 中，提交时由使用方筛选） */
  visible?: (model: AdminFormModel) => boolean;
}

export type AdminFormModel = Record<string, unknown>;
