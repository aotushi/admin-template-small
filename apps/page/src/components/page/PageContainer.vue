<script setup lang="ts">
defineProps<{
  description?: string;
  eyebrow?: string;
  title: string;
}>();
</script>

<template>
  <main class="page-container">
    <header class="page-container__header">
      <div class="page-container__heading">
        <p v-if="eyebrow" class="page-container__eyebrow">{{ eyebrow }}</p>
        <h1 class="page-container__title">{{ title }}</h1>
        <p v-if="description" class="page-container__description">{{ description }}</p>
      </div>

      <div v-if="$slots.actions" class="page-container__actions">
        <slot name="actions" />
      </div>
    </header>

    <slot />
  </main>
</template>

<style scoped>
.page-container {
  display: flex;
  min-height: calc(100vh - 88px);
  flex-direction: column;
  gap: 16px;
}

.page-container__header {
  display: flex;
  min-height: 64px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-container__heading {
  min-width: 0;
}

.page-container__eyebrow {
  margin: 0 0 4px;
  color: hsl(var(--primary));
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.page-container__title {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 24px;
  font-weight: 650;
  line-height: 32px;
}

.page-container__description {
  max-width: 720px;
  margin: 8px 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  line-height: 22px;
}

.page-container__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

@media (max-width: 720px) {
  .page-container__header {
    flex-direction: column;
  }

  .page-container__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
