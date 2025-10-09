import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionDto, RechargeResponse } from './recharge.dto';

export class DataPackageDto {
  @ApiProperty({ description: '手机号码', example: '88616609' })
  @IsNotEmpty()
  @IsString()
  msisdn!: string;

  @ApiProperty({ description: '流量包代码', example: 'data1gb1d' })
  @IsNotEmpty()
  @IsString()
  package!: string;

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

// 流量包激活响应（复用 RechargeResponse）
export type DataPackageResponse = RechargeResponse;
