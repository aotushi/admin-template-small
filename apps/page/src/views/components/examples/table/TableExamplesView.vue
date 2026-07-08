<script setup lang="ts">
import BasicTableExample from "@/views/components/examples/table/BasicTableExample.vue";
import SearchTableExample from "@/views/components/examples/table/SearchTableExample.vue";
</script>

<template>
  <div class="component-example-list">
    <BasicTableExample />
    <SearchTableExample />
  </div>
</template>

<style scoped>
.component-example-list {
  display: grid;
  gap: 16px;
}
</style>
