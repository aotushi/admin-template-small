/**
 * 数据来源5插件 - crm.skymobi.online
 *
 * Input: 日期参数
 * Output: URL+国家级广告数据
 * Pos: backend/src/services/dataSources/source5.ts
 *
 * 🔄 自维护：修改数据来源5逻辑时，必须更新本文件
 */

import type { DataSource, FetchParams, Env, UrlData, CountryData } from './types';

interface Source5Item {
  dt: string;
  country: string; // 国家名称（中文）
  ct: string;      // 国家代码
  link: string;    // 域名
  req: number;
  req_ef: number;
  page_views: number;
  imp: number;
  click: number;
  income: number;
}

interface Source5Response {
  ret: number;
  msg: string;
  list: Source5Item[];
  total: number;
  pagesize: number;
}

async function fetchAllData(params: FetchParams, env: Env): Promise<Source5Item[]> {
  const baseUrl = `${env.SOURCE5_BASE_URL}/api/adxh5`;
  const query = `apikey=${env.SOURCE5_API_KEY}&uid=${env.SOURCE5_UID}&date=${params.date}&limit=50000`;

  const response = await fetch(`${baseUrl}?${query}`);
  if (!response.ok) {
    throw new Error(`数据来源5请求失败: ${response.status}`);
  }

  const result: Source5Response = await response.json();
  if (result.ret !== 0) {
    throw new Error(`数据来源5返回错误: ${result.msg}`);
  }

  let allData = result.list;

  // 如果数据不完整，继续分页获取
  if (allData.length < result.total) {
    let page = 2;
    while (allData.length < result.total) {
      const pageResp = await fetch(`${baseUrl}?${query}&page=${page}`);
      if (!pageResp.ok) break;
      const pageResult: Source5Response = await pageResp.json();
      if (pageResult.ret !== 0 || pageResult.list.length === 0) break;
      allData = allData.concat(pageResult.list);
      page++;
    }
  }

  return allData;
}

function transformData(rawData: Source5Item[]): UrlData[] {
  const urlMap = new Map<string, Source5Item[]>();
  for (const item of rawData) {
    const url = `https://${item.link}`;
    if (!urlMap.has(url)) urlMap.set(url, []);
    urlMap.get(url)!.push(item);
  }

  const result: UrlData[] = [];
  for (const [url, items] of urlMap.entries()) {
    const countryDetails: CountryData[] = items.map(item => ({
      country: item.ct,
      dataSource: 'source5' as const,
      request: item.req,
      response: item.req_ef,
      impression: item.imp,
      click: item.click,
      fillRate: item.req > 0 ? (item.req_ef / item.req) * 100 : 0,
      impressionRate: item.req_ef > 0 ? (item.imp / item.req_ef) * 100 : 0,
      clickRate: item.imp > 0 ? (item.click / item.imp) * 100 : 0,
      ecpm: item.imp > 0 ? (item.income / item.imp) * 1000 : 0,
      revenue: item.income
    }));

    result.push({ date: items[0].dt, url, countryDetails });
  }

  return result;
}

export const source5Plugin: DataSource = {
  id: 'source5',
  name: 'crm.skymobi.online',
  enabled: true,

  async fetchData(params: FetchParams, env: Env) {
    return await fetchAllData(params, env);
  },

  transformData(rawData: any): UrlData[] {
    return transformData(rawData);
  }
};
