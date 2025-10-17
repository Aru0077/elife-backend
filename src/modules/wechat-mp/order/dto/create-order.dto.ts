import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { Operator, RechargeType } from '../enums';

/**
 * 创建订单 DTO（统一接口）
 * 支持话费充值、流量包、账单结算
 */
export class CreateOrderDto {
  @ApiProperty({ description: '充值手机号', example: '88616609' })
  @IsNotEmpty({ message: '充值手机号不能为空' })
  @IsString({ message: '充值手机号必须是字符串' })
  phoneNumber!: string;

  @ApiProperty({
    description: '运营商',
    enum: Operator,
    example: Operator.UNITEL,
  })
  @IsNotEmpty({ message: '运营商不能为空' })
  @IsEnum(Operator, { message: '运营商必须是有效的枚举值' })
  productOperator!: Operator;

  @ApiProperty({
    description: '充值类型',
    enum: RechargeType,
    example: RechargeType.VOICE,
  })
  @IsNotEmpty({ message: '充值类型不能为空' })
  @IsEnum(RechargeType, { message: '充值类型必须是有效的枚举值' })
  rechargeType!: RechargeType;

  @ApiProperty({
    description: '商品代码（后付费账单结算时可选）',
    example: 'SD5000',
    required: false,
  })
  @IsOptional()
  @IsString({ message: '商品代码必须是字符串' })
  productCode?: string;
}
