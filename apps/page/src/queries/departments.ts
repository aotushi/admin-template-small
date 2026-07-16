import { defineQueryOptions, useMutation, useQuery, useQueryCache } from "@pinia/colada";

import {
  createDepartmentApi,
  deleteDepartmentApi,
  getDepartmentsTreeApi,
  updateDepartmentApi,
  type DepartmentPayload,
} from "@/api/modules/departments";
import { USERS_QUERY_KEYS } from "@/queries/users";

export const DEPARTMENTS_QUERY_KEYS = {
  root: ["departments"] as const,
  tree: () => [...DEPARTMENTS_QUERY_KEYS.root, "tree"] as const,
};

export const departmentsTreeQueryOptions = defineQueryOptions(() => ({
  key: DEPARTMENTS_QUERY_KEYS.tree(),
  query: getDepartmentsTreeApi,
}));

export function useDepartmentsManageTreeQuery() {
  return useQuery(departmentsTreeQueryOptions);
}

// 部门变更同时失效用户页缓存（部门筛选树与 user_count 都依赖部门数据）
function invalidateDepartmentQueries(queryCache: ReturnType<typeof useQueryCache>) {
  void queryCache.invalidateQueries({ key: DEPARTMENTS_QUERY_KEYS.root });
  void queryCache.invalidateQueries({ key: USERS_QUERY_KEYS.root });
}

export function useCreateDepartmentMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: (payload: DepartmentPayload) => createDepartmentApi(payload),
    onSuccess: () => invalidateDepartmentQueries(queryCache),
  });
}

export function useUpdateDepartmentMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: ({ deptId, payload }: { deptId: number; payload: DepartmentPayload }) =>
      updateDepartmentApi(deptId, payload),
    onSuccess: () => invalidateDepartmentQueries(queryCache),
  });
}

export function useDeleteDepartmentMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: (deptId: number) => deleteDepartmentApi(deptId),
    onSuccess: () => invalidateDepartmentQueries(queryCache),
  });
}
