import { ApiProperty } from '@nestjs/swagger';

/**
 * 微信支付回调 DTO
 * 由微信服务器回调时传入
 */
export class PaymentCallbackDto {
  @ApiProperty({ description: '返回状态码', example: 'SUCCESS' })
  returnCode!: string;

  @ApiProperty({ description: '返回信息', required: false })
  returnMsg?: string;

  @ApiProperty({ description: '服务商APPID', required: false })
  appid?: string;

  @ApiProperty({ description: '商户号', required: false })
  mchId?: string;

  @ApiProperty({ description: '小程序APPID', required: false })
  subAppid?: string;

  @ApiProperty({ description: '子商户号', required: false })
  subMchId?: string;

  @ApiProperty({ description: '随机字符串', required: false })
  nonceStr?: string;

  @ApiProperty({ description: '签名', required: false })
  sign?: string;

  @ApiProperty({ description: '业务结果', example: 'SUCCESS', required: false })
  resultCode?: string;

  @ApiProperty({ description: '错误代码', required: false })
  errCode?: string;

  @ApiProperty({ description: '错误描述', required: false })
  errCodeDes?: string;

  @ApiProperty({ description: '用户openid', required: false })
  openid?: string;

  @ApiProperty({ description: '是否关注公众号', required: false })
  isSubscribe?: string;

  @ApiProperty({ description: '子商户openid', required: false })
  subOpenid?: string;

  @ApiProperty({ description: '子商户是否关注', required: false })
  subIsSubscribe?: string;

  @ApiProperty({ description: '交易类型', example: 'JSAPI', required: false })
  tradeType?: string;

  @ApiProperty({ description: '付款银行', required: false })
  bankType?: string;

  @ApiProperty({
    description: '订单总金额（分）',
    example: 100,
    required: false,
  })
  totalFee?: number;

  @ApiProperty({ description: '货币种类', example: 'CNY', required: false })
  feeType?: string;

  @ApiProperty({ description: '现金支付金额（分）', required: false })
  cashFee?: number;

  @ApiProperty({ description: '微信支付订单号', required: false })
  transactionId?: string;

  @ApiProperty({ description: '商户订单号', required: false })
  outTradeNo?: string;

  @ApiProperty({ description: '商家数据包', required: false })
  attach?: string;

  @ApiProperty({
    description: '支付完成时间',
    example: '20230315120000',
    required: false,
  })
  timeEnd?: string;

  @ApiProperty({ description: '应结订单金额（分）', required: false })
  settlementTotalFee?: number;

  @ApiProperty({ description: '代金券金额（分）', required: false })
  couponFee?: number;

  @ApiProperty({ description: '代金券数量', required: false })
  couponCount?: number;
}
