<script setup lang="ts">
import { computed } from "vue";
import { ArrowUp } from "@element-plus/icons-vue";

import AdminSearchPanel from "@/components/common/form/AdminSearchPanel.vue";
import type { UserCreatedRange, UserFilters, UserStatusFilter } from "@/views/system/users/types";

const props = defineProps<{
  filters: UserFilters;
  loading?: boolean;
}>();

const emit = defineEmits<{
  collapse: [];
  query: [];
  reset: [];
  updateFilters: [filters: Partial<UserFilters>];
}>();

const statusOptions: Array<{ label: string; value: UserStatusFilter }> = [
  { label: "全部状态", value: "all" },
  { label: "启用", value: "enabled" },
  { label: "禁用", value: "disabled" },
];
const visibleStatus = computed(() =>
  props.filters.status === "all" ? undefined : props.filters.status,
);

function updateUsername(username: string) {
  emit("updateFilters", { username });
}

function updateUserId(userId: string) {
  emit("updateFilters", { userId });
}

function updateStatus(status?: UserStatusFilter) {
  emit("updateFilters", { status: status ?? "all" });
}

function updateRemark(remark: string) {
  emit("updateFilters", { remark });
}

function updateCreatedRange(createdRange: null | string[]) {
  emit("updateFilters", {
    createdRange:
      createdRange && createdRange.length === 2
        ? ([createdRange[0], createdRange[1]] as UserCreatedRange)
        : [],
  });
}
</script>

<template>
  <AdminSearchPanel aria-label="用户筛选">
    <ElFormItem label="用户名">
      <ElInput
        clearable
        :disabled="props.loading"
        :model-value="props.filters.username"
        placeholder="请输入"
        @keyup.enter="emit('query')"
        @update:model-value="updateUsername"
      />
    </ElFormItem>

    <ElFormItem label="用户ID">
      <ElInput
        clearable
        :disabled="props.loading"
        :model-value="props.filters.userId"
        placeholder="请输入"
        @keyup.enter="emit('query')"
        @update:model-value="updateUserId"
      />
    </ElFormItem>

    <ElFormItem label="状态">
      <ElSelect
        clearable
        :disabled="props.loading"
        :model-value="visibleStatus"
        placeholder="请选择"
        @update:model-value="updateStatus"
      >
        <ElOption
          v-for="option in statusOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="备注">
      <ElInput
        clearable
        :disabled="props.loading"
        :model-value="props.filters.remark"
        placeholder="请输入"
        @keyup.enter="emit('query')"
        @update:model-value="updateRemark"
      />
    </ElFormItem>

    <ElFormItem class="user-search-panel__date" label="创建时间">
      <ElDatePicker
        :disabled="props.loading"
        end-placeholder="结束日期"
        :model-value="props.filters.createdRange"
        :name="['createdStartDate', 'createdEndDate']"
        range-separator="→"
        start-placeholder="开始日期"
        type="daterange"
        value-format="YYYY-MM-DD"
        @update:model-value="updateCreatedRange"
      />
    </ElFormItem>

    <ElFormItem class="user-search-panel__actions">
      <ElButton :disabled="props.loading" @click="emit('reset')">重 置</ElButton>
      <ElButton :loading="props.loading" type="primary" @click="emit('query')">搜 索</ElButton>
      <ElButton link type="primary" @click="emit('collapse')">
        收起
        <ElIcon class="user-search-panel__collapse-icon">
          <ArrowUp />
        </ElIcon>
      </ElButton>
    </ElFormItem>
  </AdminSearchPanel>
</template>

<style scoped>
.user-search-panel__date :deep(.el-date-editor) {
  width: 100%;
}

.user-search-panel__actions {
  justify-self: end;
}

.user-search-panel__actions :deep(.el-form-item__content) {
  flex-wrap: nowrap;
  justify-content: flex-end;
}

.user-search-panel__collapse-icon {
  margin-left: 2px;
}

@media (max-width: 1180px) {
  .user-search-panel__actions {
    justify-self: start;
  }
}
</style>
