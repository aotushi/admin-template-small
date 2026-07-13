import type { Component } from "vue";

import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import AdminDataTable from "./AdminDataTable.vue";

const AdminTablePanelStub = defineComponent({
  name: "AdminTablePanel",
  setup(_, { slots }) {
    return () =>
      h("section", [
        slots.title?.(),
        slots.selection?.(),
        slots.actions?.(),
        slots.default?.(),
        slots.footer?.(),
      ]);
  },
});

const AdminPaginationStub = defineComponent({
  name: "AdminPagination",
  emits: ["update:currentPage", "update:pageSize"],
  setup() {
    return () => h("nav", { "data-testid": "pagination" });
  },
});

const AdminTableActionButtonStub = defineComponent({
  name: "AdminTableActionButton",
  inheritAttrs: false,
  props: {
    active: Boolean,
    label: { required: true, type: String },
  },
  emits: ["click"],
  setup(props, { emit, slots }) {
    return () =>
      h(
        "button",
        {
          "aria-label": props.label,
          type: "button",
          onClick: (event: MouseEvent) => emit("click", event),
        },
        slots.default?.(),
      );
  },
});

const ElTableStub = defineComponent({
  name: "ElTable",
  inheritAttrs: false,
  props: {
    data: { default: () => [], type: Array },
    size: { default: "default", type: String },
  },
  emits: ["selection-change"],
  setup(props, { attrs, emit, expose, slots }) {
    expose({ clearSelection: () => emit("selection-change", []) });

    return () =>
      h(
        "div",
        {
          ...attrs,
          "data-size": props.size,
        },
        slots.default?.(),
      );
  },
});

const ElTableColumnStub = defineComponent({
  name: "ElTableColumn",
  props: {
    align: String,
    fixed: [Boolean, String],
    headerAlign: String,
    label: String,
    minWidth: [Number, String],
    prop: String,
    showOverflowTooltip: Boolean,
    sortable: [Boolean, String],
    type: String,
    width: [Number, String],
  },
  setup(props, { slots }) {
    return () =>
      h(
        "div",
        {
          "data-label": props.label,
          "data-prop": props.prop,
        },
        slots.default?.({ $index: 0, row: { id: 1, name: "Alice" } }),
      );
  },
});

const ElButtonStub = defineComponent({
  name: "ElButton",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h("button", { ...attrs, type: "button" }, slots.default?.());
  },
});

const stubs = {
  AdminPagination: AdminPaginationStub,
  AdminTableActionButton: AdminTableActionButtonStub,
  AdminTablePanel: AdminTablePanelStub,
  ElButton: ElButtonStub,
  ElTable: ElTableStub,
  ElTableColumn: ElTableColumnStub,
};

function mountTable(
  extraProps: Record<string, unknown> = {},
  slots: Record<string, (props: Record<string, unknown>) => unknown> = {},
) {
  return mount(AdminDataTable as Component, {
    props: {
      columns: [{ field: "name", key: "name", label: "姓名" }],
      currentPage: 1,
      pageSize: 10,
      rows: [{ id: 1, name: "Alice" }],
      title: "用户列表",
      total: 21,
      ...extraProps,
    },
    global: { stubs },
    slots,
  });
}

describe("AdminDataTable", () => {
  it("forwards pagination model updates through its public interface", async () => {
    const onCurrentPage = vi.fn();
    const onPageSize = vi.fn();
    const wrapper = mountTable({
      "onUpdate:currentPage": onCurrentPage,
      "onUpdate:pageSize": onPageSize,
    });
    const pagination = wrapper.findComponent(AdminPaginationStub);

    pagination.vm.$emit("update:currentPage", 2);
    pagination.vm.$emit("update:pageSize", 20);
    await nextTick();

    expect(onCurrentPage).toHaveBeenCalledWith(2);
    expect(onPageSize).toHaveBeenCalledWith(20);
  });

  it("owns standard toolbar events and density state", async () => {
    const wrapper = mountTable({
      searchPanelVisible: true,
      showDensityTool: true,
      showRefreshTool: true,
      showSearchTool: true,
    });

    await wrapper.get('button[aria-label="隐藏查询"]').trigger("click");
    await wrapper.get('button[aria-label="刷新"]').trigger("click");
    await wrapper.get('button[aria-label="表格密度：默认"]').trigger("click");

    expect(wrapper.emitted("toggleSearch")).toHaveLength(1);
    expect(wrapper.emitted("refresh")).toHaveLength(1);
    expect(wrapper.getComponent(ElTableStub).attributes("data-size")).toBe("large");
  });

  it("owns selection state and exposes the generic clear action", async () => {
    const rows = [{ id: 1, name: "Alice" }];
    const wrapper = mountTable({ rows, selectable: true });

    wrapper.getComponent(ElTableStub).vm.$emit("selection-change", rows);
    await nextTick();

    expect(wrapper.text()).toContain("已选择 1 项");
    const clearButton = wrapper.findAll("button").find((button) => button.text() === "清空选择");
    expect(clearButton).toBeDefined();
    await clearButton?.trigger("click");

    expect(wrapper.emitted("selectionChange")).toEqual([[rows], [[]]]);
  });

  it("forwards native table attributes to the inner table", () => {
    const wrapper = mountTable({ "data-testid": "user-grid" });

    expect(wrapper.get('[data-testid="user-grid"]').attributes("data-size")).toBe("default");
  });

  it("renders typed columns, formatters, and named cell slots", () => {
    const wrapper = mountTable(
      {
        columns: [
          { align: "left", field: "name", key: "name", label: "姓名", minWidth: 180 },
          {
            formatter: ({ row }: { row: { name: string } }) => row.name.toUpperCase(),
            key: "formatted",
            label: "格式化姓名",
          },
          { key: "badge", label: "标记", slot: "badge" },
        ],
      },
      {
        "cell-badge": ({ row }) => h("strong", `用户 ${(row as { name: string }).name}`),
      },
    );
    const columns = wrapper.findAllComponents(ElTableColumnStub);

    expect(columns).toHaveLength(3);
    expect(columns[0]?.props()).toMatchObject({ align: "left", label: "姓名", minWidth: 180 });
    expect(wrapper.text()).toContain("Alice");
    expect(wrapper.text()).toContain("ALICE");
    expect(wrapper.text()).toContain("用户 Alice");
  });
});
