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
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('数据库连接失败', error);
        throw error;
      } else {
        this.logger.warn('数据库连接失败 (开发环境)', error);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
