/**
 * 微信支付相关接口定义
 */

/**
 * 统一下单响应 - respdata 字段
 */
export interface UnifiedOrderResponse {
  return_code: string; // SUCCESS/FAIL
  return_msg?: string;
  appid?: string;
  mch_id?: string;
  sub_appid?: string;
  sub_mch_id?: string;
  nonce_str?: string;
  sign?: string;
  result_code?: string; // SUCCESS/FAIL
  err_code?: string;
  err_code_des?: string;
  trade_type?: string; // JSAPI
  prepay_id?: string;
  payment?: PaymentInfo; // 小程序端调用 wx.requestPayment 所需信息
}

/**
 * 小程序支付参数（直接传给前端）
 */
export interface PaymentInfo {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string; // prepay_id=xxx
  signType: string; // MD5
  paySign: string;
}

/**
 * 微信支付完整响应
 */
export interface WechatPayResponse {
  errcode: number;
  errmsg: string;
  respdata?: UnifiedOrderResponse;
}

/**
 * 微信支付回调数据（camelCase 格式）
 */
export interface PaymentCallbackData {
  returnCode: string; // SUCCESS/FAIL
  returnMsg?: string;
  appid?: string;
  mchId?: string;
  subAppid?: string;
  subMchId?: string;
  nonceStr?: string;
  sign?: string;
  resultCode?: string; // SUCCESS/FAIL
  errCode?: string;
  errCodeDes?: string;
  openid?: string;
  isSubscribe?: string; // Y/N
  subOpenid?: string;
  subIsSubscribe?: string;
  tradeType?: string; // JSAPI
  bankType?: string;
  totalFee?: number; // 订单总金额（分）
  feeType?: string; // CNY
  cashFee?: number; // 现金支付金额（分）
  transactionId?: string; // 微信支付订单号
  outTradeNo?: string; // 商户订单号
  attach?: string; // 附加数据
  timeEnd?: string; // 支付完成时间 yyyyMMddHHmmss
  settlementTotalFee?: number; // 应结订单金额（分）
  couponFee?: number; // 代金券金额（分）
  couponCount?: number; // 代金券数量
}
