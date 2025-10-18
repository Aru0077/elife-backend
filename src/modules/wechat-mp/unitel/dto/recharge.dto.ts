import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

// 交易信息
export class TransactionDto {
  @ApiProperty({ description: '交易ID', example: 'TXN20231001001' })
  @IsNotEmpty({ message: '交易ID不能为空' })
  @IsString({ message: '交易ID必须是字符串' })
  journal_id!: string;

  @ApiProperty({ description: '交易金额', example: '1500.00' })
  @IsNotEmpty({ message: '交易金额不能为空' })
  @IsString({ message: '交易金额必须是字符串' })
  amount!: string;

  @ApiProperty({ description: '交易描述', example: 'Recharge' })
  @IsNotEmpty({ message: '交易描述不能为空' })
  @IsString({ message: '交易描述必须是字符串' })
  description!: string;

  @ApiProperty({ description: '账户', example: 'ACC001' })
  @IsNotEmpty({ message: '账户不能为空' })
  @IsString({ message: '账户必须是字符串' })
  account!: string;
}

export class RechargeDto {
  @ApiProperty({ description: '手机号码', example: '88616609' })
  @IsNotEmpty({ message: '手机号码不能为空' })
  @IsString({ message: '手机号码必须是字符串' })
  msisdn!: string;

  @ApiProperty({ description: '话费卡代码', example: 'HB1500' })
  @IsNotEmpty({ message: '话费卡代码不能为空' })
  @IsString({ message: '话费卡代码必须是字符串' })
  card!: string;

  @ApiProperty({ description: '是否开发票 (0-否 1-是)', example: '1' })
  @IsIn(['0', '1'], { message: '开发票参数必须是 0 或 1' })
  vatflag!: string;

  @ApiProperty({ description: '税号', required: false })
  vat_register_no?: string;

  @ApiProperty({ description: '交易列表', type: [TransactionDto] })
  @IsArray({ message: '交易列表必须是数组' })
  @ValidateNested({ each: true })
  @Type(() => TransactionDto)
  transactions!: TransactionDto[];
}

// 银行交易信息
export interface BankTransaction {
  [key: string]: unknown;
}

// VAT 发票信息
export interface VatInfo {
  date: string;
  amount: string;
  cashAmount: string;
  vat: string;
  lottery: string;
  cityTax: string;
  qrData: string;
  nonCashAmount: string;
  merchantId: string;
  success: string;
  billId: string;
  internalCode: string;
  stocks: Array<{
    unitPrice: string;
    cityTax: string;
    totalAmount: string;
    code: string;
    qty: string;
    name: string;
    vat: string;
    measureUnit: string;
    barCode: string;
  }>;
  bankTransactions: BankTransaction[];
}

// 充值响应
export interface RechargeResponse {
  result: string; // 'success' | 'failed' | 'pending'
  msg: string;
  code: string;
  amount?: string;
  vat?: VatInfo; // 发票信息(项目中不使用)
  seq?: string; // 序列ID,用于查询充值结果(checkTransactionResult使用)
  seq_id?: string; // 兼容旧API返回格式
  transaction_id?: string; // 交易ID(项目中不使用)
}
