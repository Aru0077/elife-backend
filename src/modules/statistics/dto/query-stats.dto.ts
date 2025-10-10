import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class QueryStatsDto {
  @ApiPropertyOptional({ description: '开始日期 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: '开始日期格式不正确，应为 YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: '结束日期格式不正确，应为 YYYY-MM-DD' })
  endDate?: string;

  @ApiPropertyOptional({ description: '按 AppID 过滤' })
  @IsOptional()
  appid?: string;
}
