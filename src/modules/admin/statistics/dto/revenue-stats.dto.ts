import { ApiProperty } from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';

export class RevenueStatsDto {
  @ApiProperty({ description: '总收入（人民币）' })
  totalRevenue!: number | Decimal;

  @ApiProperty({ description: '今日收入（人民币）' })
  todayRevenue!: number | Decimal;

  @ApiProperty({ description: '本月收入（人民币）' })
  monthRevenue!: number | Decimal;

  @ApiProperty({ description: '按日期统计收入', required: false })
  byDate?: Record<string, number | Decimal>;
}
