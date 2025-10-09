import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn } from 'class-validator';

/**
 * 查询资费列表 DTO
 */
export class QueryServiceDto {
  @ApiProperty({ description: '手机号码', example: '88616609' })
  @IsNotEmpty()
  @IsString()
  msisdn!: string;

  @ApiProperty({ description: '是否获取资费详情 (0-否 1-是)', example: '1' })
  @IsIn(['0', '1'])
  info!: string;
}

// 话费卡类型
export interface ServiceCard {
  code: string;
  name: string;
  price: number;
  unit?: number;
  data?: string;
  days?: number;
  short_name: string;
}

// 流量包类型
export interface DataPackage {
  code: string;
  name: string;
  price: number;
  data: string;
  days: number;
  short_name: string;
}

// 资费列表响应
export interface ServiceTypeResponse {
  result: string;
  code: string;
  msg: string;
  servicetype?: string;
  productid?: string;
  name?: string;
  service?: {
    name: string;
    cards?: {
      day?: ServiceCard[];
      noday?: ServiceCard[];
      special?: ServiceCard[];
    };
    data?: {
      data?: DataPackage[];
      days?: DataPackage[];
      entertainment?: DataPackage[];
    };
  };
}
