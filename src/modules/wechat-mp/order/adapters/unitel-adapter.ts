import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Order } from '@prisma/client';
import { UnitelService } from '@modules/wechat-mp/unitel/unitel.service';
import {
  ServiceTypeResponse,
  ServiceCard,
  DataPackage,
} from '@modules/wechat-mp/unitel/dto';
import { Operator, RechargeType } from '../enums';
import {
  OperatorAdapter,
  ProductInfo,
  RechargeResult,
  PostpaidBillInfo,
} from './operator-adapter.interface';

/**
 * Unitel 运营商适配器
 * 封装 Unitel 特定的业务逻辑
 */
@Injectable()
export class UnitelAdapter implements OperatorAdapter {
  private readonly logger = new Logger(UnitelAdapter.name);

  constructor(private readonly unitelService: UnitelService) {}

  /**
   * 获取运营商名称
   */
  getOperatorName(): Operator {
    return Operator.UNITEL;
  }

  /**
   * 验证商品并获取商品详情
   */
  async validateAndGetProduct(
    productCode: string,
    phoneNumber: string,
    rechargeType: string,
  ): Promise<ProductInfo> {
    try {
      // 调用 Unitel API 获取最新资费列表
      this.logger.log({
        message: 'Unitel 获取资费列表',
        msisdn: phoneNumber,
        productCode,
        rechargeType,
      });

      const serviceData = await this.unitelService.getServiceTypes({
        msisdn: phoneNumber,
        info: '1', // 获取详细资费信息
      });

      // 从资费列表中查找商品
      const product = this.findProductByCode(serviceData, productCode);

      if (!product) {
        throw new BadRequestException(`商品代码 ${productCode} 不存在或已下架`);
      }

      // 转换为统一的 ProductInfo 格式
      const productInfo: ProductInfo = {
        code: product.code,
        name: product.name,
        engName: product.eng_name,
        price: product.price,
        unit: 'unit' in product ? product.unit : undefined,
        data: product.data,
        days: product.days,
      };

      this.logger.log({
        message: 'Unitel 商品信息获取成功',
        productCode,
        productName: productInfo.name,
        engName: productInfo.engName,
        price: productInfo.price,
      });

      return productInfo;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Unitel 获取商品信息失败', {
        message: err.message,
        stack: err.stack,
        productCode,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * 执行充值操作
   */
  async recharge(order: Order): Promise<RechargeResult> {
    try {
      let result;

      // 构造统一的交易信息
      const transactions = [
        {
          journal_id: order.orderNumber,
          amount: order.productPriceTg.toString(),
          description: this.getDescription(order.productRechargeType),
          account: '',
        },
      ];

      if (order.productRechargeType === (RechargeType.DATA as string)) {
        // 流量包激活
        this.logger.log({
          message: 'Unitel 调用流量包激活 API',
          orderNumber: order.orderNumber,
          msisdn: order.phoneNumber,
          package: order.productCode,
          amount: order.productPriceTg.toString(),
        });

        result = await this.unitelService.activateDataPackage({
          msisdn: order.phoneNumber,
          package: order.productCode,
          vatflag: '1',
          vat_register_no: '',
          transactions,
        });
      } else if (
        order.productRechargeType === (RechargeType.POSTPAID as string)
      ) {
        // 后付费账单支付
        this.logger.log({
          message: 'Unitel 调用后付费账单支付 API',
          orderNumber: order.orderNumber,
          msisdn: order.phoneNumber,
          amount: order.productPriceTg.toString(),
        });

        result = await this.unitelService.payPostpaidBill({
          msisdn: order.phoneNumber,
          amount: order.productPriceTg.toString(),
          remark: 'Bill Payment via WeChat',
          vatflag: '1',
          vat_register_no: '',
          transactions,
        });
      } else {
        // 话费充值 (VOICE)
        this.logger.log({
          message: 'Unitel 调用话费充值 API',
          orderNumber: order.orderNumber,
          msisdn: order.phoneNumber,
          card: order.productCode,
          amount: order.productPriceTg.toString(),
        });

        result = await this.unitelService.recharge({
          msisdn: order.phoneNumber,
          card: order.productCode,
          vatflag: '1',
          vat_register_no: '',
          transactions,
        });
      }

      // 处理运营商返回的状态
      let finalResult: 'success' | 'failed' | 'pending';

      if (result.result === 'success') {
        finalResult = 'success';
      } else if (result.result === 'failed') {
        finalResult = 'failed';
      } else if (result.result === 'pending' || !result.result) {
        // 状态不明确或为空，标记为 pending
        finalResult = 'pending';
        this.logger.warn('Unitel 返回状态不明确', {
          orderNumber: order.orderNumber,
          apiResult: result.result,
          apiCode: result.code,
          apiMsg: result.msg,
          seqId: result.seq_id,
        });
      } else {
        // 未知状态，保守标记为 failed
        finalResult = 'failed';
        this.logger.error('Unitel 返回未知状态', {
          orderNumber: order.orderNumber,
          apiResult: result.result,
          apiCode: result.code,
          apiMsg: result.msg,
        });
      }

      // 转换为统一的充值结果格式
      const rechargeResult: RechargeResult = {
        result: finalResult,
        code: result.code,
        msg: result.msg,
        seqId: result.seq_id,
        transactionId: result.transaction_id,
      };

      this.logger.log({
        message: `Unitel 充值${rechargeResult.result === 'success' ? '成功' : rechargeResult.result === 'pending' ? '处理中' : '失败'}`,
        orderNumber: order.orderNumber,
        rechargeType: order.productRechargeType,
        result: rechargeResult.result,
        code: rechargeResult.code,
        msg: rechargeResult.msg,
        seqId: rechargeResult.seqId,
      });

      return rechargeResult;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Unitel 充值异常', {
        message: err.message,
        stack: err.stack,
        orderNumber: order.orderNumber,
        rechargeType: order.productRechargeType,
      });
      throw error;
    }
  }

  /**
   * 根据充值类型获取交易描述
   */
  private getDescription(rechargeType: string): string {
    const descriptionMap: Record<string, string> = {
      [RechargeType.VOICE]: 'Recharge',
      [RechargeType.DATA]: 'Data Package',
      [RechargeType.POSTPAID]: 'Bill Payment',
    };
    return descriptionMap[rechargeType] || 'Recharge';
  }

  /**
   * 获取后付费账单信息
   */
  async getPostpaidBill(phoneNumber: string): Promise<PostpaidBillInfo> {
    try {
      this.logger.log({
        message: 'Unitel 获取后付费账单',
        phoneNumber,
      });

      const billData = await this.unitelService.getPostpaidBill({
        owner: phoneNumber,
        msisdn: phoneNumber,
      });

      // 转换为统一的账单信息格式
      const billInfo: PostpaidBillInfo = {
        totalUnpaid: billData.total_unpaid || 0,
        invoiceStatus: billData.invoice_status,
        invoiceAmount: billData.invoice_amount,
        invoiceDate: billData.invoice_date,
        remainAmount: billData.remain_amount,
        broadcastFee: billData.broadcast_fee,
        invoiceUnpaid: billData.invoice_unpaid,
      };

      this.logger.log({
        message: 'Unitel 账单信息获取成功',
        phoneNumber,
        totalUnpaid: billInfo.totalUnpaid,
        invoiceStatus: billInfo.invoiceStatus,
      });

      return billInfo;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Unitel 获取账单信息失败', {
        message: err.message,
        stack: err.stack,
        phoneNumber,
      });
      throw error;
    }
  }

  /**
   * 从资费列表中查找商品（私有方法）
   */
  private findProductByCode(
    serviceData: ServiceTypeResponse,
    productCode: string,
  ): ServiceCard | DataPackage | undefined {
    // 合并所有可能的商品列表
    const allProducts: (ServiceCard | DataPackage)[] = [
      ...(serviceData.service?.cards?.day || []),
      ...(serviceData.service?.cards?.noday || []),
      ...(serviceData.service?.cards?.special || []),
      ...(serviceData.service?.data?.data || []),
      ...(serviceData.service?.data?.days || []),
      ...(serviceData.service?.data?.entertainment || []),
    ];

    return allProducts.find((p) => p.code === productCode);
  }
}
