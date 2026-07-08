<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";

const props = withDefaults(
  defineProps<{
    alt: string;
    initial: string;
    online?: boolean;
    size?: number;
    src?: string;
  }>(),
  {
    online: true,
    size: 36,
    src: "",
  },
);

const imageFailed = shallowRef(false);
const showImage = computed(() => Boolean(props.src) && !imageFailed.value);

watch(
  () => props.src,
  () => {
    imageFailed.value = false;
  },
);

function handleImageError() {
  imageFailed.value = true;
}
</script>

<template>
  <span class="admin-user-avatar" :style="{ '--admin-user-avatar-size': `${size}px` }">
    <img
      v-if="showImage"
      class="admin-user-avatar__image"
      :src="src"
      :alt="alt"
      @error="handleImageError"
    />
    <span v-else class="admin-user-avatar__fallback">{{ initial }}</span>
    <span v-if="online" class="admin-user-avatar__dot" aria-hidden="true" />
  </span>
</template>

<style scoped>
.admin-user-avatar {
  position: relative;
  display: inline-grid;
  width: var(--admin-user-avatar-size);
  height: var(--admin-user-avatar-size);
  flex: 0 0 var(--admin-user-avatar-size);
  overflow: visible;
  border-radius: 999px;
  place-items: center;
}

.admin-user-avatar__image,
.admin-user-avatar__fallback {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

.admin-user-avatar__image {
  display: block;
  object-fit: cover;
}

.admin-user-avatar__fallback {
  display: grid;
  color: #ffffff;
  background: hsl(var(--primary));
  font-size: calc(var(--admin-user-avatar-size) * 0.36);
  font-weight: 700;
  place-items: center;
}

.admin-user-avatar__dot {
  position: absolute;
  right: 0;
  bottom: 1px;
  width: calc(var(--admin-user-avatar-size) * 0.28);
  height: calc(var(--admin-user-avatar-size) * 0.28);
  min-width: 10px;
  min-height: 10px;
  background: #4ade80;
  border: 2px solid hsl(var(--card));
  border-radius: 999px;
}
</style>
