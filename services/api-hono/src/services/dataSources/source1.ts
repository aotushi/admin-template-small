/**
 * 数据来源1插件 - tongbaishijia.com
 *
 * Input: 日期参数
 * Output: URL+国家级广告数据
 * Pos: backend/src/services/dataSources/source1.ts
 *
 * 🔄 自维护：修改数据来源1逻辑时，必须更新本文件
 */

import type { DataSource, FetchParams, Env, Source1RawData, UrlData, CountryData } from './types';

// Token缓存（全局变量）
let cachedToken: string | null = null;

/**
 * 获取数据来源1的访问Token
 */
async function getToken(env: Env): Promise<string> {
  if (cachedToken) {
    return cachedToken;
  }

  const response = await fetch(`${env.SOURCE1_BASE_URL}/api/thirdservice/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: env.SOURCE1_USERNAME,
      password: env.SOURCE1_PASSWORD
    })
  });

  if (!response.ok) {
    throw new Error(`获取数据来源1 Token失败: ${response.status}`);
  }

  const data = await response.json();
  if (data.access_token) {
    cachedToken = data.access_token;
    return cachedToken;
  }

  throw new Error('数据来源1返回的Token为空');
}

/**
 * 清除Token缓存（用于Token过期时重试）
 */
function clearToken() {
  cachedToken = null;
}

/**
 * 调用数据来源1的URL级汇总接口（官方计算）
 */
async function fetchUrlAggregateData(params: FetchParams, env: Env, retries = 2): Promise<Source1RawData[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const token = await getToken(env);

      const response = await fetch(`${env.SOURCE1_BASE_URL}/api/thirdservice/zheguniao_data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product: '', // 空字符串返回全量数据
          page: '',
          limit: '',
          start: params.date,
          end: params.date
        })
      });

      if (!response.ok) {
        if (response.status === 401 && i < retries - 1) {
          clearToken();
          continue;
        }
        throw new Error(`数据来源1 URL级汇总接口调用失败: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 20000) {
        throw new Error(`数据来源1 URL级汇总接口返回错误: ${data.message || '未知错误'}`);
      }

      // 为URL级汇总数据添加特殊标记
      const items = data.data?.items || [];
      return items.map((item: any) => ({
        ...item,
        country_code: '__OFFICIAL_AGGREGATE__',
        ad_unit: '__URL_LEVEL__'
      }));
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
    }
  }

  return [];
}

/**
 * 调用数据来源1的国家级明细接口
 */
async function fetchCountryDetailData(params: FetchParams, env: Env, retries = 2): Promise<Source1RawData[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const token = await getToken(env);

      const response = await fetch(`${env.SOURCE1_BASE_URL}/api/thirdservice/zheguniao_adunit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product: '', // 空字符串返回全量数据
          countryCode: '', // 空字符串返回所有国家
          adunit: '', // 空字符串返回所有广告单元
          page: '',
          limit: '',
          start: params.date,
          end: params.date
        })
      });

      if (!response.ok) {
        if (response.status === 401 && i < retries - 1) {
          // Token过期，清除缓存并重试
          clearToken();
          continue;
        }
        throw new Error(`数据来源1国家级明细接口调用失败: ${response.status}`);
      }

      const data = await response.json();

      // 检查成功状态码
      if (data.code !== 20000) {
        throw new Error(`数据来源1国家级明细接口返回错误: ${data.message || '未知错误'}`);
      }

      return data.data?.items || [];
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
    }
  }

  return [];
}

/**
 * 聚合国家级数据到URL级（用于对比）
 */
function aggregateCountryToUrl(countryData: Source1RawData[]): Map<string, Source1RawData> {
  const urlMap = new Map<string, Source1RawData>();

  for (const item of countryData) {
    const url = item.product;

    if (!urlMap.has(url)) {
      // 初始化URL级数据
      urlMap.set(url, {
        date: item.date,
        product: url,
        ad_requests: 0,
        ad_matches: 0,
        ad_coverage: 0,
        ad_impressions: 0,
        ad_impression_rate: 0,
        ad_clicks: 0,
        ctr: 0,
        ecpm: 0,
        earnings: 0,
        country_code: '', // URL级不需要
        ad_unit: '' // URL级不需要
      });
    }

    const urlData = urlMap.get(url)!;
    urlData.ad_requests += item.ad_requests;
    urlData.ad_matches += item.ad_matches;
    urlData.ad_impressions += item.ad_impressions;
    urlData.ad_clicks += item.ad_clicks;
    urlData.earnings += item.earnings;
  }

  return urlMap;
}

/**
 * 合并和对比两个接口的数据
 * 优先使用 URL级汇总数据（官方计算），保留国家级明细
 *
 * 返回值：包含官方汇总数据的扩展格式
 * - 前半部分：国家级明细数据（用于展示）
 * - 后半部分：官方URL级汇总数据（标记为特殊格式）
 */
function mergeAndCompareData(
  urlAggregateData: Source1RawData[],
  countryDetailData: Source1RawData[]
): Source1RawData[] {
  // 将URL级汇总数据转为Map，方便查找
  const urlAggregateMap = new Map<string, Source1RawData>();
  for (const item of urlAggregateData) {
    urlAggregateMap.set(item.product, item);
  }

  // 聚合国家级数据到URL级
  const aggregatedCountryMap = aggregateCountryToUrl(countryDetailData);

  // 对比数据并记录差异
  const urlEntries = Array.from(urlAggregateMap.entries());
  for (const [url, officialData] of urlEntries) {
    const aggregatedData = aggregatedCountryMap.get(url);

    if (aggregatedData) {
      // 对比关键指标
      const requestDiff = Math.abs(officialData.ad_requests - aggregatedData.ad_requests);
      const revenueDiff = Math.abs(officialData.earnings - aggregatedData.earnings);

      if (requestDiff > 0 || revenueDiff > 0.01) {
        console.warn(`数据不一致 [${url}]:`, {
          official: {
            requests: officialData.ad_requests,
            revenue: officialData.earnings
          },
          aggregated: {
            requests: aggregatedData.ad_requests,
            revenue: aggregatedData.earnings
          }
        });
      }
    }
  }

  // 将官方汇总数据附加到结果中（使用特殊标记）
  const result = [...countryDetailData];

  // 添加官方汇总数据标记（通过特殊的 country_code）
  for (const item of urlAggregateData) {
    result.push({
      ...item,
      country_code: '__OFFICIAL_AGGREGATE__', // 特殊标记
      ad_unit: '__URL_LEVEL__'
    });
  }

  return result;
}

/**
 * 转换数据来源1的数据格式（按URL分组国家级数据）
 */
function transformData(rawData: Source1RawData[]): UrlData[] {
  // 分离官方汇总数据和国家级明细数据
  const officialAggregateMap = new Map<string, Source1RawData>();
  const countryDetailData: Source1RawData[] = [];

  for (const item of rawData) {
    if (item.country_code === '__OFFICIAL_AGGREGATE__') {
      // 这是官方汇总数据
      officialAggregateMap.set(item.product, item);
    } else {
      // 这是国家级明细数据
      countryDetailData.push(item);
    }
  }

  // 按URL分组国家级明细数据
  const urlMap = new Map<string, Source1RawData[]>();

  for (const item of countryDetailData) {
    if (!urlMap.has(item.product)) {
      urlMap.set(item.product, []);
    }
    urlMap.get(item.product)!.push(item);
  }

  // 转换为UrlData格式
  const result: UrlData[] = [];

  // 收集所有URL（包括只有官方数据的URL）
  const allUrls = new Set<string>();
  for (const url of urlMap.keys()) {
    allUrls.add(url);
  }
  for (const url of officialAggregateMap.keys()) {
    allUrls.add(url);
  }

  // 处理每个URL
  for (const url of allUrls) {
    const items = urlMap.get(url) || [];
    const officialData = officialAggregateMap.get(url);

    // 如果有国家级明细数据，转换为 CountryData 格式
    const countryDetails: CountryData[] = items.map(item => ({
      country: item.country_code,
      dataSource: 'source1' as const,
      request: item.ad_requests,
      response: item.ad_matches,
      impression: item.ad_impressions,
      click: item.ad_clicks,
      fillRate: item.ad_coverage,
      impressionRate: item.ad_impression_rate,
      clickRate: item.ctr,
      ecpm: item.ecpm,
      revenue: item.earnings,
      adUnit: item.ad_unit
    }));

    // 获取日期（优先从国家级数据，否则从官方数据）
    const date = items.length > 0 ? items[0].date : (officialData?.date || '');

    result.push({
      date: date,
      url: url,
      countryDetails: countryDetails,
      officialAggregate: officialData ? {
        request: officialData.ad_requests,
        response: officialData.ad_matches,
        impression: officialData.ad_impressions,
        click: officialData.ad_clicks,
        revenue: officialData.earnings,
        fillRate: officialData.ad_coverage,
        impressionRate: officialData.ad_impression_rate,
        clickRate: officialData.ctr,
        ecpm: officialData.ecpm
      } : undefined
    });
  }

  return result;
}

/**
 * 数据来源1插件实例
 */
export const source1Plugin: DataSource = {
  id: 'source1',
  name: 'tongbaishijia.com',
  enabled: true,

  async fetchData(params: FetchParams, env: Env): Promise<Source1RawData[]> {
    // 并行调用两个接口
    const [urlAggregateData, countryDetailData] = await Promise.all([
      fetchUrlAggregateData(params, env).catch(err => {
        console.error('URL级汇总接口调用失败:', err);
        return [];
      }),
      fetchCountryDetailData(params, env).catch(err => {
        console.error('国家级明细接口调用失败:', err);
        return [];
      })
    ]);

    // 如果两个接口都失败，抛出错误
    if (urlAggregateData.length === 0 && countryDetailData.length === 0) {
      throw new Error('数据来源1的两个接口都调用失败');
    }

    // 如果只有国家级明细数据，直接返回
    if (urlAggregateData.length === 0) {
      console.warn('URL级汇总接口无数据，使用国家级明细数据');
      return countryDetailData;
    }

    // 如果只有URL级汇总数据，直接返回
    if (countryDetailData.length === 0) {
      console.warn('国家级明细接口无数据，使用URL级汇总数据');
      return urlAggregateData;
    }

    // 两个接口都有数据，进行对比和合并
    return mergeAndCompareData(urlAggregateData, countryDetailData);
  },

  transformData(rawData: Source1RawData[]): UrlData[] {
    return transformData(rawData);
  }
};
