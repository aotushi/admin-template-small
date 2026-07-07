/**
 * 数据来源3插件 - adgoogleboard.com
 *
 * Input: 用户列表、日期参数
 * Output: URL+国家级广告数据
 * Pos: backend/src/services/dataSources/source3.ts
 *
 * 🔄 自维护：修改数据来源3逻辑时，必须更新本文件
 */

import type { DataSource, FetchParams, Env, Source3RawData, Source3ParsedItem, UrlData, CountryData } from './types';

/**
 * 生成MD5签名
 */
async function generateMD5Sign(username: string, startDate: string, endDate: string, secretKey: string): Promise<string> {
  // 按字母顺序排序参数
  const str = `end_date=${endDate}&start_date=${startDate}&username=${username}${secretKey}`;

  // 使用Web Crypto API生成MD5
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex.toLowerCase();
}

/**
 * 用户查询结果接口
 */
export interface UserQueryResult {
  username: string;
  status: 'success' | 'not_found' | 'error';
  recordCount: number;
  errorMessage?: string;
}

/**
 * 获取单个用户的广告数据
 */
async function fetchUserAdData(username: string, params: FetchParams, env: Env): Promise<{ data: Source3ParsedItem[]; result: UserQueryResult }> {
  try {
    const sign = await generateMD5Sign(username, params.date, params.date, env.SOURCE3_SECRET_KEY);

    const response = await fetch(`${env.SOURCE3_BASE_URL}/frame/getadsdata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        start_date: params.date,
        end_date: params.date,
        sign: sign,
        index: 0,
        limit: 1000
      })
    });

    if (!response.ok) {
      return {
        data: [],
        result: {
          username,
          status: 'error',
          recordCount: 0,
          errorMessage: `API调用失败: ${response.status}`
        }
      };
    }

    const data: Source3RawData = await response.json();

    // 检查成功状态码
    if (data.code !== 0) {
      // 用户不存在是预期情况
      if (data.msg && data.msg.includes('用户不存在')) {
        return {
          data: [],
          result: {
            username,
            status: 'not_found',
            recordCount: 0
          }
        };
      }
      // 其他错误
      console.warn(`数据来源3返回警告 [${username}]: ${data.msg || '未知错误'}`);
      return {
        data: [],
        result: {
          username,
          status: 'error',
          recordCount: 0,
          errorMessage: data.msg || '未知错误'
        }
      };
    }

    // 解析data字段（JSON字符串）
    if (!data.data) {
      return {
        data: [],
        result: {
          username,
          status: 'success',
          recordCount: 0
        }
      };
    }

    const parsedData: Source3ParsedItem[] = JSON.parse(data.data);
    return {
      data: parsedData,
      result: {
        username,
        status: 'success',
        recordCount: parsedData.length
      }
    };
  } catch (error) {
    // 只有真正的异常（网络错误、解析错误等）才打印错误日志
    console.error(`获取用户 ${username} 的广告数据失败:`, error);
    return {
      data: [],
      result: {
        username,
        status: 'error',
        recordCount: 0,
        errorMessage: error instanceof Error ? error.message : '未知错误'
      }
    };
  }
}

/**
 * 批量获取所有用户的广告数据
 */
async function fetchAllUserAdData(users: string[], params: FetchParams, env: Env): Promise<{ data: Source3ParsedItem[]; userResults: UserQueryResult[] }> {
  const allAdData: Source3ParsedItem[] = [];
  const userResults: UserQueryResult[] = [];

  for (const userName of users) {
    const { data, result } = await fetchUserAdData(userName, params, env);
    allAdData.push(...data);
    userResults.push(result);
  }

  return { data: allAdData, userResults };
}

/**
 * 转换数据来源3的数据格式
 */
function transformData(rawData: Source3ParsedItem[]): UrlData[] {
  // 按URL分组
  const urlMap = new Map<string, Source3ParsedItem[]>();

  for (const item of rawData) {
    if (!urlMap.has(item.url)) {
      urlMap.set(item.url, []);
    }
    urlMap.get(item.url)!.push(item);
  }

  // 转换为UrlData格式
  const result: UrlData[] = [];

  for (const [url, items] of urlMap.entries()) {
    const countryDetails: CountryData[] = items.map(item => ({
      country: item.country,
      dataSource: 'source3' as const,
      request: item.request,
      response: item.response,
      impression: item.impression,
      click: item.click,
      fillRate: parseFloat(item.response_rate.replace('%', '')),
      impressionRate: parseFloat(item.impression_rate.replace('%', '')),
      clickRate: parseFloat(item.click_rate.replace('%', '')),
      ecpm: item.ecpm,
      revenue: item.profit,
      adUnit: item.ad_unit
    }));

    result.push({
      date: items[0].day,
      url: url,
      countryDetails: countryDetails
    });
  }

  return result;
}

/**
 * 数据来源3插件实例
 */
export const source3Plugin: DataSource = {
  id: 'source3',
  name: 'adgoogleboard.com',
  enabled: true,

  async fetchData(params: FetchParams, env: Env): Promise<any> {
    if (!params.users || params.users.length === 0) {
      throw new Error('数据来源3需要用户列表参数');
    }
    return await fetchAllUserAdData(params.users, params, env);
  },

  transformData(rawData: any): UrlData[] {
    // rawData 现在是 { data: Source3ParsedItem[], userResults: UserQueryResult[] }
    if (rawData.data) {
      return transformData(rawData.data);
    }
    return transformData(rawData);
  }
};
