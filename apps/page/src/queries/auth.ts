import {
  defineQueryOptions,
  useMutation,
  useQuery,
  useQueryCache,
  type QueryCache,
} from "@pinia/colada";

import { getProfileApi, loginApi } from "@/api/modules/auth";
import { authSessionCoordinator } from "@/api/request";
import { getAccessToken } from "@/api/session";
import type { LoginPayload, LoginResult } from "@/api/types";

export const AUTH_QUERY_KEYS = {
  currentUser: () => [...AUTH_QUERY_KEYS.root, "current-user"] as const,
  root: ["auth"] as const,
};

export const AUTH_MUTATION_KEYS = {
  login: () => [...AUTH_QUERY_KEYS.root, "login"] as const,
};

export const currentUserQueryOptions = defineQueryOptions(() => ({
  enabled: Boolean(getAccessToken()),
  key: AUTH_QUERY_KEYS.currentUser(),
  query: getProfileApi,
}));

export function useCurrentUserQuery() {
  return useQuery(currentUserQueryOptions);
}

export function useLoginMutation() {
  const queryCache = useQueryCache();

  return useMutation<LoginResult, LoginPayload>({
    key: AUTH_MUTATION_KEYS.login(),
    mutation: (payload) => authSessionCoordinator.login(() => loginApi(payload)),
    onSuccess() {
      clearPrivateQueryCache(queryCache);
    },
  });
}

export function clearAuthQueryCache(queryCache: QueryCache) {
  queryCache.cancelQueries({ key: AUTH_QUERY_KEYS.root }, "auth session changed");

  for (const entry of queryCache.getEntries({ key: AUTH_QUERY_KEYS.root })) {
    queryCache.remove(entry);
  }
}

export function clearPrivateQueryCache(queryCache: QueryCache) {
  queryCache.cancelQueries(undefined, "auth session changed");

  for (const entry of queryCache.getEntries()) {
    queryCache.remove(entry);
  }
}
