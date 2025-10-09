import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';

export interface WechatApiResponse {
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
}

interface AccessTokenResponse extends WechatApiResponse {
  access_token?: string;
}

/**
 * 微信API调用服务
 *
 * 支持两种模式:
 * 1. 云托管环境: 使用「开放接口服务」免鉴权 (推荐)
 * 2. 本地开发: 使用传统 access_token
 */
@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);
  private readonly isCloudRun: boolean;
  private readonly useOpenApiService: boolean; // 是否使用开放接口服务

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    // 检测是否在微信云托管环境 (通过环境变量判断)
    this.isCloudRun =
      process.env.KUBERNETES_SERVICE_HOST !== undefined ||
      fs.existsSync('/.tencentcloudbase');

    // 云托管环境默认使用开放接口服务
    this.useOpenApiService = this.isCloudRun;

    this.logger.log({
      message: '微信服务初始化',
      isCloudRun: this.isCloudRun,
      useOpenApiService: this.useOpenApiService,
    });
  }

  /**
   * 调用微信 API
   *
   * @param url API 路径,如 '/wxa/getwxacode'
   * @param type 'miniprogram' | 'mp'
   * @param params 请求参数
   * @param method 'GET' | 'POST'
   * @param fromAppid 资源复用场景: 指定其他小程序/公众号身份
   *
   * @example
   * // 云托管环境 (自动使用开放接口服务)
   * await wechatService.callWechatApi('/wxa/getwxacode', 'miniprogram', { path: 'pages/index/index' }, 'POST');
   *
   * // 资源复用场景
   * await wechatService.callWechatApi('/wxa/getwxacode', 'miniprogram', { path: 'pages/index/index' }, 'POST', 'wxBBBB');
   */
  async callWechatApi(
    url: string,
    type: 'miniprogram' | 'mp' = 'miniprogram',
    params?: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET',
    fromAppid?: string, // 资源复用: 指定其他 AppID
  ): Promise<WechatApiResponse> {
    const fullUrl = this.buildApiUrl(url, fromAppid);

    try {
      const requestConfig = await this.buildRequestConfig(type, params, method);

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
    // 云托管环境使用 HTTP（开放接口服务），本地开发使用 HTTPS
    const protocol = this.useOpenApiService ? 'http' : 'https';
    let fullUrl = `${protocol}://api.weixin.qq.com${url}`;

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
   * 云托管环境: 不需要任何 token (开放接口服务自动处理)
   * 本地开发: 使用传统 access_token
   */
  private async buildRequestConfig(
    type: 'miniprogram' | 'mp',
    params?: Record<string, unknown>,
    method: 'GET' | 'POST' = 'GET',
  ): Promise<{
    params?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }> {
    if (this.useOpenApiService) {
      // 云托管环境: 使用开放接口服务,不需要 token
      this.logger.debug('使用开放接口服务 (免鉴权)');

      return method === 'POST'
        ? { data: params, params: {} }
        : { params: params ?? {} };
    }

    // 本地开发: 使用传统 access_token
    const accessToken = await this.getAccessToken(type);

    return method === 'POST'
      ? {
          data: params,
          params: { access_token: accessToken },
        }
      : {
          params: { ...params, access_token: accessToken },
        };
  }

  /**
   * 获取 access_token (仅本地开发使用)
   * 云托管环境使用开放接口服务,不需要此方法
   */
  private async getAccessToken(type: 'miniprogram' | 'mp'): Promise<string> {
    const config = this.configService.get(`wechat.${type}`) as {
      appid: string;
      secret: string;
    };
    const { appid, secret } = config;

    if (!appid || !secret) {
      throw new Error(`缺少${type}配置: WECHAT_APPID 或 WECHAT_SECRET`);
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<AccessTokenResponse>(
          'https://api.weixin.qq.com/cgi-bin/token',
          {
            params: {
              grant_type: 'client_credential',
              appid,
              secret,
            },
          },
        ),
      );

      if (response.data.errcode) {
        throw new Error(
          `获取access_token失败: ${response.data.errmsg ?? 'unknown error'}`,
        );
      }

      if (!response.data.access_token) {
        throw new Error('获取access_token失败: access_token 为空');
      }

      this.logger.debug(`本地开发: 获取到 access_token`);
      return response.data.access_token;
    } catch (error) {
      const err = error as Error;
      this.logger.error('获取access_token失败', {
        message: err.message,
        stack: err.stack,
      });
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * 检查当前环境
   */
  getEnvironmentInfo() {
    return {
      isCloudRun: this.isCloudRun,
      useOpenApiService: this.useOpenApiService,
      mode: this.useOpenApiService
        ? '开放接口服务 (免鉴权)'
        : '传统 access_token',
    };
  }
}
