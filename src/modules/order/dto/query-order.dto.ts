import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentStatus, RechargeStatus } from '../enums';

export class QueryOrderDto {
  @ApiPropertyOptional({ enum: PaymentStatus, description: '支付状态' })
  @IsOptional()
  @IsEnum(PaymentStatus, { message: '支付状态值不正确' })
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: RechargeStatus, description: '充值状态' })
  @IsOptional()
  @IsEnum(RechargeStatus, { message: '充值状态值不正确' })
  rechargeStatus?: RechargeStatus;

  @ApiPropertyOptional({ description: '开始日期 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: '开始日期格式不正确，应为 YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: '结束日期格式不正确，应为 YYYY-MM-DD' })
  endDate?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码必须大于等于 1' })
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量必须大于等于 1' })
  @Type(() => Number)
  limit?: number = 10;
}
