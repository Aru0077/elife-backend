import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { GlobalHttpModule } from './common/http/http.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { WechatModule } from './modules/wechat/wechat.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { OrderModule } from './modules/order/order.module';
import { UnitelModule } from './modules/unitel/unitel.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ProductModule } from './modules/product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    ScheduleModule.forRoot(),
    GlobalHttpModule,
    PrismaModule,
    WechatModule,
    HealthModule,
    AuthModule,
    UserModule,
    ProductModule,
    OrderModule,
    PaymentModule,
    StatisticsModule,
    UnitelModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
