<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { Lock, SwitchButton } from "@element-plus/icons-vue";

import type { CurrentUser } from "@/api/types";
import AdminUserAvatar from "@/components/layout/AdminUserAvatar.vue";

const DEFAULT_AVATAR_SRC = "https://unpkg.com/@vbenjs/static-source@0.1.7/source/avatar-v1.webp";

const fallbackEmails: Record<string, string> = {
  admin: "admin@example.com",
  jack: "jack@example.com",
  vben: "ann.vben@gmail.com",
};

const props = defineProps<{
  user: CurrentUser | null;
}>();

const emit = defineEmits<{
  lockScreen: [];
  logout: [];
}>();

const visible = shallowRef(false);
const username = computed(() => props.user?.username || "user");
const displayName = computed(() => capitalize(username.value));
const displayEmail = computed(
  () => props.user?.email || fallbackEmails[username.value] || `${username.value}@admin.local`,
);
const avatarSrc = computed(() => props.user?.avatar || DEFAULT_AVATAR_SRC);
const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase());

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function handleLockScreen() {
  visible.value = false;
  emit("lockScreen");
}

function handleLogout() {
  visible.value = false;
  emit("logout");
}
</script>

<template>
  <ElPopover
    v-model:visible="visible"
    popper-class="admin-user-dropdown-popper"
    placement="bottom-end"
    trigger="click"
    :width="356"
  >
    <template #reference>
      <button class="admin-user-dropdown__trigger" type="button" aria-label="用户菜单">
        <AdminUserAvatar :alt="displayName" :initial="userInitial" :src="avatarSrc" :size="38" />
      </button>
    </template>

    <section class="admin-user-dropdown" aria-label="用户菜单">
      <header class="admin-user-dropdown__profile">
        <AdminUserAvatar :alt="displayName" :initial="userInitial" :src="avatarSrc" :size="64" />
        <div class="admin-user-dropdown__profile-text">
          <h2 class="admin-user-dropdown__name">{{ displayName }}</h2>
          <p class="admin-user-dropdown__email">{{ displayEmail }}</p>
        </div>
      </header>

      <div class="admin-user-dropdown__group">
        <button class="admin-user-dropdown__item" type="button" @click="handleLockScreen">
          <ElIcon class="admin-user-dropdown__icon">
            <Lock />
          </ElIcon>
          <span>锁定屏幕</span>
          <kbd>Alt L</kbd>
        </button>
      </div>

      <div class="admin-user-dropdown__group">
        <button class="admin-user-dropdown__item" type="button" @click="handleLogout">
          <ElIcon class="admin-user-dropdown__icon">
            <SwitchButton />
          </ElIcon>
          <span>退出登录</span>
          <kbd>Alt Q</kbd>
        </button>
      </div>
    </section>
  </ElPopover>
</template>

<style scoped>
.admin-user-dropdown__trigger {
  display: inline-grid;
  width: 44px;
  height: 44px;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 999px;
  padding: 3px;
  place-items: center;
}

.admin-user-dropdown__trigger:hover {
  background: hsl(var(--accent));
}

.admin-user-dropdown {
  overflow: hidden;
  color: hsl(var(--foreground));
}

.admin-user-dropdown__profile {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 116px;
  padding: 18px;
}

.admin-user-dropdown__profile-text {
  min-width: 0;
}

.admin-user-dropdown__name {
  margin: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-user-dropdown__email {
  margin: 4px 0 0;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-user-dropdown__group {
  border-top: 1px solid hsl(var(--border));
  padding: 8px 0;
}

.admin-user-dropdown__item {
  display: grid;
  width: calc(100% - 12px);
  min-height: 56px;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin: 0 6px;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  padding: 0 14px;
  text-align: left;
}

.admin-user-dropdown__item:hover {
  background: hsl(var(--accent));
}

.admin-user-dropdown__icon {
  color: hsl(var(--foreground));
  font-size: 20px;
}

.admin-user-dropdown__item span {
  overflow: hidden;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-user-dropdown__item kbd {
  color: hsl(var(--muted-foreground));
  background: transparent;
  border: 0;
  font-size: 14px;
  line-height: 20px;
}
</style>

<style>
.admin-user-dropdown-popper.el-popper {
  overflow: hidden;
  padding: 0;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  box-shadow: 0 18px 48px hsl(220 25% 15% / 18%);
}

.admin-user-dropdown-popper.el-popper .el-popper__arrow::before {
  background: hsl(var(--card));
  border-color: hsl(var(--border));
}

.dark .admin-user-dropdown-popper.el-popper {
  background: #242424;
  border-color: #383838;
  box-shadow: 0 18px 48px hsl(0 0% 0% / 34%);
}

.dark .admin-user-dropdown-popper.el-popper .el-popper__arrow::before {
  background: #242424;
  border-color: #383838;
}
</style>
