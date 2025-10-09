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
  @IsNotEmpty()
  @IsString()
  journal_id!: string;

  @ApiProperty({ description: '交易金额', example: '1500.00' })
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @ApiProperty({ description: '交易描述', example: 'Recharge' })
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiProperty({ description: '账户', example: 'ACC001' })
  @IsNotEmpty()
  @IsString()
  account!: string;
}

export class RechargeDto {
  @ApiProperty({ description: '手机号码', example: '88616609' })
  @IsNotEmpty()
  @IsString()
  msisdn!: string;

  @ApiProperty({ description: '话费卡代码', example: 'HB1500' })
  @IsNotEmpty()
  @IsString()
  card!: string;

  @ApiProperty({ description: '是否开发票 (0-否 1-是)', example: '1' })
  @IsIn(['0', '1'])
  vatflag!: string;

  @ApiProperty({ description: '税号', required: false })
  vat_register_no?: string;

  @ApiProperty({ description: '交易列表', type: [TransactionDto] })
  @IsArray()
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
  result: string;
  msg: string;
  code: string;
  amount?: string;
  vat?: VatInfo;
}
