import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { GlobalHttpModule } from './common/http/http.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { ClsModule } from './common/cls/cls.module';
import { CommonModule } from './modules/common/common.module';
import { WechatMpModule } from './modules/wechat-mp/wechat-mp.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    ScheduleModule.forRoot(),
    GlobalHttpModule,
    PrismaModule,
    ClsModule,
    CommonModule,
    WechatMpModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
