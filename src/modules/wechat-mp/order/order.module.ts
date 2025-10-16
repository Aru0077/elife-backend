import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderTaskService } from './order-task.service';
import { PrismaModule } from '@common/prisma/prisma.module';
import { UnitelModule } from '@modules/wechat-mp/unitel/unitel.module';
import { UserModule } from '@modules/wechat-mp/user/user.module';
import { ExchangeRateModule } from '@modules/common/exchange-rate/exchange-rate.module';
import { UnitelAdapter } from './adapters';

@Module({
  imports: [PrismaModule, UnitelModule, UserModule, ExchangeRateModule],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderTaskService,
    UnitelAdapter, // 注册运营商适配器
  ],
  exports: [OrderService],
})
export class OrderModule {}
