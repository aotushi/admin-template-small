<script setup lang="ts">
import BasicTreeExample from "@/views/showcase/examples/tree/BasicTreeExample.vue";
import SplitTreeExample from "@/views/showcase/examples/tree/SplitTreeExample.vue";
</script>

<template>
  <div class="component-example-list">
    <BasicTreeExample />
    <SplitTreeExample />
  </div>
</template>

<style scoped>
.component-example-list {
  display: grid;
  gap: 16px;
}
</style>
