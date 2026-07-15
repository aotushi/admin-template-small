import { defineQueryOptions, useMutation, useQuery, useQueryCache } from "@pinia/colada";

import { getRolesApi, updateRoleApi, type UpdateRolePayload } from "@/api/modules/roles";

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

export function useUpdateRoleMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: ({ payload, roleId }: { payload: UpdateRolePayload; roleId: number }) =>
      updateRoleApi(roleId, payload),
    onSuccess: () => {
      void queryCache.invalidateQueries({ key: ROLES_QUERY_KEYS.root });
    },
  });
}
