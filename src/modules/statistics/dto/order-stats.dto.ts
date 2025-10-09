import { ApiProperty } from '@nestjs/swagger';

export class OrderStatsDto {
  @ApiProperty({ description: '总订单数' })
  total!: number;

  @ApiProperty({ description: '待支付订单数' })
  pending!: number;

  @ApiProperty({ description: '已支付订单数' })
  paid!: number;

  @ApiProperty({ description: '已完成订单数' })
  completed!: number;

  @ApiProperty({ description: '今日订单数' })
  todayOrders!: number;

  @ApiProperty({ description: '按运营商统计', required: false })
  byOperator?: Record<string, number>;

  @ApiProperty({ description: '按充值类型统计', required: false })
  byRechargeType?: Record<string, number>;
}
