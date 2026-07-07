/**
 * 数据来源2插件 - admin.insta.cyou
 *
 * Input: 用户列表
 * Output: 应用→URL映射关系
 * Pos: backend/src/services/dataSources/source2.ts
 *
 * 🔄 自维护：修改数据来源2逻辑时，必须更新本文件
 */

import type { DataSource, FetchParams, Env, Source2RawData, AppUrlMapping } from './types';

/**
 * 获取单个用户的应用URL映射
 */
async function fetchUserApps(customerName: string, env: Env): Promise<Source2RawData | null> {
  try {
    const url = `${env.SOURCE2_BASE_URL}/api/v1/customer/apps?customer_name=${encodeURIComponent(customerName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.SOURCE2_TOKEN}`
      }
    });

    if (!response.ok) {
      // 404表示用户不存在，跳过
      if (response.status === 404) {
        return null;
      }
      throw new Error(`数据来源2 API调用失败: ${response.status}`);
    }

    const data: Source2RawData = await response.json();

    if (!data.success) {
      return null;
    }

    return data;
  } catch (error) {
    console.error(`获取用户 ${customerName} 的应用映射失败:`, error);
    return null;
  }
}

/**
 * 批量获取所有用户的应用URL映射
 */
async function fetchAllUserApps(users: string[], env: Env): Promise<AppUrlMapping[]> {
  const allMappings: AppUrlMapping[] = [];

  for (const userName of users) {
    const data = await fetchUserApps(userName, env);

    if (data && data.apps) {
      for (const app of data.apps) {
        allMappings.push({
          username: userName,
          appId: app.app_id,
          appName: app.app_name,
          urls: [...new Set(app.urls.map(u => u.url.trim()).filter(u => u))]
        });
      }
    }
  }

  return allMappings;
}

/**
 * 转换数据来源2的数据格式
 */
function transformData(rawData: AppUrlMapping[]): AppUrlMapping[] {
  // 数据来源2已经是目标格式，直接返回
  return rawData;
}

/**
 * 数据来源2插件实例
 */
export const source2Plugin: DataSource = {
  id: 'source2',
  name: 'admin.insta.cyou',
  enabled: true,

  async fetchData(params: FetchParams, env: Env): Promise<AppUrlMapping[]> {
    if (!params.users || params.users.length === 0) {
      throw new Error('数据来源2需要用户列表参数');
    }
    return await fetchAllUserApps(params.users, env);
  },

  transformData(rawData: AppUrlMapping[]): AppUrlMapping[] {
    return transformData(rawData);
  }
};
