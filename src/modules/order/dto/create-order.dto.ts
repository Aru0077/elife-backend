import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @ApiProperty({ description: '充值手机号' })
  @IsNotEmpty()
  @IsString()
  phoneNumber!: string;

  @ApiProperty({ description: '运营商' })
  @IsNotEmpty()
  @IsString()
  productOperator!: string;

  @ApiProperty({ description: '充值类型' })
  @IsNotEmpty()
  @IsString()
  productRechargeType!: string;

  @ApiProperty({ description: '产品名称' })
  @IsNotEmpty()
  @IsString()
  productName!: string;

  @ApiProperty({ description: '产品代码' })
  @IsNotEmpty()
  @IsString()
  productCode!: string;

  @ApiProperty({ description: '泰铢价格' })
  @IsNotEmpty()
  @Type(() => Number)
  productPriceTg!: number;

  @ApiProperty({ description: '人民币价格' })
  @IsNotEmpty()
  @Type(() => Number)
  productPriceRmb!: number;

  @ApiProperty({ description: '单位（GB/分钟）', required: false })
  @IsOptional()
  @IsString()
  productUnit?: string;

  @ApiProperty({ description: '产品数据（JSON）', required: false })
  @IsOptional()
  @IsString()
  productData?: string;

  @ApiProperty({ description: '有效天数', required: false })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  productDays?: number;
}
