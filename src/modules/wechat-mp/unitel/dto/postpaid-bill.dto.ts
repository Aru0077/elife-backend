import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsIn,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 获取后付费账单 DTO
 */
export class GetPostpaidBillDto {
  @ApiProperty({ description: '账户所有者', example: '88051269' })
  @IsNotEmpty({ message: '账户所有者不能为空' })
  @IsString({ message: '账户所有者必须是字符串' })
  owner!: string;

  @ApiProperty({ description: '手机号码', example: '88051269' })
  @IsNotEmpty({ message: '手机号码不能为空' })
  @IsString({ message: '手机号码必须是字符串' })
  msisdn!: string;
}

// 交易信息 (复用 recharge.dto 中的结构)
export class PostpaidTransactionDto {
  @ApiProperty({ description: '交易ID', example: 'TXN20231001001' })
  @IsNotEmpty({ message: '交易ID不能为空' })
  @IsString({ message: '交易ID必须是字符串' })
  journal_id!: string;

  @ApiProperty({ description: '交易金额', example: '2500.00' })
  @IsNotEmpty({ message: '交易金额不能为空' })
  @IsString({ message: '交易金额必须是字符串' })
  amount!: string;

  @ApiProperty({ description: '交易描述', example: 'Postpaid bill payment' })
  @IsNotEmpty({ message: '交易描述不能为空' })
  @IsString({ message: '交易描述必须是字符串' })
  description!: string;

  @ApiProperty({ description: '账户', example: 'ACC001' })
  @IsNotEmpty({ message: '账户不能为空' })
  @IsString({ message: '账户必须是字符串' })
  account!: string;
}

/**
 * 支付后付费账单 DTO
 */
export class PayPostpaidBillDto {
  @ApiProperty({ description: '手机号码', example: '88051269' })
  @IsNotEmpty({ message: '手机号码不能为空' })
  @IsString({ message: '手机号码必须是字符串' })
  msisdn!: string;

  @ApiProperty({ description: '支付金额', example: '100' })
  @IsNotEmpty({ message: '支付金额不能为空' })
  @IsString({ message: '支付金额必须是字符串' })
  amount!: string;

  @ApiProperty({ description: '备注信息', example: 'Postpaid bill payment' })
  @IsNotEmpty({ message: '备注信息不能为空' })
  @IsString({ message: '备注信息必须是字符串' })
  remark!: string;

  @ApiProperty({ description: '是否开发票 (0-否 1-是)', example: '1' })
  @IsIn(['0', '1'], { message: '开发票参数必须是 0 或 1' })
  vatflag!: string;

  @ApiProperty({
    description: '税号',
    example: 'VAT123456',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '税号必须是字符串' })
  vat_register_no?: string;

  @ApiProperty({ description: '交易列表', type: [PostpaidTransactionDto] })
  @IsArray({ message: '交易列表必须是数组' })
  @ValidateNested({ each: true })
  @Type(() => PostpaidTransactionDto)
  transactions!: PostpaidTransactionDto[];
}

/**
 * 查询充值结算结果 DTO
 */
export class CheckTransactionDto {
  @ApiProperty({
    description: '序列ID',
    example: '1655436862832',
  })
  @IsNotEmpty({ message: '序列ID不能为空' })
  @IsString({ message: '序列ID必须是字符串' })
  seq_id!: string;
}

// ==================== 响应接口 ====================

/**
 * 后付费账单详情
 */
export interface PostpaidBillDetail {
  msisdn?: string;
  owner?: string;
  bill_amount?: string;
  due_date?: string;
  bill_cycle?: string;
  status?: string;
  [key: string]: unknown; // 允许其他未知字段
}

/**
 * 获取后付费账单响应
 */
export interface GetPostpaidBillResponse {
  result: string;
  code: string;
  msg: string;
  invoice_amount?: number; // 发票金额
  remain_amount?: number; // 剩余金额
  invoice_date?: string; // 发票日期
  broadcast_fee?: string; // 广播费
  total_unpaid?: number; // 总欠费
  invoice_unpaid?: number; // 发票欠费
  invoice_status?: string; // 发票状态：paid, unpaid 等
  [key: string]: unknown; // 允许其他未知字段
}

/**
 * 支付后付费账单响应
 */
export interface PayPostpaidBillResponse {
  result: string;
  code: string;
  msg: string;
  transaction_id?: string;
  seq_id?: string;
  amount?: string;
  [key: string]: unknown; // 允许其他未知字段
}

/**
 * 查询充值结算结果响应
 */
export interface CheckTransactionResponse {
  result: string;
  code: string;
  msg: string;
  status?: string; // 交易状态：success, pending, failed 等
  seq_id?: string;
  transaction_id?: string;
  amount?: string;
  msisdn?: string;
  timestamp?: string;
  [key: string]: unknown; // 允许其他未知字段
}
