import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { Operator } from '../enums';

/**
 * 创建话费充值订单 DTO (VOICE)
 */
export class CreatePrepaidRechargeOrderDto {
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

  @ApiProperty({ description: '商品代码', example: 'SD5000' })
  @IsNotEmpty({ message: '商品代码不能为空' })
  @IsString({ message: '商品代码必须是字符串' })
  productCode!: string;
}
