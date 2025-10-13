import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from '@modules/wechat-mp/order/order.service';
import { PaymentService } from './payment.service';
import { WechatAuthGuard } from '@modules/wechat-mp/auth/guards/wechat-auth.guard';
import { CurrentUser } from '@modules/wechat-mp/auth/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreatePaymentDto, PaymentCallbackDto } from './dto';

/**
 * 支付 Controller
 * - 创建支付订单接口需要认证
 * - 微信支付回调接口不需要认证
 */
@ApiTags('支付')
@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly orderService: OrderService,
  ) {}

  /**
   * 创建支付订单
   * 调用微信统一下单接口，返回小程序支付参数
   */
  @Post('create')
  @UseGuards(WechatAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建支付订单' })
  async createPayment(
    @CurrentUser() user: User,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return await this.paymentService.createPayment(
      createPaymentDto.orderNumber,
      user.openid,
    );
  }

  /**
   * 微信支付回调接口
   * 重要：此接口由微信服务器调用，不需要用户认证
   * 必须返回 { errcode: 0 } 格式，否则微信会持续重试
   */
  @Post('callback/:orderNumber')
  @ApiOperation({ summary: '微信支付回调' })
  async wechatCallback(
    @Param('orderNumber') orderNumber: string,
    @Body() callbackData: PaymentCallbackDto,
  ) {
    try {
      this.logger.log({
        message: '收到微信支付回调',
        orderNumber,
        returnCode: callbackData.returnCode,
        resultCode: callbackData.resultCode,
        transactionId: callbackData.transactionId,
      });

      // 验证回调数据
      if (
        callbackData.returnCode !== 'SUCCESS' ||
        callbackData.resultCode !== 'SUCCESS'
      ) {
        this.logger.warn({
          message: '支付回调状态非成功',
          orderNumber,
          callbackData,
        });
        // 即使支付失败也要返回成功，避免微信重复回调
        return { errcode: 0, errmsg: 'ok' };
      }

      // 调用订单服务处理支付成功的逻辑
      await this.orderService.handleWechatCallback(orderNumber);

      // 返回成功
      return { errcode: 0, errmsg: 'ok' };
    } catch (error) {
      const err = error as Error;
      this.logger.error('处理支付回调异常', {
        orderNumber,
        error: err.message,
        stack: err.stack,
      });
      // 即使异常也返回成功，避免微信持续重试
      // 实际问题通过日志和定时任务补偿处理
      return { errcode: 0, errmsg: 'ok' };
    }
  }
}
