<script setup lang="ts">
import AppLogo from "@/components/layout/AppLogo.vue";
import AdminMenuItems from "@/components/layout/AdminMenuItems.vue";
import type { AppMenuItem } from "@/router/menu";

type SidebarTheme = "dark" | "light";

const props = withDefaults(
  defineProps<{
    activeMenu: string;
    collapsed: boolean;
    menus: readonly AppMenuItem[];
    theme?: SidebarTheme;
  }>(),
  {
    theme: "light",
  },
);
</script>

<template>
  <aside class="admin-sidebar" :class="[props.theme, { 'is-collapsed': props.collapsed }]">
    <div class="admin-sidebar__body">
      <div class="admin-sidebar__logo">
        <AppLogo
          :collapsed="props.collapsed"
          :size="32"
          text="Admin Backend"
          :theme="props.theme"
        />
      </div>

      <ElScrollbar class="admin-sidebar__scrollbar">
        <ElMenu
          class="admin-sidebar__menu is-vertical is-rounded"
          :class="`is-${props.theme}`"
          :collapse="props.collapsed"
          :collapse-transition="false"
          :default-active="props.activeMenu"
          router
        >
          <AdminMenuItems :items="props.menus" />
        </ElMenu>
      </ElScrollbar>
    </div>
  </aside>
</template>

<style scoped>
.admin-sidebar {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--sidebar-deep));
}

.admin-sidebar__body {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: hsl(var(--sidebar));
  border-right: 1px solid hsl(var(--border));
}

.admin-sidebar__logo {
  display: flex;
  height: 56px;
  align-items: center;
  padding: 0 18px;
  border-bottom: 1px solid hsl(var(--border));
}

.admin-sidebar.is-collapsed .admin-sidebar__logo {
  justify-content: center;
  padding: 0;
}

.admin-sidebar__scrollbar {
  flex: 1;
  min-height: 0;
}

.admin-sidebar__menu {
  --menu-title-width: 140px;
  --menu-item-icon-size: var(--font-size-base, 16px);
  --menu-item-height: 38px;
  --menu-item-padding-y: 21px;
  --menu-item-padding-x: 12px;
  --menu-item-collapse-padding-y: 23.5px;
  --menu-item-collapse-padding-x: 0px;
  --menu-item-margin-y: 2px;
  --menu-item-margin-x: 0px;
  --menu-item-collapse-margin-y: 4px;
  --menu-item-collapse-margin-x: 0px;
  --menu-item-radius: 0px;
  --menu-item-indent: 16px;

  min-height: 100%;
  border-right: 0;
  background: var(--menu-background-color);
  padding: 8px;
  --el-menu-active-color: var(--menu-item-active-color);
  --el-menu-bg-color: var(--menu-background-color);
  --el-menu-hover-bg-color: var(--menu-item-hover-background-color);
  --el-menu-item-height: var(--menu-item-height);
  --el-menu-sub-item-height: var(--menu-item-height);
  --el-menu-text-color: var(--menu-item-color);
}

.admin-sidebar__menu.is-dark {
  --menu-background-color: hsl(var(--menu));
  --menu-item-color: hsl(var(--foreground) / 80%);
  --menu-item-background-color: var(--menu-background-color);
  --menu-item-hover-color: hsl(var(--accent-foreground));
  --menu-item-hover-background-color: hsl(var(--accent));
  --menu-item-active-color: hsl(var(--accent-foreground));
  --menu-item-active-background-color: hsl(var(--accent));
  --menu-submenu-background-color: var(--menu-background-color);
  --menu-submenu-hover-color: hsl(var(--accent-foreground));
  --menu-submenu-hover-background-color: hsl(var(--accent));
  --menu-submenu-active-color: hsl(var(--accent-foreground));
  --menu-submenu-active-background-color: transparent;
}

.admin-sidebar__menu.is-light {
  --menu-background-color: hsl(var(--menu));
  --menu-item-color: hsl(var(--accent-foreground));
  --menu-item-background-color: var(--menu-background-color);
  --menu-item-hover-color: var(--menu-item-color);
  --menu-item-hover-background-color: hsl(var(--accent));
  --menu-item-active-color: hsl(var(--primary));
  --menu-item-active-background-color: hsl(var(--primary) / 15%);
  --menu-submenu-background-color: var(--menu-background-color);
  --menu-submenu-hover-color: hsl(var(--primary));
  --menu-submenu-hover-background-color: hsl(var(--accent));
  --menu-submenu-active-color: hsl(var(--primary));
  --menu-submenu-active-background-color: transparent;
}

.admin-sidebar__menu.is-rounded {
  --menu-item-margin-x: 8px;
  --menu-item-collapse-margin-x: 6px;
  --menu-item-radius: 8px;
}

.admin-sidebar :deep(.el-menu) {
  border-right: 0;
  background: var(--menu-background-color);
}

.admin-sidebar :deep(.el-menu--collapse) {
  width: 48px;
}

.admin-sidebar :deep(.el-menu-item),
.admin-sidebar :deep(.el-sub-menu__title) {
  position: relative;
  height: var(--menu-item-height);
  padding-right: var(--menu-item-padding-x) !important;
  padding-left: calc(var(--menu-item-indent) - 8px) !important;
  margin: 0 var(--menu-item-margin-x) var(--menu-item-margin-y);
  border-radius: var(--menu-item-radius);
  color: var(--menu-item-color);
  background: var(--menu-item-background-color);
  font-size: var(--menu-font-size) !important;
  line-height: var(--menu-item-height);
  transition:
    background 0.15s ease,
    color 0.15s ease,
    padding 0.15s ease,
    border-color 0.15s ease;
}

.admin-sidebar :deep(.el-menu-item:hover),
.admin-sidebar :deep(.el-sub-menu__title:hover) {
  color: var(--menu-item-hover-color);
  background: var(--menu-item-hover-background-color) !important;
}

.admin-sidebar :deep(.el-menu-item.is-active) {
  color: var(--menu-item-active-color);
  background: var(--menu-item-active-background-color) !important;
}

.admin-sidebar :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--menu-submenu-active-color);
  background: var(--menu-submenu-active-background-color);
}

.admin-sidebar :deep(.el-sub-menu .el-menu) {
  padding-left: 0;
  background: var(--menu-submenu-background-color);
}

.admin-sidebar :deep(.el-menu--collapse > .el-menu-item),
.admin-sidebar :deep(.el-menu--collapse > .el-sub-menu > .el-sub-menu__title) {
  justify-content: center;
  padding: var(--menu-item-collapse-padding-y) var(--menu-item-collapse-padding-x) !important;
  margin: var(--menu-item-collapse-margin-y) var(--menu-item-collapse-margin-x);
}
</style>
