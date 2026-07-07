/**
 * 数据源接口定义
 *
 * Input: 无
 * Output: 数据源接口类型定义
 * Pos: backend/src/services/dataSources/types.ts
 *
 * 🔄 自维护：修改数据源接口时，必须更新本文件及使用方
 */

// 环境变量类型定义
export interface Env {
  // 数据来源1: tongbaishijia.com
  SOURCE1_BASE_URL: string;
  SOURCE1_USERNAME: string;
  SOURCE1_PASSWORD: string;

  // 数据来源2: admin.insta.cyou
  SOURCE2_BASE_URL: string;
  SOURCE2_TOKEN: string;

  // 数据来源3: adgoogleboard.com
  SOURCE3_BASE_URL: string;
  SOURCE3_USERNAME: string;
  SOURCE3_PASSWORD: string;
  SOURCE3_SECRET_KEY: string;

  // 数据来源4: cms.admaximum.vip
  SOURCE4_BASE_URL: string;
  SOURCE4_API_KEY: string;
  SOURCE4_API_SECRET: string;

  // 数据来源5: crm.skymobi.online
  SOURCE5_BASE_URL: string;
  SOURCE5_API_KEY: string;
  SOURCE5_UID: string;

  // 数据来源6: Gmail CSV 附件
  SOURCE6_CLIENT_ID: string;
  SOURCE6_CLIENT_SECRET: string;
  SOURCE6_REFRESH_TOKEN: string;
  SOURCE6_USER_EMAIL: string;

  // 数据库和其他
  DB: D1Database;
  JWT_SECRET: string;
}

// 统一的数据获取参数
export interface FetchParams {
  date: string; // YYYY-MM-DD 格式
  users?: string[]; // 用户列表（数据来源2和3需要）
}

// 统一的国家级数据格式
export interface CountryData {
  country: string; // 国家代码
  dataSource: 'source1' | 'source3' | 'source4' | 'source5' | 'source6'; // 数据来源标识
  request: number; // 广告请求数
  response?: number; // 响应数（匹配请求）
  impression: number; // 展示数
  click: number; // 点击数
  fillRate: number; // 填充率（百分比数值）
  impressionRate: number; // 展示率（百分比数值）
  clickRate: number; // 点击率（百分比数值）
  ecpm: number; // eCPM
  revenue: number; // 收入
  adUnit?: string; // 广告单元
}

// 统一的URL级数据格式
export interface UrlData {
  date: string; // 数据日期
  url: string; // 产品URL
  countryDetails: CountryData[]; // 国家级明细
  officialAggregate?: { // 官方URL级汇总数据（仅数据来源1）
    request: number;
    response: number;
    impression: number;
    click: number;
    revenue: number;
    fillRate: number; // 填充率（百分比数值）
    impressionRate: number; // 展示率（百分比数值）
    clickRate: number; // 点击率（百分比数值）
    ecpm: number; // eCPM
  };
}

// 应用→URL映射关系
export interface AppUrlMapping {
  username: string; // 用户名
  appId: string; // 应用ID
  appName: string; // 应用名称
  urls: string[]; // URL列表
}

// 数据来源1的原始响应（基础字段，两个接口共用）
export interface Source1BaseData {
  date: string;
  product: string; // URL
  ad_requests: number;
  ad_matches: number;
  ad_coverage: number;
  ad_impressions: number;
  ad_impression_rate: number;
  ad_clicks: number;
  ctr: number;
  ecpm: number;
  earnings: number;
}

// 数据来源1 - URL级汇总数据（zheguniao_data接口）
export interface Source1UrlAggregateData extends Source1BaseData {
  // 只有11个字段，不包含 country_code 和 ad_unit
}

// 数据来源1 - 国家级明细数据（zheguniao_adunit接口）
export interface Source1CountryDetailData extends Source1BaseData {
  country_code: string; // 国家代码
  ad_unit: string; // 广告单元
}

// 数据来源1的原始响应（兼容类型，用于统一处理）
export type Source1RawData = Source1UrlAggregateData | Source1CountryDetailData;

// 数据来源2的原始响应
export interface Source2RawData {
  success: boolean;
  customer: {
    id: number;
    customer_name: string;
  };
  apps: Array<{
    app_id: string;
    app_name: string;
    yesterday_dau: number;
    urls: Array<{
      url: string;
      status: string;
      hour_limit: number;
      day_limit: number;
      level: string;
      penetration_rate: string;
      remark: string;
    }>;
  }>;
  snapshot_date: string;
  dau_date: string;
}

// 数据来源3的原始响应
export interface Source3RawData {
  code: number;
  msg: string;
  data: string; // JSON字符串，需要解析
  total: number;
}

// 数据来源3解析后的数据
export interface Source3ParsedItem {
  day: string;
  url: string;
  request: number;
  response: number;
  impression: number;
  click: number;
  response_rate: string; // 如 "80.0%"
  impression_rate: string;
  click_rate: string;
  ecpm: number;
  profit: number;
  country: string;
  ad_unit: string;
}

// 数据源接口
export interface DataSource {
  id: 'source1' | 'source2' | 'source3' | 'source4' | 'source5' | 'source6';
  name: string;
  enabled: boolean;

  // 数据获取方法
  fetchData(params: FetchParams, env: Env): Promise<any>;

  // 数据转换方法（转换为统一格式）
  transformData(rawData: any): UrlData[] | AppUrlMapping[];
}

// 进度推送函数类型
export type ProgressCallback = (step: number, message: string, progress?: { current: number; total: number }) => void;
