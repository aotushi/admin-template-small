/**
 * 每日数据统计 SSE 流式接口（Mock 版本）
 *
 * Input: 日期参数（可选，默认前一天）
 * Output: SSE流式推送进度和 mock 最终数据
 * Pos: backend/src/routes/daily-stats.ts
 *
 * 🔄 自维护：修改每日数据统计接口时，必须更新本文件
 */

import type { Env } from '../services/dataSources/types';

/**
 * 创建SSE响应流
 */
function createSSEStream() {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (event: string, data: any) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  return { readable, sendEvent, writer };
}

const MOCK_DATA = [
  {
    appId: 'app_001',
    appName: 'Demo App Alpha',
    username: 'demo_user1',
    request: 12500,
    response: 11800,
    impression: 9600,
    click: 384,
    fillRate: 94.4,
    impressionRate: 81.36,
    clickRate: 4.0,
    ecpm: 3.25,
    revenue: 31.2,
    urlDetails: [
      {
        url: 'https://demo-app-alpha.example.com/ad/banner',
        request: 7200,
        response: 6900,
        impression: 5600,
        click: 224,
        fillRate: 95.83,
        impressionRate: 81.16,
        clickRate: 4.0,
        ecpm: 3.3,
        revenue: 18.48,
        countryDetails: [
          {
            country: 'US',
            dataSource: 'source1',
            request: 4000,
            response: 3900,
            impression: 3200,
            click: 128,
            fillRate: 97.5,
            impressionRate: 82.05,
            clickRate: 4.0,
            ecpm: 3.5,
            revenue: 11.2
          },
          {
            country: 'GB',
            dataSource: 'source1',
            request: 2000,
            response: 1900,
            impression: 1500,
            click: 60,
            fillRate: 95.0,
            impressionRate: 78.95,
            clickRate: 4.0,
            ecpm: 3.2,
            revenue: 4.8
          },
          {
            country: 'CA',
            dataSource: 'source3',
            request: 1200,
            response: 1100,
            impression: 900,
            click: 36,
            fillRate: 91.67,
            impressionRate: 81.82,
            clickRate: 4.0,
            ecpm: 2.76,
            revenue: 2.48
          }
        ]
      },
      {
        url: 'https://demo-app-alpha.example.com/ad/interstitial',
        request: 5300,
        response: 4900,
        impression: 4000,
        click: 160,
        fillRate: 92.45,
        impressionRate: 81.63,
        clickRate: 4.0,
        ecpm: 3.18,
        revenue: 12.72,
        countryDetails: [
          {
            country: 'US',
            dataSource: 'source1',
            request: 3000,
            response: 2800,
            impression: 2300,
            click: 92,
            fillRate: 93.33,
            impressionRate: 82.14,
            clickRate: 4.0,
            ecpm: 3.2,
            revenue: 7.36
          },
          {
            country: 'AU',
            dataSource: 'source4',
            request: 2300,
            response: 2100,
            impression: 1700,
            click: 68,
            fillRate: 91.3,
            impressionRate: 80.95,
            clickRate: 4.0,
            ecpm: 3.15,
            revenue: 5.36
          }
        ]
      }
    ]
  },
  {
    appId: 'app_002',
    appName: 'Demo App Beta',
    username: 'demo_user2',
    request: 8400,
    response: 7700,
    impression: 6200,
    click: 248,
    fillRate: 91.67,
    impressionRate: 80.52,
    clickRate: 4.0,
    ecpm: 2.9,
    revenue: 17.98,
    urlDetails: [
      {
        url: 'https://demo-app-beta.example.com/ad/native',
        request: 8400,
        response: 7700,
        impression: 6200,
        click: 248,
        fillRate: 91.67,
        impressionRate: 80.52,
        clickRate: 4.0,
        ecpm: 2.9,
        revenue: 17.98,
        countryDetails: [
          {
            country: 'JP',
            dataSource: 'source5',
            request: 5000,
            response: 4600,
            impression: 3700,
            click: 148,
            fillRate: 92.0,
            impressionRate: 80.43,
            clickRate: 4.0,
            ecpm: 3.0,
            revenue: 11.1
          },
          {
            country: 'KR',
            dataSource: 'source5',
            request: 3400,
            response: 3100,
            impression: 2500,
            click: 100,
            fillRate: 91.18,
            impressionRate: 80.65,
            clickRate: 4.0,
            ecpm: 2.75,
            revenue: 6.88
          }
        ]
      }
    ]
  }
];

/**
 * 每日数据统计主接口（SSE流式，Mock版本）
 */
export async function handleDailyStatsStream(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');

  if (!date) {
    return new Response(
      JSON.stringify({
        code: 400,
        message: '缺少日期参数，请提供 date 参数（格式：YYYY-MM-DD）',
        data: null
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return new Response(
      JSON.stringify({
        code: 400,
        message: '日期格式错误，请使用 YYYY-MM-DD 格式',
        data: null
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  const { readable, sendEvent, writer } = createSSEStream();

  (async () => {
    try {
      // 步骤1: 获取用户列表（mock）
      await sendEvent('progress', {
        step: 1,
        message: '正在获取用户列表...',
        status: 'processing'
      });
      await sendEvent('progress', {
        step: 1,
        message: '获取用户列表完成（共2个用户）',
        status: 'success',
        data: { users: ['demo_user1', 'demo_user2'] }
      });

      // 步骤2: 获取应用URL映射（mock）
      await sendEvent('progress', {
        step: 2,
        message: '正在获取应用URL映射...',
        status: 'processing',
        progress: { current: 0, total: 2 }
      });
      await sendEvent('progress', {
        step: 2,
        message: '获取应用URL映射完成（共2个应用）',
        status: 'success',
        data: {
          appMappings: [
            {
              username: 'demo_user1',
              appId: 'app_001',
              appName: 'Demo App Alpha',
              urls: []
            },
            {
              username: 'demo_user2',
              appId: 'app_002',
              appName: 'Demo App Beta',
              urls: []
            }
          ]
        }
      });

      // 步骤3: 获取广告数据（mock）
      await sendEvent('progress', {
        step: 3,
        message: '正在获取广告数据...',
        status: 'processing'
      });
      await sendEvent('progress', {
        step: 3,
        message: 'mock source1: 3条',
        status: 'success'
      });
      await sendEvent('progress', {
        step: 3,
        message: 'mock source3: 1条',
        status: 'success'
      });
      await sendEvent('progress', {
        step: 3,
        message: 'mock source4: 1条',
        status: 'success'
      });
      await sendEvent('progress', {
        step: 3,
        message: 'mock source5: 2条',
        status: 'success'
      });
      await sendEvent('progress', {
        step: 3,
        message: 'mock source6: 0条',
        status: 'success'
      });

      // 步骤4: 数据聚合（mock）
      await sendEvent('progress', {
        step: 4,
        message: '正在聚合数据...',
        status: 'processing'
      });
      await sendEvent('progress', {
        step: 4,
        message: `数据聚合完成共${MOCK_DATA.length}个应用，0个未匹配URL`,
        status: 'success'
      });

      // 发送最终结果
      await sendEvent('complete', {
        code: 0,
        message: 'success',
        data: {
          date,
          list: MOCK_DATA,
          unmatchedUrls: []
        }
      });
    } catch (error) {
      await sendEvent('error', {
        code: 5000,
        message: error instanceof Error ? error.message : '服务器内部错误',
        data: null
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
