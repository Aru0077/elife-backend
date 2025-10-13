import { Module } from '@nestjs/common';
import { StatisticsModule } from './statistics/statistics.module';

/**
 * 管理端模块聚合
 * 包含统计等管理功能
 */
@Module({
  imports: [StatisticsModule],
  exports: [StatisticsModule],
})
export class AdminModule {}
