<script setup lang="ts">
import type { AppMenuItem } from "@/router/menu";

import { resolveMenuIcon } from "@/components/layout/menu-icons";

defineOptions({
  name: "AdminMenuItems",
});

defineProps<{
  items: readonly AppMenuItem[];
}>();
</script>

<template>
  <template v-for="item in items" :key="item.path">
    <ElSubMenu v-if="item.children?.length" :index="item.path">
      <template #title>
        <ElIcon class="admin-menu-item__icon">
          <component :is="resolveMenuIcon(item.icon)" />
        </ElIcon>
        <span class="admin-menu-item__title">{{ item.title }}</span>
      </template>

      <AdminMenuItems :items="item.children" />
    </ElSubMenu>

    <ElMenuItem v-else :index="item.path">
      <ElIcon v-if="item.icon" class="admin-menu-item__icon">
        <component :is="resolveMenuIcon(item.icon)" />
      </ElIcon>
      <span v-else class="admin-menu-item__dot" aria-hidden="true" />
      <template #title>
        <span class="admin-menu-item__title">{{ item.title }}</span>
      </template>
    </ElMenuItem>
  </template>
</template>

<style scoped>
.admin-menu-item__icon {
  width: 18px;
  height: 18px;
  margin-right: 10px;
  color: currentcolor;
  font-size: 18px;
}

.admin-menu-item__dot {
  width: 5px;
  height: 5px;
  margin-right: 16px;
  margin-left: 6px;
  background: currentcolor;
  border-radius: 999px;
  opacity: 0.72;
}

.admin-menu-item__title {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
}
</style>
