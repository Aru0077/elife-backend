import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { sanitizeHeaders, sanitizeBody } from '../utils/sanitize.util';
import { ClsService } from '../cls/cls.service';

@Injectable()
export class HttpLoggingService implements OnModuleInit {
  private readonly logger = new Logger('HTTP-OUT');

  constructor(
    private readonly httpService: HttpService,
    @Inject(ClsService) private readonly clsService: ClsService,
  ) {}

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

        // 过滤掉发往 CLS 的请求，避免"日志的日志"循环
        if (config.url?.includes('cls.tencentyun.com')) {
          return config;
        }

        const logData = {
          type: 'outbound',
          stage: 'request',
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          headers: sanitizeHeaders(config.headers),
          params: config.params as Record<string, unknown> | undefined,
          data: sanitizeBody(config.data),
        };

        this.logger.log(logData);
        this.clsService.addLog(JSON.stringify(logData));

        return config;
      },
      (error: Error) => {
        const errorLog = {
          type: 'outbound',
          stage: 'request_error',
          error: error.message,
        };

        this.logger.error(errorLog);
        this.clsService.addLog(JSON.stringify(errorLog));

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

        // 过滤掉发往 CLS 的响应，避免"日志的日志"循环
        if (response.config.url?.includes('cls.tencentyun.com')) {
          return response;
        }

        const logData = {
          type: 'outbound',
          stage: 'response',
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
          headers: sanitizeHeaders(response.headers),
          data: sanitizeBody(response.data),
          responseTime: `${duration}ms`,
        };

        this.logger.log(logData);
        this.clsService.addLog(JSON.stringify(logData));

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

        const errorLog = {
          type: 'outbound',
          stage: 'response_error',
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          error: error.message,
          data: sanitizeBody(error.response?.data),
          responseTime: duration > 0 ? `${duration}ms` : undefined,
        };

        this.logger.error(errorLog);
        this.clsService.addLog(JSON.stringify(errorLog));

        return Promise.reject(error);
      },
    );
  }
}
