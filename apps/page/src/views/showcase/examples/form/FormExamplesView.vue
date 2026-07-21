<script setup lang="ts">
import BasicSearchFormExample from "@/views/showcase/examples/form/BasicSearchFormExample.vue";
import FormDrawerExample from "@/views/showcase/examples/form/FormDrawerExample.vue";
import StatusSearchFormExample from "@/views/showcase/examples/form/StatusSearchFormExample.vue";
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
