<script setup lang="ts">
import BasicSearchFormExample from "@/views/components/examples/form/BasicSearchFormExample.vue";
import StatusSearchFormExample from "@/views/components/examples/form/StatusSearchFormExample.vue";
</script>

<template>
  <div class="component-example-list">
    <BasicSearchFormExample />
    <StatusSearchFormExample />
  </div>
</template>

<style scoped>
.component-example-list {
  display: grid;
  gap: 16px;
}
</style>
