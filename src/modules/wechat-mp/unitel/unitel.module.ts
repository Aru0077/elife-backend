import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UnitelService } from './unitel.service';
import { UnitelController } from './unitel.controller';

/**
 * Unitel 运营商模块
 * 包含 Unitel API 调用、产品查询等功能
 * 注意：订单模块已移至 wechat-mp 根层级，所有运营商共用
 */
@Module({
  imports: [HttpModule],
  controllers: [UnitelController],
  providers: [UnitelService],
  exports: [UnitelService],
})
export class UnitelModule {}
