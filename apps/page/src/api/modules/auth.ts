import { requestClient } from "@/api/request";
import type { CurrentUser, LoginPayload, LoginResult } from "@/api/types";

export function loginApi(payload: LoginPayload) {
  return requestClient.post<LoginResult, LoginPayload>("/api/auth/login", payload, {
    authMode: "none",
  });
}

export function getProfileApi() {
  return requestClient.get<CurrentUser>("/api/auth/profile");
}

export function logoutApi() {
  return requestClient.post<null>("/api/auth/logout", undefined, {
    authMode: "none",
  });
}
