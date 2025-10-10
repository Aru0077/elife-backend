import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  QueryServiceDto,
  ServiceTypeResponse,
  RechargeDto,
  RechargeResponse,
  DataPackageDto,
  DataPackageResponse,
} from './dto';

// Token 缓存
interface TokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class UnitelService {
  private readonly logger = new Logger(UnitelService.name);
  private tokenCache: TokenCache | null = null;

  // API 路径配置
  private readonly API_ENDPOINTS = {
    AUTH: '/auth',
    SERVICE_TYPE: '/service/servicetype',
    RECHARGE: '/service/recharge',
    DATA_PACKAGE: '/service/datapackage',
  };

  // HTTP 超时配置（30秒）
  private readonly HTTP_TIMEOUT = 30000;

  // Token 缓存时间（90秒，实际有效期2分钟，留10秒余量）
  private readonly TOKEN_CACHE_TIME = 90 * 1000;

  private readonly apiUrl: string;
  private readonly username: string;
  private readonly password: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get<string>('unitel.apiUrl')!;
    this.username = this.configService.get<string>('unitel.username')!;
    this.password = this.configService.get<string>('unitel.password')!;
  }

  /**
   * 获取 Access Token（带缓存和重试机制）
   */
  async getAccessToken(): Promise<string> {
    // 检查缓存
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    const maxRetries = 3;
    const retryDelay = 1000; // 1秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const auth = Buffer.from(`${this.username}:${this.password}`).toString(
          'base64',
        );

        const response = await firstValueFrom(
          this.httpService.post(
            `${this.apiUrl}${this.API_ENDPOINTS.AUTH}`,
            {},
            {
              headers: {
                Authorization: `Basic ${auth}`,
              },
              timeout: this.HTTP_TIMEOUT,
            },
          ),
        );

        const { access_token } = response.data as { access_token: string };

        if (!access_token) {
          throw new Error('No access token in response');
        }

        // 缓存 Token（90秒，实际有效期2分钟）
        this.tokenCache = {
          token: access_token,
          expiresAt: Date.now() + this.TOKEN_CACHE_TIME,
        };

        if (attempt > 1) {
          this.logger.log(`Unitel access token获取成功（第${attempt}次尝试）`);
        } else {
          this.logger.log('Unitel access token获取成功');
        }

        return access_token;
      } catch (error) {
        const err = error as Error;
        const isLastAttempt = attempt === maxRetries;

        if (isLastAttempt) {
          // 最后一次重试失败，记录严重错误
          this.logger.error('获取 Unitel access token 失败（所有重试已用尽）', {
            message: err.message,
            stack: err.stack,
            attempts: maxRetries,
          });
          throw new HttpException(
            'Failed to get Unitel access token after retries',
            HttpStatus.UNAUTHORIZED,
          );
        } else {
          // 非最后一次，记录警告并重试
          this.logger.warn(
            `获取 Unitel access token 失败，${retryDelay}ms 后重试`,
            {
              message: err.message,
              attempt,
              maxRetries,
            },
          );
          // 等待后重试
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // 理论上不会到达这里，但为了类型安全
    throw new HttpException(
      'Failed to get Unitel access token',
      HttpStatus.UNAUTHORIZED,
    );
  }

  /**
   * 查询资费列表
   */
  async getServiceTypes(dto: QueryServiceDto): Promise<ServiceTypeResponse> {
    const token = await this.getAccessToken();

    try {
      this.logger.debug({
        message: '查询资费列表请求',
        msisdn: dto.msisdn,
        info: dto.info,
      });

      const response = await firstValueFrom(
        this.httpService.post<ServiceTypeResponse>(
          `${this.apiUrl}${this.API_ENDPOINTS.SERVICE_TYPE}`,
          dto,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: this.HTTP_TIMEOUT,
          },
        ),
      );

      const data = response.data;

      if (data.result !== 'success') {
        throw new Error(`Unitel API error: ${data.code} - ${data.msg}`);
      }

      this.logger.debug({
        message: '查询资费列表成功',
        result: data.result,
        code: data.code,
        servicetype: data.servicetype,
        hasService: !!data.service,
      });

      return data;
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { status?: number; data?: { msg?: string } };
      };
      const errorMessage =
        err.response?.data?.msg || 'Failed to query service types';

      this.logger.error('查询 Unitel 资费列表失败', {
        message: err.message,
        stack: err.stack,
        status: err.response?.status,
        apiMessage: err.response?.data?.msg,
      });

      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 话费充值
   */
  async recharge(dto: RechargeDto): Promise<RechargeResponse> {
    const token = await this.getAccessToken();

    try {
      this.logger.log({
        message: '发起话费充值请求',
        msisdn: dto.msisdn,
        card: dto.card,
        journal_id: dto.transactions[0]?.journal_id,
      });

      const response = await firstValueFrom(
        this.httpService.post<RechargeResponse>(
          `${this.apiUrl}${this.API_ENDPOINTS.RECHARGE}`,
          dto,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: this.HTTP_TIMEOUT,
          },
        ),
      );

      const data = response.data;

      if (data.result !== 'success') {
        throw new Error(`Unitel API error: ${data.code} - ${data.msg}`);
      }

      this.logger.log({
        message: '话费充值成功',
        msisdn: dto.msisdn,
        card: dto.card,
        result: data.result,
        code: data.code,
        msg: data.msg,
        journal_id: dto.transactions[0]?.journal_id,
      });
      return data;
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { status?: number; data?: { msg?: string } };
      };
      const errorMessage = err.response?.data?.msg || 'Failed to recharge';

      this.logger.error('Unitel 话费充值失败', {
        message: err.message,
        stack: err.stack,
        status: err.response?.status,
        apiMessage: err.response?.data?.msg,
        msisdn: dto.msisdn,
        card: dto.card,
      });

      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * 流量包激活
   */
  async activateDataPackage(dto: DataPackageDto): Promise<DataPackageResponse> {
    const token = await this.getAccessToken();

    try {
      this.logger.log({
        message: '发起流量包激活请求',
        msisdn: dto.msisdn,
        package: dto.package,
        journal_id: dto.transactions[0]?.journal_id,
      });

      const response = await firstValueFrom(
        this.httpService.post<DataPackageResponse>(
          `${this.apiUrl}${this.API_ENDPOINTS.DATA_PACKAGE}`,
          dto,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: this.HTTP_TIMEOUT,
          },
        ),
      );

      const data = response.data;

      if (data.result !== 'success') {
        throw new Error(`Unitel API error: ${data.code} - ${data.msg}`);
      }

      this.logger.log({
        message: '流量包激活成功',
        msisdn: dto.msisdn,
        package: dto.package,
        result: data.result,
        code: data.code,
        msg: data.msg,
        journal_id: dto.transactions[0]?.journal_id,
      });
      return data;
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { status?: number; data?: { msg?: string } };
      };
      const errorMessage =
        err.response?.data?.msg || 'Failed to activate data package';

      this.logger.error('Unitel 流量包激活失败', {
        message: err.message,
        stack: err.stack,
        status: err.response?.status,
        apiMessage: err.response?.data?.msg,
        msisdn: dto.msisdn,
        package: dto.package,
      });

      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
