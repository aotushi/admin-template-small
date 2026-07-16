<script setup lang="ts">
import { computed } from "vue";

import type { AdminFormField } from "./types";

const props = defineProps<{
  disabled?: boolean;
  field: AdminFormField;
}>();

const model = defineModel<unknown>();

// 显式 disabled 绑定会覆盖 v-bind 展开的 field.props.disabled，这里合并两个来源：任一为真即禁用
const isDisabled = computed(() => props.disabled || Boolean(props.field.props?.disabled));

const placeholderText = computed(() => {
  if (props.field.placeholder) {
    return props.field.placeholder;
  }

  return props.field.component === "input" || props.field.component === "textarea"
    ? "请输入"
    : "请选择";
});

// model 值类型由 schema 决定，这里按控件需要收敛展示类型
const textValue = computed(() => (model.value as string | undefined) ?? "");
const choiceValue = computed(() => model.value as number | string | undefined);
const rangeValue = computed(() => (model.value as string[] | undefined) ?? []);

function updateValue(value: unknown) {
  model.value = value;
}

function updateRange(value: null | string[]) {
  model.value = value ?? [];
}
</script>

<template>
  <ElInput
    v-if="props.field.component === 'input'"
    v-bind="props.field.props"
    clearable
    :disabled="isDisabled"
    :model-value="textValue"
    :placeholder="placeholderText"
    @update:model-value="updateValue"
  />

  <ElInput
    v-else-if="props.field.component === 'textarea'"
    v-bind="props.field.props"
    :disabled="isDisabled"
    :model-value="textValue"
    :placeholder="placeholderText"
    type="textarea"
    @update:model-value="updateValue"
  />

  <ElSelect
    v-else-if="props.field.component === 'select'"
    v-bind="props.field.props"
    clearable
    :disabled="isDisabled"
    :model-value="choiceValue"
    :placeholder="placeholderText"
    @update:model-value="updateValue"
  >
    <ElOption
      v-for="option in props.field.options"
      :key="option.value"
      :label="option.label"
      :value="option.value"
    />
  </ElSelect>

  <ElRadioGroup
    v-else-if="props.field.component === 'radio-group'"
    v-bind="props.field.props"
    :disabled="isDisabled"
    :model-value="choiceValue"
    @update:model-value="updateValue"
  >
    <ElRadio v-for="option in props.field.options" :key="option.value" :value="option.value">
      {{ option.label }}
    </ElRadio>
  </ElRadioGroup>

  <ElDatePicker
    v-else-if="props.field.component === 'date-range'"
    v-bind="props.field.props"
    :disabled="isDisabled"
    end-placeholder="结束日期"
    :model-value="rangeValue"
    range-separator="→"
    start-placeholder="开始日期"
    type="daterange"
    value-format="YYYY-MM-DD"
    @update:model-value="updateRange"
  />
</template>
