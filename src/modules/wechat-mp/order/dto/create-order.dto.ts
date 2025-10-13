import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RechargeType } from '../enums';

export class CreateOrderDto {
  @ApiProperty({ description: '充值手机号' })
  @IsNotEmpty({ message: '充值手机号不能为空' })
  @IsString({ message: '充值手机号必须是字符串' })
  phoneNumber!: string;

  @ApiProperty({ description: '运营商' })
  @IsNotEmpty({ message: '运营商不能为空' })
  @IsString({ message: '运营商必须是字符串' })
  productOperator!: string;

  @ApiProperty({
    description: '充值类型',
    enum: RechargeType,
    example: RechargeType.VOICE,
  })
  @IsNotEmpty({ message: '充值类型不能为空' })
  @IsEnum(RechargeType, {
    message: '充值类型必须是 voice（话费）或 data（流量）',
  })
  productRechargeType!: RechargeType;

  @ApiProperty({ description: '产品名称' })
  @IsNotEmpty({ message: '产品名称不能为空' })
  @IsString({ message: '产品名称必须是字符串' })
  productName!: string;

  @ApiProperty({ description: '产品代码' })
  @IsNotEmpty({ message: '产品代码不能为空' })
  @IsString({ message: '产品代码必须是字符串' })
  productCode!: string;

  @ApiProperty({ description: '泰铢价格' })
  @IsNotEmpty({ message: '泰铢价格不能为空' })
  @Type(() => Number)
  productPriceTg!: number;

  @ApiProperty({ description: '人民币价格' })
  @IsNotEmpty({ message: '人民币价格不能为空' })
  @Type(() => Number)
  productPriceRmb!: number;

  @ApiProperty({ description: '单位（GB/分钟）', required: false })
  @IsOptional()
  @IsString({ message: '单位必须是字符串' })
  productUnit?: string;

  @ApiProperty({ description: '产品数据（JSON）', required: false })
  @IsOptional()
  @IsString({ message: '产品数据必须是字符串' })
  productData?: string;

  @ApiProperty({ description: '有效天数', required: false })
  @IsOptional()
  @IsInt({ message: '有效天数必须是整数' })
  @Type(() => Number)
  productDays?: number;
}
