import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
   * 限流: 每分钟最多20次（防止恶意刷单）
   */
  @Post('create')
  @UseGuards(WechatAuthGuard)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
   * 注意：跳过限流（由微信服务器调用）
   */
  @Post('callback/:orderNumber')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  @Throttle({ default: { limit: 0 } }) // 跳过限流
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
        totalFee: callbackData.totalFee,
        attach: callbackData.attach,
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

      // 验证 attach 字段（订单号一致性检查）
      if (callbackData.attach) {
        try {
          const attachData = JSON.parse(callbackData.attach) as {
            orderNumber?: string;
            phoneNumber?: string;
          };
          if (
            attachData.orderNumber &&
            attachData.orderNumber !== orderNumber
          ) {
            this.logger.error('attach中的订单号与URL参数不一致', {
              urlOrderNumber: orderNumber,
              attachOrderNumber: attachData.orderNumber,
              attach: callbackData.attach,
            });
            // 仍返回成功避免重复回调，但记录严重错误
          }
        } catch (error) {
          this.logger.warn('attach字段解析失败', {
            attach: callbackData.attach,
            error: (error as Error).message,
          });
        }
      }

      // 查询订单并验证金额
      const order = await this.orderService.findOne(orderNumber);

      // 验证支付金额是否与订单金额一致（转换为分）
      if (callbackData.totalFee !== undefined) {
        const expectedAmount = Math.round(Number(order.productPriceRmb) * 100);
        if (callbackData.totalFee !== expectedAmount) {
          this.logger.error('支付金额不匹配', {
            orderNumber,
            expectedAmount,
            actualAmount: callbackData.totalFee,
            orderPriceRmb: order.productPriceRmb.toString(),
            orderPriceTg: order.productPriceTg.toString(),
            差额: callbackData.totalFee - expectedAmount,
          });
          // 关键: 仍返回成功避免微信重复回调
          // 但不处理此订单，通过日志记录异常
          return { errcode: 0, errmsg: 'ok' };
        }
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
