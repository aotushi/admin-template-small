/**
 * API Key 数据模型
 * 用于管理用户的 API Key
 */

// API Key 数据库记录类型
export interface ApiKeyRecord {
  id: number;
  user_id: number;
  api_key: string;
  is_active: number; // 0=禁用，1=启用
  rate_limit: number;
  created_at: string;
  created_by: number;
  expires_at: string | null;
  last_used_at: string | null;
  notes: string | null;
}

// API Key 创建参数
export interface CreateApiKeyParams {
  user_id: number;
  api_key: string;
  created_by: number;
  expires_at?: string;
  notes?: string;
  rate_limit?: number;
}
