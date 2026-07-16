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

export function useRolesQuery() {
  return useQuery(rolesQueryOptions);
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
