import { ApiProperty } from '@nestjs/swagger';

export class UserStatsDto {
  @ApiProperty({ description: '总用户数' })
  total!: number;

  @ApiProperty({ description: '今日新增用户数' })
  todayNew!: number;

  @ApiProperty({ description: '按 AppID 分组统计', required: false })
  byAppid?: Record<string, number>;
}
