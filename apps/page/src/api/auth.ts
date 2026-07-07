import { requestClient } from "@/api/request";
import type {
  CurrentUser,
  LoginPayload,
  LoginResult,
  TokenRefreshPayload,
  TokenRefreshResult,
} from "@/api/types";

export function loginApi(payload: LoginPayload) {
  return requestClient.post<LoginResult, LoginPayload>("/api/auth/login", payload);
}

export function getProfileApi() {
  return requestClient.get<CurrentUser>("/api/auth/profile");
}

export function refreshTokenApi(payload: TokenRefreshPayload) {
  return requestClient.post<TokenRefreshResult, TokenRefreshPayload>("/api/auth/refresh", payload);
}

export function logoutApi() {
  return Promise.resolve();
}
