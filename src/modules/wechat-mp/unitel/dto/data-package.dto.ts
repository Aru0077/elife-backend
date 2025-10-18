import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionDto } from './recharge.dto';

export class DataPackageDto {
  @ApiProperty({ description: '手机号码', example: '88616609' })
  @IsNotEmpty({ message: '手机号码不能为空' })
  @IsString({ message: '手机号码必须是字符串' })
  msisdn!: string;

  @ApiProperty({ description: '流量包代码', example: 'data1gb1d' })
  @IsNotEmpty({ message: '流量包代码不能为空' })
  @IsString({ message: '流量包代码必须是字符串' })
  package!: string;

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

// 流量包激活响应
export interface DataPackageResponse {
  result: string; // 'success' | 'failed' | 'pending'
  msg: string;
  code: string;
  amount?: string; // 金额(项目中不使用)
  seq?: string; // 序列ID,用于查询充值结果(checkTransactionResult使用)
  seq_id?: string; // 兼容旧API返回格式
  transaction_id?: string; // 交易ID(项目中不使用)
  [key: string]: unknown; // 允许其他字段,但项目中忽略
}
