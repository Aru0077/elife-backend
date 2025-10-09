import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * 创建支付订单 DTO
 */
export class CreatePaymentDto {
  @ApiProperty({
    description: '订单号',
    example: 'ORD1728546789123abcd',
  })
  @IsString()
  @IsNotEmpty()
  orderNumber!: string;
}
