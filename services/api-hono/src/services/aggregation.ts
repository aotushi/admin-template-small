/**
 * 数据聚合逻辑
 *
 * Input: URL级数据、应用URL映射
 * Output: 应用级汇总数据（三层嵌套结构）
 * Pos: backend/src/services/aggregation.ts
 *
 * 🔄 自维护：修改聚合逻辑时，必须更新本文件
 */

import type { UrlData, AppUrlMapping, CountryData } from './dataSources/types';

/**
 * 标准化URL格式
 * - 统一转换为小写
 * - 移除尾部斜杠
 * - 移除默认端口号
 * - 保留路径和查询参数
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // 统一协议为小写
    urlObj.protocol = urlObj.protocol.toLowerCase();

    // 统一主机名为小写
    urlObj.hostname = urlObj.hostname.toLowerCase();

    // 移除默认端口
    if ((urlObj.protocol === 'https:' && urlObj.port === '443') ||
        (urlObj.protocol === 'http:' && urlObj.port === '80')) {
      urlObj.port = '';
    }

    // 移除尾部斜杠（包括根路径）
    let result = urlObj.toString();
    if (result.endsWith('/')) {
      result = result.slice(0, -1);
    }

    return result;
  } catch (e) {
    // 如果URL解析失败，返回原始URL
    console.error('URL normalization failed:', url, e);
    return url;
  }
}

// 应用级汇总数据
export interface AppAggregatedData {
  username: string; // 用户名
  appId: string;
  appName: string;
  request: number; // 请求数量
  response: number; // 响应数量
  impression: number; // 展示数量
  click: number; // 点击数量
  fillRate: number; // 响应率（填充率）
  impressionRate: number; // 展示率
  clickRate: number; // 点击率
  ecpm: number; // 千次展示收益
  revenue: number; // 收益金额
  urlDetails: UrlAggregatedData[];
}

// 聚合结果（包含未匹配的URL）
export interface AggregationResult {
  apps: AppAggregatedData[];
  unmatchedUrls: UnmatchedUrlData[];
}

// 未匹配的URL数据
export interface UnmatchedUrlData {
  url: string;
  reason: 'no_mapping'; // 未匹配原因
  request: number; // 请求数量
  response: number; // 响应数量
  impression: number; // 展示数量
  click: number; // 点击数量
  revenue: number; // 收益金额
  countryDetails: CountryData[];
}

// URL级汇总数据
export interface UrlAggregatedData {
  url: string;
  request: number; // 请求数量
  response: number; // 响应数量
  impression: number; // 展示数量
  click: number; // 点击数量
  fillRate: number; // 响应率（填充率）
  impressionRate: number; // 展示率
  clickRate: number; // 点击率
  ecpm: number; // 千次展示收益
  revenue: number; // 收益金额
  countryDetails: CountryData[];
  sharedWith?: string[]; // 共享该URL的其他用户名列表（仅多用户共享时存在）
}

/**
 * 合并多个数据源的URL数据
 */
export function mergeUrlData(...sources: UrlData[][]): Map<string, UrlData> {
  const urlMap = new Map<string, UrlData>();

  for (const sourceData of sources) {
    for (const item of sourceData) {
      const normalizedUrl = normalizeUrl(item.url);
      if (urlMap.has(normalizedUrl)) {
        const existing = urlMap.get(normalizedUrl)!;
        existing.countryDetails.push(...item.countryDetails);
        if (item.officialAggregate) existing.officialAggregate = item.officialAggregate;
      } else {
        urlMap.set(normalizedUrl, {
          date: item.date,
          url: normalizedUrl,
          countryDetails: [...item.countryDetails],
          officialAggregate: item.officialAggregate
        });
      }
    }
  }

  return urlMap;
}

/**
 * 聚合URL级数据（从国家级数据计算）
 */
export function aggregateUrlData(countryDetails: CountryData[]): {
  request: number;
  response: number;
  impression: number;
  click: number;
  revenue: number;
} {
  let totalRequest = 0;
  let totalResponse = 0;
  let totalImpression = 0;
  let totalClick = 0;
  let totalRevenue = 0;

  for (const country of countryDetails) {
    totalRequest += country.request;
    totalResponse += country.response || 0; // 数据来源1可能没有response字段
    totalImpression += country.impression;
    totalClick += country.click;
    totalRevenue += country.revenue;
  }

  return {
    request: totalRequest,
    response: totalResponse,
    impression: totalImpression,
    click: totalClick,
    revenue: totalRevenue
  };
}

/**
 * 计算百分比指标
 */
export function calculateRates(request: number, response: number, impression: number, click: number): {
  fillRate: number;
  impressionRate: number;
  clickRate: number;
} {
  // 填充率 = 响应数 / 请求数
  const fillRate = request > 0 ? (response / request) * 100 : 0;
  // 展示率 = 展示数 / 请求数
  const impressionRate = request > 0 ? (impression / request) * 100 : 0;
  // 点击率 = 点击数 / 展示数
  const clickRate = impression > 0 ? (click / impression) * 100 : 0;

  return {
    fillRate: Number(fillRate.toFixed(2)),
    impressionRate: Number(impressionRate.toFixed(2)),
    clickRate: Number(clickRate.toFixed(2))
  };
}

/**
 * 按应用聚合数据
 */
export function aggregateByApp(
  urlDataMap: Map<string, UrlData>,
  appMappings: AppUrlMapping[]
): AggregationResult {
  // 构建 (URL, username) 到应用的映射，支持多用户共享URL
  const urlUsernameToAppMap = new Map<string, { username: string; appId: string; appName: string }>();

  // 检测重复URL：记录每个URL被哪些用户使用
  const urlToUsersMap = new Map<string, Set<string>>();

  for (const mapping of appMappings) {
    for (const url of mapping.urls) {
      const normalizedUrl = normalizeUrl(url);
      const key = `${normalizedUrl}|${mapping.username}`;
      urlUsernameToAppMap.set(key, {
        username: mapping.username,
        appId: mapping.appId,
        appName: mapping.appName
      });

      // 记录URL的所有使用者
      if (!urlToUsersMap.has(normalizedUrl)) {
        urlToUsersMap.set(normalizedUrl, new Set());
      }
      urlToUsersMap.get(normalizedUrl)!.add(mapping.username);
    }
  }

  // 按应用分组URL数据（支持同一URL属于多个用户）
  const appMap = new Map<string, {
    username: string;
    appId: string;
    appName: string;
    urls: UrlData[];
  }>();

  // 先为所有应用创建空记录
  for (const mapping of appMappings) {
    const appKey = `${mapping.appId}|${mapping.username}`;
    if (!appMap.has(appKey)) {
      appMap.set(appKey, {
        username: mapping.username,
        appId: mapping.appId,
        appName: mapping.appName,
        urls: []
      });
    }
  }

  // 记录未匹配的URL数据
  const unmatchedUrlsData: Array<UrlData & { _reason: string }> = [];

  for (const [url, urlData] of urlDataMap.entries()) {
    // 直接从 urlToUsersMap 查找配置了该URL的所有用户（O(1) Map查找，替代原来的 O(n) 嵌套循环）
    const users = urlToUsersMap.get(url);

    if (!users || users.size === 0) {
      unmatchedUrlsData.push({ ...urlData, _reason: 'no_mapping' });
      continue;
    }

    for (const username of users) {
      const appInfo = urlUsernameToAppMap.get(`${url}|${username}`);
      if (!appInfo) continue;

      const appKey = `${appInfo.appId}|${appInfo.username}`;
      // 为每个用户创建独立的数据副本（appMap 已在上方预创建，直接 push）
      appMap.get(appKey)!.urls.push({
        date: urlData.date,
        url: urlData.url,
        countryDetails: [...urlData.countryDetails],
        officialAggregate: urlData.officialAggregate
      });
    }
  }

  // 输出未匹配的URL日志
  if (unmatchedUrlsData.length > 0) {
    console.warn(`Found ${unmatchedUrlsData.length} unmatched URLs:`, unmatchedUrlsData.map(u => u.url));
  }

  // 聚合每个应用的数据
  const result: AppAggregatedData[] = [];

  for (const [appKey, appData] of appMap.entries()) {
    const urlDetails: UrlAggregatedData[] = [];
    let appTotalRequest = 0;
    let appTotalResponse = 0;
    let appTotalImpression = 0;
    let appTotalClick = 0;
    let appTotalRevenue = 0;

    // 找到该应用的原始配置
    const appMapping = appMappings.find(
      m => m.appId === appData.appId && m.username === appData.username
    );

    // 为所有配置的URL创建记录
    if (appMapping) {
      for (const configUrl of appMapping.urls) {
        const normalizedUrl = normalizeUrl(configUrl);
        // 查找该URL是否有数据
        const urlData = appData.urls.find(u => normalizeUrl(u.url) === normalizedUrl);

        if (urlData) {
          // 有数据：使用实际数据
          const urlAgg = urlData.officialAggregate
            ? urlData.officialAggregate
            : aggregateUrlData(urlData.countryDetails);

          const urlRates = calculateRates(urlAgg.request, urlAgg.response, urlAgg.impression, urlAgg.click);

          // 获取该URL的所有共享用户
          const sharedUsers = urlToUsersMap.get(normalizedUrl);
          const otherUsers = sharedUsers
            ? Array.from(sharedUsers).filter(u => u !== appData.username)
            : [];

          urlDetails.push({
            url: urlData.url,
            request: urlAgg.request,
            response: urlAgg.response,
            impression: urlAgg.impression,
            click: urlAgg.click,
            fillRate: urlRates.fillRate,
            impressionRate: urlRates.impressionRate,
            clickRate: urlRates.clickRate,
            ecpm: urlAgg.impression > 0 ? Number((urlAgg.revenue / urlAgg.impression * 1000).toFixed(2)) : 0,
            revenue: Number(urlAgg.revenue.toFixed(2)),
            countryDetails: urlData.countryDetails,
            sharedWith: otherUsers.length > 0 ? otherUsers : undefined
          });

          appTotalRequest += urlAgg.request;
          appTotalResponse += urlAgg.response;
          appTotalImpression += urlAgg.impression;
          appTotalClick += urlAgg.click;
          appTotalRevenue += urlAgg.revenue;
        } else {
          // 没有数据：创建空记录
          const sharedUsers = urlToUsersMap.get(normalizedUrl);
          const otherUsers = sharedUsers
            ? Array.from(sharedUsers).filter(u => u !== appData.username)
            : [];

          urlDetails.push({
            url: configUrl,
            request: 0,
            response: 0,
            impression: 0,
            click: 0,
            fillRate: 0,
            impressionRate: 0,
            clickRate: 0,
            ecpm: 0,
            revenue: 0,
            countryDetails: [],
            sharedWith: otherUsers.length > 0 ? otherUsers : undefined
          });
        }
      }
    }

    // 计算应用级指标
    const appRates = calculateRates(appTotalRequest, appTotalResponse, appTotalImpression, appTotalClick);

    result.push({
      username: appData.username,
      appId: appData.appId,
      appName: appData.appName,
      request: appTotalRequest,
      response: appTotalResponse,
      impression: appTotalImpression,
      click: appTotalClick,
      fillRate: appRates.fillRate,
      impressionRate: appRates.impressionRate,
      clickRate: appRates.clickRate,
      ecpm: appTotalImpression > 0 ? Number((appTotalRevenue / appTotalImpression * 1000).toFixed(2)) : 0,
      revenue: Number(appTotalRevenue.toFixed(2)),
      urlDetails: urlDetails
    });
  }

  // 处理未匹配的URL数据
  const unmatchedUrls: UnmatchedUrlData[] = unmatchedUrlsData.map((urlData: any) => {
    const urlAgg = urlData.officialAggregate
      ? urlData.officialAggregate
      : aggregateUrlData(urlData.countryDetails);

    return {
      url: urlData.url,
      reason: urlData._reason ?? 'no_mapping',
      request: urlAgg.request,
      response: urlAgg.response,
      impression: urlAgg.impression,
      click: urlAgg.click,
      revenue: Number(urlAgg.revenue.toFixed(2)),
      countryDetails: urlData.countryDetails
    };
  });

  return {
    apps: result,
    unmatchedUrls: unmatchedUrls
  };
}
