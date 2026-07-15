import { type AxiosInstance, type AxiosResponse } from "axios";

import { unwrapApiResponse } from "@/api/http/response";
import type { ApiResponse, RequestConfig } from "@/api/http/types";

export class HttpClient {
  constructor(private readonly instance: AxiosInstance) {}

  async request<T, D = unknown>(config: RequestConfig<D>): Promise<T> {
    // 所有业务请求经过 Axios 后，只在这里剥离一次响应外壳。
    const response = await this.instance.request<ApiResponse<T>, AxiosResponse<ApiResponse<T>>, D>(
      config,
    );
    return unwrapApiResponse<T>(response);
  }

  get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "GET", url });
  }

  delete<T, D = unknown>(url: string, config?: RequestConfig<D>): Promise<T> {
    return this.request<T, D>({ ...config, method: "DELETE", url });
  }

  head<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "HEAD", url });
  }

  options<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "OPTIONS", url });
  }

  post<T, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T> {
    return this.request<T, D>({ ...config, data, method: "POST", url });
  }

  put<T, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T> {
    return this.request<T, D>({ ...config, data, method: "PUT", url });
  }

  patch<T, D = unknown>(url: string, data?: D, config?: RequestConfig<D>): Promise<T> {
    return this.request<T, D>({ ...config, data, method: "PATCH", url });
  }
}
