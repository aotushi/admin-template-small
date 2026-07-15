import { defineQueryOptions, useMutation, useQuery, useQueryCache } from "@pinia/colada";

import {
  createUserApi,
  deleteUserApi,
  getDepartmentsTreeApi,
  getUsersApi,
  updateUserApi,
  type CreateUserPayload,
  type UpdateUserPayload,
} from "@/api/modules/users";

export const USERS_QUERY_KEYS = {
  departments: () => [...USERS_QUERY_KEYS.root, "departments"] as const,
  list: () => [...USERS_QUERY_KEYS.root, "list"] as const,
  root: ["users"] as const,
};

export const usersListQueryOptions = defineQueryOptions(() => ({
  key: USERS_QUERY_KEYS.list(),
  query: getUsersApi,
}));

export function useUsersListQuery() {
  return useQuery(usersListQueryOptions);
}

export const departmentsTreeQueryOptions = defineQueryOptions(() => ({
  key: USERS_QUERY_KEYS.departments(),
  query: getDepartmentsTreeApi,
}));

export function useDepartmentsTreeQuery() {
  return useQuery(departmentsTreeQueryOptions);
}

// CRUD 成功后统一失效用户列表（部门 user_count 也随之刷新）
function invalidateUsersQueries(queryCache: ReturnType<typeof useQueryCache>) {
  void queryCache.invalidateQueries({ key: USERS_QUERY_KEYS.root });
}

export function useCreateUserMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: (payload: CreateUserPayload) => createUserApi(payload),
    onSuccess: () => invalidateUsersQueries(queryCache),
  });
}

export function useUpdateUserMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: ({ payload, userId }: { payload: UpdateUserPayload; userId: number | string }) =>
      updateUserApi(userId, payload),
    onSuccess: () => invalidateUsersQueries(queryCache),
  });
}

export function useDeleteUserMutation() {
  const queryCache = useQueryCache();

  return useMutation({
    mutation: (userId: number | string) => deleteUserApi(userId),
    onSuccess: () => invalidateUsersQueries(queryCache),
  });
}
