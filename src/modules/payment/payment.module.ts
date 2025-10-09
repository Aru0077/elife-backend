import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { OrderModule } from '../order/order.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { GlobalHttpModule } from '../../common/http/http.module';

@Module({
  imports: [OrderModule, PrismaModule, GlobalHttpModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
