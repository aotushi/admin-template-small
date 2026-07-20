import { defineQueryOptions, useMutation, useQuery, useQueryCache } from "@pinia/colada";

import {
  createRoleApi,
  deleteRoleApi,
  getRolesApi,
  updateRoleApi,
  type RolePayload,
} from "@/api/modules/roles";

export const ROLES_QUERY_KEYS = {
  list: () => [...ROLES_QUERY_KEYS.root, "list"] as const,
  root: ["roles"] as const,
};

export const rolesQueryOptions = defineQueryOptions(() => ({
  key: ROLES_QUERY_KEYS.list(),
  query: getRolesApi,
}));

// enabled 支持按条件延迟拉取（如用户页仅 super 才加载角色选项）
export function useRolesQuery(enabled?: () => boolean) {
  return useQuery({ ...rolesQueryOptions(), ...(enabled ? { enabled } : {}) });
}

export function useCreateRoleMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: (payload: RolePayload) => createRoleApi(payload),
    onSuccess: () => {
      void queryCache.invalidateQueries({ key: ROLES_QUERY_KEYS.root });
    },
  });
}

export function useUpdateRoleMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: ({ payload, roleId }: { payload: RolePayload; roleId: number }) =>
      updateRoleApi(roleId, payload),
    onSuccess: () => {
      void queryCache.invalidateQueries({ key: ROLES_QUERY_KEYS.root });
    },
  });
}

export function useDeleteRoleMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: (roleId: number) => deleteRoleApi(roleId),
    onSuccess: () => {
      void queryCache.invalidateQueries({ key: ROLES_QUERY_KEYS.root });
    },
  });
}
