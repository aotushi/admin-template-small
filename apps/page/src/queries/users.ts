import { defineQueryOptions, useQuery } from "@pinia/colada";

import { getDepartmentsTreeApi, getUsersApi } from "@/api/modules/users";

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
