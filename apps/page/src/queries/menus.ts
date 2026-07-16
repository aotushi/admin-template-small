import { defineQueryOptions, useMutation, useQuery, useQueryCache } from "@pinia/colada";

import {
  createMenuApi,
  deleteMenuApi,
  getMenusTreeApi,
  updateMenuApi,
  type MenuPayload,
} from "@/api/modules/menus";

export const MENUS_QUERY_KEYS = {
  root: ["menus"] as const,
  tree: () => [...MENUS_QUERY_KEYS.root, "tree"] as const,
};

export const menusTreeQueryOptions = defineQueryOptions(() => ({
  key: MENUS_QUERY_KEYS.tree(),
  query: getMenusTreeApi,
}));

export function useMenusTreeQuery() {
  return useQuery(menusTreeQueryOptions);
}

export function useCreateMenuMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: (payload: MenuPayload) => createMenuApi(payload),
    onSuccess: () => {
      void queryCache.invalidateQueries({ key: MENUS_QUERY_KEYS.root });
    },
  });
}

export function useUpdateMenuMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: ({ menuId, payload }: { menuId: number; payload: MenuPayload }) =>
      updateMenuApi(menuId, payload),
    onSuccess: () => {
      void queryCache.invalidateQueries({ key: MENUS_QUERY_KEYS.root });
    },
  });
}

export function useDeleteMenuMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: (menuId: number) => deleteMenuApi(menuId),
    onSuccess: () => {
      void queryCache.invalidateQueries({ key: MENUS_QUERY_KEYS.root });
    },
  });
}
