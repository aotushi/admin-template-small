import type { FormItemRule } from "element-plus";

import type { AdminFormField, AdminFormModel } from "./types";

// 这些控件的交互是"选"而不是"输"，required 提示语和触发时机据此区分
const PICK_COMPONENTS = new Set(["date-range", "radio-group", "select"]);

export function getFieldDefaultValue(field: AdminFormField): unknown {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  return field.component === "date-range" ? [] : "";
}

export function buildFormModel(fields: readonly AdminFormField[]): AdminFormModel {
  const model: AdminFormModel = {};

  for (const field of fields) {
    model[field.key] = getFieldDefaultValue(field);
  }

  return model;
}

export function buildFormRules(fields: readonly AdminFormField[]): Record<string, FormItemRule[]> {
  const rules: Record<string, FormItemRule[]> = {};

  for (const field of fields) {
    const fieldRules: FormItemRule[] = [];

    if (field.required) {
      const isPick = PICK_COMPONENTS.has(field.component) || Boolean(field.slot);

      fieldRules.push({
        message: `${isPick ? "请选择" : "请输入"}${field.label}`,
        required: true,
        trigger: isPick ? "change" : "blur",
      });
    }

    if (field.rules) {
      fieldRules.push(...field.rules);
    }

    if (fieldRules.length > 0) {
      rules[field.key] = fieldRules;
    }
  }

  return rules;
}
