<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { ElMessage } from "element-plus";
import { PERMISSION_CODES } from "@admin-backend-3/admin-api-contract/permissions";

import type { AdminRoleItem } from "@/api/modules/roles";
import { getApiErrorMessage } from "@/api/request";
import { useRolesQuery, useUpdateRoleMutation } from "@/queries/roles";

interface RoleDraft {
  data_scope: AdminRoleItem["data_scope"];
  permission_codes: string[];
}

const DATA_SCOPE_OPTIONS = [
  { label: "全部数据", value: "all" },
  { label: "本部门及子部门", value: "dept" },
  { label: "仅本人创建", value: "self" },
] as const;

const rolesQuery = useRolesQuery();
const updateRoleMutation = useUpdateRoleMutation();

const roles = computed(() => rolesQuery.data.value?.roles ?? []);
const permissions = computed(() => rolesQuery.data.value?.permissions ?? []);
const errorMessage = computed(() =>
  rolesQuery.error.value ? getApiErrorMessage(rolesQuery.error.value) : "",
);

// 每个角色一份可编辑草稿；查询数据刷新时整体重建
const drafts = reactive<Record<number, RoleDraft>>({});

watch(
  roles,
  (nextRoles) => {
    for (const role of nextRoles) {
      drafts[role.id] = {
        data_scope: role.data_scope,
        permission_codes: [...role.permission_codes],
      };
    }
  },
  { immediate: true },
);

function isDirty(role: AdminRoleItem) {
  const draft = drafts[role.id];
  if (!draft) {
    return false;
  }

  return (
    draft.data_scope !== role.data_scope ||
    [...draft.permission_codes].sort().join(",") !== [...role.permission_codes].sort().join(",")
  );
}

async function saveRole(role: AdminRoleItem) {
  const draft = drafts[role.id];
  if (!draft) {
    return;
  }

  try {
    await updateRoleMutation.mutateAsync({
      payload: {
        data_scope: draft.data_scope,
        permission_codes: [...draft.permission_codes],
      },
      roleId: role.id,
    });
    ElMessage.success(`角色「${role.name}」已更新，成员下次刷新令牌后生效`);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error));
  }
}
</script>

<template>
  <main class="role-management-page">
    <ElAlert
      v-if="errorMessage"
      :closable="false"
      :description="errorMessage"
      show-icon
      title="角色数据加载失败"
      type="error"
    />

    <ElCard
      v-for="role in roles"
      :key="role.id"
      v-loading="rolesQuery.asyncStatus.value === 'loading'"
      shadow="never"
    >
      <template #header>
        <div class="role-management-page__header">
          <span class="role-management-page__title">
            {{ role.name }}
            <ElTag effect="plain" size="small">{{ role.code }}</ElTag>
            <ElTag effect="light" size="small" type="info">{{ role.user_count }} 名成员</ElTag>
            <ElTag v-if="role.code === 'super'" effect="light" size="small" type="danger">
              内置角色，全量权限不可编辑
            </ElTag>
          </span>
          <span v-permission="PERMISSION_CODES.systemRoleUpdate">
            <ElButton
              v-if="role.code !== 'super'"
              :disabled="!isDirty(role)"
              :loading="updateRoleMutation.asyncStatus.value === 'loading'"
              size="small"
              type="primary"
              @click="saveRole(role)"
            >
              保存
            </ElButton>
          </span>
        </div>
      </template>

      <template v-if="drafts[role.id]">
        <div class="role-management-page__section">
          <span class="role-management-page__label">数据范围</span>
          <ElRadioGroup v-model="drafts[role.id]!.data_scope" :disabled="role.code === 'super'">
            <ElRadio v-for="option in DATA_SCOPE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </ElRadio>
          </ElRadioGroup>
        </div>

        <div class="role-management-page__section">
          <span class="role-management-page__label">权限点</span>
          <ElCheckboxGroup
            v-model="drafts[role.id]!.permission_codes"
            :disabled="role.code === 'super'"
          >
            <ElCheckbox
              v-for="permission in permissions"
              :key="permission.code"
              :value="permission.code"
            >
              {{ permission.name }}
              <span class="role-management-page__code">{{ permission.code }}</span>
            </ElCheckbox>
          </ElCheckboxGroup>
        </div>
      </template>
    </ElCard>
  </main>
</template>

<style scoped>
.role-management-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.role-management-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.role-management-page__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.role-management-page__section {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.role-management-page__section + .role-management-page__section {
  margin-top: 12px;
}

.role-management-page__label {
  min-width: 64px;
  padding-top: 6px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.role-management-page__code {
  margin-left: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
