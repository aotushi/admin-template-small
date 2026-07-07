<script setup lang="ts">
const logoSrc = "/favicon.ico";

withDefaults(
  defineProps<{
    collapsed?: boolean;
    size?: number;
    text?: string;
    theme?: "dark" | "light";
  }>(),
  {
    collapsed: false,
    size: 32,
    text: "Admin Backend",
    theme: "light",
  },
);
</script>

<template>
  <div
    class="app-logo"
    :class="[`app-logo--${theme}`, { 'app-logo--collapsed': collapsed }]"
    :style="{ '--app-logo-size': `${size}px` }"
  >
    <img class="app-logo__mark" :src="logoSrc" :alt="text" />
    <span v-if="!collapsed" class="app-logo__text">{{ text }}</span>
  </div>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  height: 100%;
  gap: 8px;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
  white-space: nowrap;
}

.app-logo--dark {
  color: #ffffff;
}

.app-logo--collapsed {
  justify-content: center;
}

.app-logo__mark {
  width: var(--app-logo-size);
  height: var(--app-logo-size);
  flex: 0 0 var(--app-logo-size);
  object-fit: contain;
}

.app-logo__text {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
