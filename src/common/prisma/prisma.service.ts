import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('数据库连接成功');
    } catch (error) {
      const err = error as Error;
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('数据库连接失败', {
          message: err.message,
          stack: err.stack,
        });
        throw error;
      } else {
        this.logger.warn('数据库连接失败 (开发环境)', {
          message: err.message,
          stack: err.stack,
        });
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
