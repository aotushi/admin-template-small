<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { useMediaQuery } from "@vueuse/core";

import AdminSidebar from "@/components/layout/AdminSidebar.vue";
import AdminTopbar from "@/components/layout/AdminTopbar.vue";
import { useAppTheme } from "@/composables/useAppTheme";
import { createMenuItems } from "@/router/menu";
import { appRoutes } from "@/router/routes";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const sidebarCollapsed = shallowRef(false);
const isNarrowScreen = useMediaQuery("(max-width: 860px)");
const { isDark, sidebarTheme, theme, toggleTheme } = useAppTheme();

const menus = computed(() => createMenuItems(appRoutes, authStore.currentUser));
const activeMenu = computed(() => String(route.meta.activeMenu ?? route.path));
const effectiveSidebarCollapsed = computed(() => sidebarCollapsed.value || isNarrowScreen.value);

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

async function handleLogout() {
  authStore.clearSession();
  await router.replace("/login");
}
</script>

<template>
  <div
    class="admin-layout"
    :class="{ 'admin-layout--dark': isDark, 'is-collapsed': effectiveSidebarCollapsed }"
  >
    <AdminSidebar
      class="admin-layout__sidebar"
      :active-menu="activeMenu"
      :collapsed="effectiveSidebarCollapsed"
      :menus="menus"
      :theme="sidebarTheme"
    />

    <AdminTopbar
      class="admin-layout__header"
      :collapsed="effectiveSidebarCollapsed"
      :theme="theme"
      :user="authStore.currentUser"
      @logout="handleLogout"
      @toggle-sidebar="toggleSidebar"
      @toggle-theme="toggleTheme"
    />

    <main class="admin-layout__content">
      <RouterView v-slot="{ Component }">
        <Transition mode="out-in" name="admin-route-fade">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  --admin-header-height: 56px;
  --admin-sidebar-width: 232px;

  display: grid;
  height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  color: hsl(var(--foreground));
  background: hsl(var(--background-deep));
  grid-template-areas:
    "sidebar header"
    "sidebar content";
  grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);
  grid-template-rows: var(--admin-header-height) minmax(0, 1fr);
  transition: grid-template-columns 0.18s ease;
}

.admin-layout.is-collapsed {
  --admin-sidebar-width: 64px;
}

.admin-layout__sidebar {
  grid-area: sidebar;
  min-width: 0;
  min-height: 0;
}

.admin-layout__header {
  grid-area: header;
  min-width: 0;
}

.admin-layout__content {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  grid-area: content;
}

.admin-route-fade-enter-active,
.admin-route-fade-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.admin-route-fade-enter-from,
.admin-route-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (max-width: 860px) {
  .admin-layout {
    --admin-sidebar-width: 64px;
  }
}

@media (max-width: 640px) {
  .admin-layout__content {
    padding: 12px;
  }
}
</style>
