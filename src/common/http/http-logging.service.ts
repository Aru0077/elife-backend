import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { sanitizeHeaders, sanitizeBody } from '../utils/sanitize.util';

@Injectable()
export class HttpLoggingService implements OnModuleInit {
  private readonly logger = new Logger('HTTP-OUT');

  constructor(private readonly httpService: HttpService) {}

  onModuleInit() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    const axiosInstance = this.httpService.axiosRef;

    // 请求拦截器
    axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // @ts-expect-error - 添加自定义 metadata 字段
        config.metadata = { startTime: Date.now() };

        this.logger.log({
          type: 'outbound',
          stage: 'request',
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          headers: sanitizeHeaders(config.headers),
          params: config.params as Record<string, unknown> | undefined,
          data: sanitizeBody(config.data),
        });

        return config;
      },
      (error: Error) => {
        this.logger.error({
          type: 'outbound',
          stage: 'request_error',
          error: error.message,
        });
        return Promise.reject(error);
      },
    );

    // 响应拦截器
    axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        // @ts-expect-error - 读取自定义 metadata 字段
        const metadata = response.config.metadata as
          | { startTime: number }
          | undefined;
        const startTime = metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;

        this.logger.log({
          type: 'outbound',
          stage: 'response',
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
          headers: sanitizeHeaders(response.headers),
          data: sanitizeBody(response.data),
          responseTime: `${duration}ms`,
        });

        return response;
      },
      (
        error: Error & {
          config?: InternalAxiosRequestConfig;
          response?: AxiosResponse;
        },
      ) => {
        // @ts-expect-error - 读取自定义 metadata 字段
        const metadata = error.config?.metadata as
          | { startTime: number }
          | undefined;
        const startTime = metadata?.startTime;
        const duration = startTime ? Date.now() - startTime : 0;

        this.logger.error({
          type: 'outbound',
          stage: 'response_error',
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          error: error.message,
          data: sanitizeBody(error.response?.data),
          responseTime: duration > 0 ? `${duration}ms` : undefined,
        });

        return Promise.reject(error);
      },
    );
  }
}
