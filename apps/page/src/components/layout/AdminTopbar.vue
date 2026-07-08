<script setup lang="ts">
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import { Expand, Fold, Moon, Refresh, Sunny } from "@element-plus/icons-vue";

import type { CurrentUser } from "@/api/types";
import AdminBreadcrumb from "@/components/layout/AdminBreadcrumb.vue";
import AdminNotifications from "@/components/layout/AdminNotifications.vue";
import AdminUserDropdown from "@/components/layout/AdminUserDropdown.vue";
import type { AppTheme } from "@/composables/useAppTheme";

const props = defineProps<{
  collapsed: boolean;
  theme: AppTheme;
  user: CurrentUser | null;
}>();

const emit = defineEmits<{
  logout: [];
  toggleSidebar: [];
  toggleTheme: [];
}>();

const router = useRouter();

function handleLockScreen() {
  ElMessage.info("锁定屏幕功能将在后续偏好设置阶段接入");
}

function refreshCurrentRoute() {
  router.go(0);
}
</script>

<template>
  <header class="admin-topbar">
    <div class="admin-topbar__left">
      <ElTooltip :content="collapsed ? '展开菜单' : '收起菜单'" placement="bottom">
        <button
          class="admin-topbar__icon-button"
          type="button"
          :aria-label="collapsed ? '展开菜单' : '收起菜单'"
          @click="emit('toggleSidebar')"
        >
          <ElIcon>
            <Expand v-if="collapsed" />
            <Fold v-else />
          </ElIcon>
        </button>
      </ElTooltip>

      <ElTooltip content="刷新页面" placement="bottom">
        <button
          class="admin-topbar__icon-button"
          type="button"
          aria-label="刷新页面"
          @click="refreshCurrentRoute"
        >
          <ElIcon>
            <Refresh />
          </ElIcon>
        </button>
      </ElTooltip>

      <div class="admin-topbar__title-block">
        <AdminBreadcrumb />
      </div>
    </div>

    <div class="admin-topbar__actions">
      <AdminNotifications />

      <ElTooltip :content="theme === 'dark' ? '切换亮色主题' : '切换暗色主题'" placement="bottom">
        <button
          class="admin-topbar__icon-button"
          type="button"
          :aria-label="theme === 'dark' ? '切换亮色主题' : '切换暗色主题'"
          @click="emit('toggleTheme')"
        >
          <ElIcon>
            <Sunny v-if="theme === 'dark'" />
            <Moon v-else />
          </ElIcon>
        </button>
      </ElTooltip>

      <AdminUserDropdown :user="user" @lock-screen="handleLockScreen" @logout="emit('logout')" />
    </div>
  </header>
</template>

<style scoped>
.admin-topbar {
  display: flex;
  height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
  padding: 0 18px;
}

.admin-topbar__left,
.admin-topbar__actions {
  display: flex;
  align-items: center;
}

.admin-topbar__left {
  min-width: 0;
  gap: 12px;
}

.admin-topbar__actions {
  gap: 8px;
}

.admin-topbar__icon-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  place-items: center;
}

.admin-topbar__icon-button:hover {
  background: hsl(var(--accent));
}

.admin-topbar__icon-button .el-icon {
  font-size: 18px;
}

.admin-topbar__title-block {
  min-width: 0;
}

@media (max-width: 640px) {
  .admin-topbar {
    padding: 0 12px;
  }

  .admin-topbar__title-block {
    display: none;
  }

  .admin-topbar__actions {
    gap: 4px;
  }
}
</style>
