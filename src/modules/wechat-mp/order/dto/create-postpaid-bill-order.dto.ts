import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { Operator } from '../enums';

/**
 * 创建账单结算订单 DTO (POSTPAID)
 */
export class CreatePostpaidBillOrderDto {
  @ApiProperty({ description: '充值手机号', example: '88051269' })
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
}
