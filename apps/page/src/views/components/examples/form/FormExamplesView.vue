<script setup lang="ts">
import BasicSearchFormExample from "@/views/components/examples/form/BasicSearchFormExample.vue";
import FormDrawerExample from "@/views/components/examples/form/FormDrawerExample.vue";
import StatusSearchFormExample from "@/views/components/examples/form/StatusSearchFormExample.vue";
</script>

<template>
  <div class="component-example-list">
    <BasicSearchFormExample />
    <StatusSearchFormExample />
    <FormDrawerExample />
  </div>
</template>

<style scoped>
.component-example-list {
  display: grid;
  gap: 16px;
}
</style>
