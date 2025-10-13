import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CloudApiModule } from './cloud-api/cloud-api.module';
import { PaymentModule } from './payment/payment.module';
import { OrderModule } from './order/order.module';
import { UnitelModule } from './unitel/unitel.module';
import { MobicomModule } from './mobicom/mobicom.module';

/**
 * 微信小程序模块聚合
 * 包含认证、用户、云调用、支付、订单、运营商（Unitel、Mobicom）等功能
 */
@Module({
  imports: [
    AuthModule,
    UserModule,
    CloudApiModule,
    PaymentModule,
    OrderModule,
    UnitelModule,
    MobicomModule,
  ],
  exports: [
    AuthModule,
    UserModule,
    CloudApiModule,
    PaymentModule,
    OrderModule,
    UnitelModule,
    MobicomModule,
  ],
})
export class WechatMpModule {}
