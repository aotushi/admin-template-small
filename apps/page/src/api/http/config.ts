import type { CreateAxiosDefaults } from "axios";

const REQUEST_TIMEOUT = 15_000;

/** 套件级默认配置：JSON 请求头 + 15 秒超时 + Cookie 传输。baseURL 由宿主项目覆盖。 */
export function createHttpConfig(overrides: CreateAxiosDefaults = {}): CreateAxiosDefaults {
  return {
    headers: {
      "Content-Type": "application/json;charset=utf-8",
    },
    timeout: REQUEST_TIMEOUT,
    withCredentials: true,
    ...overrides,
  };
}
