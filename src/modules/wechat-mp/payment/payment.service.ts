import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '@common/prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { WechatPayResponse, PaymentInfo } from './interfaces/payment.interface';

/**
 * 微信支付服务
 * 负责调用微信云托管的支付接口
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  // 微信支付接口地址（开放接口服务）
  private readonly WECHAT_PAY_API = 'http://api.weixin.qq.com/_/pay';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 创建支付订单（调用统一下单接口）
   * @param orderNumber 订单号
   * @param openid 用户openid
   * @returns 小程序支付参数
   */
  async createPayment(
    orderNumber: string,
    openid: string,
  ): Promise<PaymentInfo> {
    try {
      // 1. 查询订单
      const order = await this.prisma.order.findUnique({
        where: { orderNumber },
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      // 2. 验证订单所有权
      if (order.openid !== openid) {
        throw new BadRequestException('无权操作此订单');
      }

      // 3. 验证订单状态
      if (order.paymentStatus === 'paid') {
        throw new BadRequestException('订单已支付');
      }

      // 4. 构造统一下单参数
      const unifiedOrderData = {
        openid: openid,
        body: `境外话费充值 - ${order.productName}`,
        out_trade_no: orderNumber,
        total_fee: Math.round(Number(order.productPriceRmb) * 100), // 转换为分
        spbill_create_ip: this.getServerIp(),
        sub_mch_id: this.configService.get<string>('wechat.payment.mchId'),
        env_id: this.configService.get<string>('wechat.payment.envId'),
        callback_type: 2, // 2 表示云托管
        trade_type: 'JSAPI',
        attach: JSON.stringify({
          orderNumber: orderNumber,
          phoneNumber: order.phoneNumber,
        }),
        container: {
          service: this.configService.get<string>(
            'wechat.payment.callbackService',
          ),
          path: this.configService.get<string>('wechat.payment.callbackPath'),
        },
      };

      this.logger.log({
        message: '调用统一下单接口',
        orderNumber,
        totalFee: unifiedOrderData.total_fee,
      });

      // 5. 调用微信统一下单接口（使用开放接口服务，免token）
      const response = await firstValueFrom(
        this.httpService.post<WechatPayResponse>(
          `${this.WECHAT_PAY_API}/unifiedOrder`,
          unifiedOrderData,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30秒超时
          },
        ),
      );

      // 6. 解析响应
      const { errcode, errmsg, respdata } = response.data;

      if (errcode !== 0 || !respdata) {
        this.logger.error('统一下单失败', {
          message: errmsg || '未知错误',
          errcode,
          orderNumber,
          openid,
          total_fee: unifiedOrderData.total_fee,
        });
        throw new HttpException(
          errmsg || '创建支付订单失败',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 7. 检查业务结果
      if (
        respdata.return_code !== 'SUCCESS' ||
        respdata.result_code !== 'SUCCESS'
      ) {
        this.logger.error('统一下单业务失败', {
          message: respdata.err_code_des || respdata.return_msg || '业务失败',
          return_code: respdata.return_code,
          result_code: respdata.result_code,
          err_code: respdata.err_code,
          orderNumber,
          openid,
        });
        throw new HttpException(
          respdata.err_code_des || respdata.return_msg || '创建支付订单失败',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 8. 提取 payment 对象
      if (!respdata.payment) {
        this.logger.error('统一下单返回缺少 payment 字段', {
          message: '微信返回数据异常：缺少 payment 字段',
          orderNumber,
          openid,
          prepay_id: respdata.prepay_id,
        });
        throw new HttpException(
          '支付参数获取失败',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log({
        message: '统一下单成功',
        orderNumber,
        prepay_id: respdata.prepay_id,
        total_fee: unifiedOrderData.total_fee,
        openid,
      });

      // 9. 返回小程序支付参数
      return respdata.payment;
    } catch (error) {
      const err = error as Error;
      this.logger.error('创建支付订单异常', {
        message: err.message,
        stack: err.stack,
        orderNumber,
        openid,
      });
      throw error;
    }
  }

  /**
   * 获取服务器 IP（用于 spbill_create_ip）
   * 云托管环境可以使用固定值
   */
  private getServerIp(): string {
    // 在云托管环境中可以使用固定值
    // 也可以尝试从环境变量或请求中获取
    return (
      this.configService.get<string>('wechat.payment.serverIp') || '127.0.0.1'
    );
  }
}
