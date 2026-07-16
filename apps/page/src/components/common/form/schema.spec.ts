import { describe, expect, it } from "vitest";

import { buildFormModel, buildFormRules, getFieldDefaultValue } from "./schema";
import type { AdminFormField } from "./types";

describe("form schema helpers", () => {
  it("derives default values by component type", () => {
    expect(getFieldDefaultValue({ component: "input", key: "name", label: "名称" })).toBe("");
    expect(getFieldDefaultValue({ component: "textarea", key: "remark", label: "备注" })).toBe("");
    expect(getFieldDefaultValue({ component: "select", key: "status", label: "状态" })).toBe("");
    expect(
      getFieldDefaultValue({ component: "date-range", key: "createdRange", label: "创建时间" }),
    ).toEqual([]);
  });

  it("prefers explicit defaultValue over derived one", () => {
    expect(
      getFieldDefaultValue({
        component: "radio-group",
        defaultValue: 1,
        key: "status",
        label: "状态",
      }),
    ).toBe(1);
  });

  it("builds a model keyed by field key with fresh array defaults", () => {
    const fields: AdminFormField[] = [
      { component: "input", key: "name", label: "名称" },
      { component: "date-range", key: "rangeA", label: "时间A" },
      { component: "date-range", key: "rangeB", label: "时间B" },
    ];

    const model = buildFormModel(fields);

    expect(model).toEqual({ name: "", rangeA: [], rangeB: [] });
    // 两个 date-range 字段不能共享同一个数组实例
    expect(model.rangeA).not.toBe(model.rangeB);
  });

  it("generates required rules with input/pick wording and triggers", () => {
    const fields: AdminFormField[] = [
      { component: "input", key: "name", label: "名称", required: true },
      { component: "select", key: "status", label: "状态", required: true },
      { component: "input", key: "menuIds", label: "菜单权限", required: true, slot: "menus" },
    ];

    const rules = buildFormRules(fields);

    expect(rules.name).toEqual([{ message: "请输入名称", required: true, trigger: "blur" }]);
    expect(rules.status).toEqual([{ message: "请选择状态", required: true, trigger: "change" }]);
    // slot 接管的字段视为"选择"类交互
    expect(rules.menuIds).toEqual([
      { message: "请选择菜单权限", required: true, trigger: "change" },
    ]);
  });

  it("appends custom rules after the required shortcut and skips ruleless fields", () => {
    const fields: AdminFormField[] = [
      {
        component: "input",
        key: "name",
        label: "名称",
        required: true,
        rules: [{ max: 20, message: "最多 20 个字符", min: 2, trigger: "blur" }],
      },
      { component: "input", key: "remark", label: "备注" },
    ];

    const rules = buildFormRules(fields);

    expect(rules.name).toEqual([
      { message: "请输入名称", required: true, trigger: "blur" },
      { max: 20, message: "最多 20 个字符", min: 2, trigger: "blur" },
    ]);
    expect(rules.remark).toBeUndefined();
  });
});
