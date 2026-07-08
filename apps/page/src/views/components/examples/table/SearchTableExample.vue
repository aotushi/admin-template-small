<script setup lang="ts">
import { computed, reactive, shallowRef } from "vue";
import { Grid, Refresh, Search } from "@element-plus/icons-vue";

import AdminSearchPanel from "@/components/common/form/AdminSearchPanel.vue";
import AdminPagination from "@/components/common/table/AdminPagination.vue";
import AdminTableActionButton from "@/components/common/table/AdminTableActionButton.vue";
import AdminTablePanel from "@/components/common/table/AdminTablePanel.vue";
import CommonExampleCard from "@/views/components/examples/CommonExampleCard.vue";

interface TableRow {
  component: string;
  scene: string;
  status: "draft" | "ready";
  type: string;
}

const currentPage = shallowRef(1);
const pageSize = shallowRef(10);

const filters = reactive({
  keyword: "",
  status: "",
});

const rows: TableRow[] = [
  {
    component: "AdminSearchPanel",
    scene: "用户管理 / 筛选区",
    status: "ready",
    type: "查询表单",
  },
  {
    component: "AdminTablePanel",
    scene: "用户管理 / 列表区",
    status: "ready",
    type: "表格容器",
  },
  {
    component: "AdminPagination",
    scene: "用户管理 / 列表区",
    status: "ready",
    type: "分页",
  },
  {
    component: "ColumnSetting",
    scene: "后续表格增强",
    status: "draft",
    type: "列配置",
  },
];

const visibleRows = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase();

  return rows.filter((row) => {
    const keywordMatched =
      !keyword ||
      row.component.toLowerCase().includes(keyword) ||
      row.scene.toLowerCase().includes(keyword);
    const statusMatched = !filters.status || row.status === filters.status;

    return keywordMatched && statusMatched;
  });
});

function handleReset() {
  filters.keyword = "";
  filters.status = "";
}
</script>

<template>
  <CommonExampleCard title="搜索表格">
    <div class="search-table-example">
      <AdminSearchPanel aria-label="搜索表格筛选" label-width="88px">
        <ElFormItem label="组件名称">
          <ElInput v-model="filters.keyword" clearable placeholder="请输入" />
        </ElFormItem>

        <ElFormItem label="接入状态">
          <ElSelect v-model="filters.status" clearable placeholder="请选择">
            <ElOption label="已接入" value="ready" />
            <ElOption label="规划中" value="draft" />
          </ElSelect>
        </ElFormItem>

        <ElFormItem class="search-table-example__actions" label=" ">
          <ElButton @click="handleReset">重 置</ElButton>
          <ElButton type="primary">
            <ElIcon>
              <Search />
            </ElIcon>
            搜 索
          </ElButton>
        </ElFormItem>
      </AdminSearchPanel>

      <AdminTablePanel title="搜索结果">
        <template #actions>
          <AdminTableActionButton label="刷新">
            <Refresh />
          </AdminTableActionButton>
          <AdminTableActionButton label="密度">
            <Grid />
          </AdminTableActionButton>
        </template>

        <ElTable :data="visibleRows" row-key="component">
          <ElTableColumn label="组件名称" min-width="180" prop="component" />
          <ElTableColumn label="类型" min-width="140" prop="type" />
          <ElTableColumn label="使用场景" min-width="220" prop="scene" />
          <ElTableColumn label="接入状态" min-width="120" prop="status">
            <template #default="{ row }: { row: TableRow }">
              <ElTag :type="row.status === 'ready' ? 'success' : 'info'" effect="light">
                {{ row.status === "ready" ? "已接入" : "规划中" }}
              </ElTag>
            </template>
          </ElTableColumn>
        </ElTable>

        <template #footer>
          <AdminPagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="visibleRows.length"
          />
        </template>
      </AdminTablePanel>
    </div>
  </CommonExampleCard>
</template>

<style scoped>
.search-table-example {
  display: grid;
  gap: 16px;
}

.search-table-example__actions :deep(.el-form-item__content) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.search-table-example :deep(.admin-table-panel) {
  min-height: 380px;
}
</style>
