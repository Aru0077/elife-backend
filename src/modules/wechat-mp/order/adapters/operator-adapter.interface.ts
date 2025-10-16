import { Order } from '@prisma/client';
import { Operator } from '../enums';

/**
 * 运营商适配器接口
 * 用于统一不同运营商的订单处理逻辑
 */
export interface OperatorAdapter {
  /**
   * 获取运营商名称
   */
  getOperatorName(): Operator;

  /**
   * 验证商品并获取商品详情
   * @param productCode 商品代码
   * @param phoneNumber 手机号码
   * @param rechargeType 充值类型（'VOICE' | 'DATA' | 'POSTPAID'）
   * @returns 商品详情
   */
  validateAndGetProduct(
    productCode: string,
    phoneNumber: string,
    rechargeType: string,
  ): Promise<ProductInfo>;

  /**
   * 执行充值操作
   * @param order 订单信息
   * @returns 充值结果
   */
  recharge(order: Order): Promise<RechargeResult>;

  /**
   * 获取后付费账单信息
   * @param phoneNumber 手机号码
   * @returns 账单信息
   */
  getPostpaidBill?(phoneNumber: string): Promise<PostpaidBillInfo>;
}

/**
 * 商品信息
 */
export interface ProductInfo {
  code: string;
  name: string;
  engName?: string;
  price: number;
  unit?: string;
  data?: string;
  days?: number;
}

/**
 * 充值结果
 */
export interface RechargeResult {
  result: 'success' | 'failed';
  code?: string;
  msg?: string;
}

/**
 * 后付费账单信息
 */
export interface PostpaidBillInfo {
  totalUnpaid: number;
  invoiceStatus?: string;
  invoiceAmount?: number;
  invoiceDate?: string;
}
