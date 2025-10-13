import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface WechatApiResponse {
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
}

/**
 * 微信云调用 API 服务
 *
 * 使用微信云托管「开放接口服务」免鉴权调用微信API
 * 自动通过云托管环境注入的身份信息进行认证
 */
@Injectable()
export class CloudApiService {
  private readonly logger = new Logger(CloudApiService.name);

  constructor(private httpService: HttpService) {
    this.logger.log('微信云调用服务初始化 - 使用云托管开放接口服务');
  }

  /**
   * 调用微信 API
   *
   * @param url API 路径,如 '/wxa/getwxacode'
   * @param params 请求参数
   * @param method 'GET' | 'POST'
   * @param fromAppid 资源复用场景: 指定其他小程序/公众号身份
   *
   * @example
   * // 基本调用
   * await wechatService.callWechatApi('/wxa/getwxacode', { path: 'pages/index/index' }, 'POST');
   *
   * // 资源复用场景
   * await wechatService.callWechatApi('/wxa/getwxacode', { path: 'pages/index/index' }, 'POST', 'wxBBBB');
   */
  async callWechatApi(
    url: string,
    params?: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET',
    fromAppid?: string, // 资源复用: 指定其他 AppID
  ): Promise<WechatApiResponse> {
    const fullUrl = this.buildApiUrl(url, fromAppid);

    try {
      const requestConfig = this.buildRequestConfig(params, method);

      const response =
        method === 'GET'
          ? await firstValueFrom(
              this.httpService.get<WechatApiResponse>(fullUrl, requestConfig),
            )
          : await firstValueFrom(
              this.httpService.post<WechatApiResponse>(
                fullUrl,
                requestConfig.data,
                { params: requestConfig.params },
              ),
            );

      // 检查是否使用了云调用链路
      const seqId = response.headers['x-openapi-seqid'] as string | undefined;
      if (seqId) {
        this.logger.log({
          message: '✅ 使用了云调用链路',
          seqId,
          url: fullUrl,
        });
      } else {
        this.logger.warn({
          message: '⚠️ 未检测到云调用链路标识',
          url: fullUrl,
          hint: '请确认已在云托管控制台开启「开放接口服务」',
        });
      }

      // 检查业务错误
      if (response.data.errcode && response.data.errcode !== 0) {
        throw new Error(
          `微信API调用失败: ${response.data.errmsg ?? 'unknown error'}`,
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error('微信API调用失败', {
        url: fullUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * 构建 API URL
   *
   * @param url API 路径
   * @param fromAppid 资源复用: 指定其他 AppID
   * @returns 完整 URL
   */
  private buildApiUrl(url: string, fromAppid?: string): string {
    // 云托管环境使用 HTTP 协议（开放接口服务自动处理 HTTPS）
    let fullUrl = `http://api.weixin.qq.com${url}`;

    // 资源复用场景: 添加 from_appid 参数
    if (fromAppid) {
      const separator = url.includes('?') ? '&' : '?';
      fullUrl += `${separator}from_appid=${fromAppid}`;
      this.logger.log(`使用资源复用, from_appid=${fromAppid}`);
    }

    return fullUrl;
  }

  /**
   * 构建请求配置
   *
   * 云托管环境通过开放接口服务自动注入身份信息，无需手动传递 token
   */
  private buildRequestConfig(
    params?: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET',
  ): {
    params?: Record<string, unknown>;
    data?: Record<string, unknown>;
  } {
    this.logger.debug('使用云托管开放接口服务 (免鉴权)');

    return method === 'POST'
      ? { data: params, params: {} }
      : { params: params ?? {} };
  }
}
