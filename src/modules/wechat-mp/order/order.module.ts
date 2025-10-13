import { Module } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderTaskService } from './order-task.service';
import { PrismaModule } from '@common/prisma/prisma.module';
import { UnitelModule } from '@modules/wechat-mp/unitel/unitel.module';
import { UserModule } from '@modules/wechat-mp/user/user.module';

@Module({
  imports: [PrismaModule, UnitelModule, UserModule],
  controllers: [OrderController],
  providers: [OrderService, OrderTaskService],
  exports: [OrderService],
})
export class OrderModule {}
