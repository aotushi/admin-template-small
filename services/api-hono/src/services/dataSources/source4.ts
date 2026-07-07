/**
 * 数据来源4插件 - cms.admaximum.vip
 *
 * Input: 日期参数
 * Output: 域名+国家级广告数据
 * Pos: backend/src/services/dataSources/source4.ts
 *
 * 🔄 自维护：修改数据来源4逻辑时，必须更新本文件
 */

import type { DataSource, FetchParams, Env, UrlData, CountryData } from './types';

interface Source4Item {
  adUnitId: string;
  adUnitName: string;
  date: string;
  domain: string;
  adExchangeTotalRequests: number;
  matchRequests: number;
  adExchangeLineItemLevelImpressions: number;
  adExchangeLineItemLevelClicks: number;
  adExchangeLineItemLevelAverageEcpm: number;
  adExchangeLineItemLevelCtr: number;
  adExchangeLineItemLevelRevenue: number;
  countryName: string;
  countryCode: string;
}

interface Source4Response {
  code: number;
  msg: string | null;
  data: Source4Item[];
}

async function fetchData(params: FetchParams, env: Env): Promise<Source4Item[]> {
  const response = await fetch(
    `${env.SOURCE4_BASE_URL}/download/country?reportDate=${params.date}`,
    {
      headers: {
        apiKey: env.SOURCE4_API_KEY,
        apiSecret: env.SOURCE4_API_SECRET
      }
    }
  );

  if (!response.ok) {
    throw new Error(`数据来源4请求失败: ${response.status}`);
  }

  const result: Source4Response = await response.json();
  if (result.code !== 200) {
    throw new Error(`数据来源4返回错误: ${result.msg}`);
  }

  return result.data;
}

function transformData(rawData: Source4Item[]): UrlData[] {
  // 按域名分组
  const urlMap = new Map<string, Source4Item[]>();
  for (const item of rawData) {
    const url = `https://${item.domain}`;
    if (!urlMap.has(url)) urlMap.set(url, []);
    urlMap.get(url)!.push(item);
  }

  const result: UrlData[] = [];
  for (const [url, items] of urlMap.entries()) {
    const countryDetails: CountryData[] = items.map(item => ({
      country: item.countryCode,
      dataSource: 'source4' as const,
      request: item.adExchangeTotalRequests,
      response: item.matchRequests,
      impression: item.adExchangeLineItemLevelImpressions,
      click: item.adExchangeLineItemLevelClicks,
      fillRate: item.adExchangeTotalRequests > 0
        ? (item.matchRequests / item.adExchangeTotalRequests) * 100 : 0,
      impressionRate: item.matchRequests > 0
        ? (item.adExchangeLineItemLevelImpressions / item.matchRequests) * 100 : 0,
      clickRate: item.adExchangeLineItemLevelCtr * 100,
      ecpm: item.adExchangeLineItemLevelAverageEcpm,
      revenue: item.adExchangeLineItemLevelRevenue,
      adUnit: item.adUnitName
    }));

    result.push({ date: items[0].date, url, countryDetails });
  }

  return result;
}

export const source4Plugin: DataSource = {
  id: 'source4',
  name: 'cms.admaximum.vip',
  enabled: true,

  async fetchData(params: FetchParams, env: Env) {
    return await fetchData(params, env);
  },

  transformData(rawData: any): UrlData[] {
    return transformData(rawData);
  }
};
