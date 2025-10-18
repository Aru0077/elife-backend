import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 时间窗口：60秒
        limit: 100, // 默认限制：每60秒100次请求（全局默认值，可被覆盖）
      },
    ]),
    GlobalHttpModule,
    PrismaModule,
    ClsModule,
    CommonModule,
    WechatMpModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // 全局应用限流守卫
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
