import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { OrderModule } from '@modules/wechat-mp/order/order.module';
import { PrismaModule } from '@common/prisma/prisma.module';
import { GlobalHttpModule } from '@common/http/http.module';
import { UserModule } from '@modules/wechat-mp/user/user.module';

@Module({
  imports: [OrderModule, PrismaModule, GlobalHttpModule, UserModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
