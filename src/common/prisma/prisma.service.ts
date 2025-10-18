import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  /**
   * 数据库连接重试机制
   */
  private async connectWithRetry() {
    const maxRetries =
      this.configService.get<number>('database.maxRetries') || 5;
    const retryDelay =
      this.configService.get<number>('database.retryDelay') || 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('数据库连接成功');
        return;
      } catch (error) {
        const err = error as Error;
        this.logger.error(`数据库连接失败 (尝试 ${attempt}/${maxRetries})`, {
          message: err.message,
          stack: err.stack,
        });

        if (attempt === maxRetries) {
          this.logger.error('数据库连接失败，所有重试已用尽');
          throw error;
        }

        this.logger.log(`等待 ${retryDelay}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  /**
   * 数据库操作重试包装器
   * 用于处理临时性数据库错误（连接丢失、死锁等）
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 1000,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const err = error as any;

        // 判断是否为可重试的错误
        const isRetryable =
          err.code === 'P2024' || // Timed out
          err.code === 'P2034' || // Transaction conflict
          err.message?.includes('ECONNRESET') ||
          err.message?.includes('Connection lost') ||
          err.message?.includes('ETIMEDOUT');

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(`数据库操作失败，重试中 (${attempt}/${maxRetries})`, {
          error: err.message,
          code: err.code,
        });

        // 指数退避重试
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
    throw new Error('Should not reach here');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
