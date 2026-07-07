/**
 * 数据源管理器
 *
 * Input: 数据源插件
 * Output: 统一的数据获取接口
 * Pos: backend/src/services/dataSources/manager.ts
 *
 * 🔄 自维护：修改数据源管理逻辑时，必须更新本文件
 */

import type { DataSource, FetchParams, Env, UrlData, AppUrlMapping } from './types';
import { source1Plugin } from './source1';
import { source2Plugin } from './source2';
import { source3Plugin, type UserQueryResult } from './source3';
import { source4Plugin } from './source4';
import { source5Plugin } from './source5';
import { source6Plugin } from './source6';

export type { UserQueryResult };

/**
 * 数据源管理器类
 */
export class DataSourceManager {
  private sources: Map<string, DataSource> = new Map();

  constructor() {
    // 注册所有数据源
    this.register(source1Plugin);
    this.register(source2Plugin);
    this.register(source3Plugin);
    this.register(source4Plugin);
    this.register(source5Plugin);
    this.register(source6Plugin);
  }

  /**
   * 注册数据源
   */
  register(source: DataSource): void {
    this.sources.set(source.id, source);
  }

  /**
   * 获取启用的数据源
   */
  getEnabledSources(): DataSource[] {
    return Array.from(this.sources.values()).filter(source => source.enabled);
  }

  /**
   * 获取指定数据源
   */
  getSource(id: string): DataSource | undefined {
    return this.sources.get(id);
  }

  /**
   * 动态启用/禁用数据源
   */
  setEnabled(sourceId: string, enabled: boolean): void {
    const source = this.sources.get(sourceId);
    if (source) {
      source.enabled = enabled;
    }
  }

  /**
   * 获取数据来源1的数据
   */
  async fetchSource1Data(params: FetchParams, env: Env): Promise<UrlData[]> {
    const source = this.getSource('source1');
    if (!source || !source.enabled) {
      throw new Error('数据来源1未启用');
    }

    const rawData = await source.fetchData(params, env);
    return source.transformData(rawData) as UrlData[];
  }

  /**
   * 获取数据来源2的数据（应用URL映射）
   */
  async fetchSource2Data(params: FetchParams, env: Env): Promise<AppUrlMapping[]> {
    const source = this.getSource('source2');
    if (!source || !source.enabled) {
      throw new Error('数据来源2未启用');
    }

    const rawData = await source.fetchData(params, env);
    return source.transformData(rawData) as AppUrlMapping[];
  }

  /**
   * 获取数据来源3的数据（包含用户查询结果）
   */
  async fetchSource3Data(params: FetchParams, env: Env): Promise<{ urlData: UrlData[]; userResults: UserQueryResult[] }> {
    const source = this.getSource('source3');
    if (!source || !source.enabled) {
      throw new Error('数据来源3未启用');
    }

    const rawData = await source.fetchData(params, env);
    const urlData = source.transformData(rawData) as UrlData[];

    // 提取用户查询结果
    const userResults = rawData.userResults || [];

    return { urlData, userResults };
  }
  /**
   * 获取数据来源4的数据
   */
  async fetchSource4Data(params: FetchParams, env: Env): Promise<UrlData[]> {
    const source = this.getSource('source4');
    if (!source || !source.enabled) throw new Error('数据来源4未启用');
    const rawData = await source.fetchData(params, env);
    return source.transformData(rawData) as UrlData[];
  }

  /**
   * 获取数据来源5的数据
   */
  async fetchSource5Data(params: FetchParams, env: Env): Promise<UrlData[]> {
    const source = this.getSource('source5');
    if (!source || !source.enabled) throw new Error('数据来源5未启用');
    const rawData = await source.fetchData(params, env);
    return source.transformData(rawData) as UrlData[];
  }

  /**
   * 获取数据来源6的数据（Gmail CSV 附件）
   */
  async fetchSource6Data(params: FetchParams, env: Env): Promise<UrlData[]> {
    const source = this.getSource('source6');
    if (!source || !source.enabled) throw new Error('数据来源6未启用');
    const rawData = await source.fetchData(params, env);
    return source.transformData(rawData) as UrlData[];
  }
}

/**
 * 导出单例实例
 */
export const dataSourceManager = new DataSourceManager();
