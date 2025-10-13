import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ExchangeRateModule } from './exchange-rate/exchange-rate.module';

/**
 * 公共模块聚合
 * 包含健康检查、汇率等公共功能
 */
@Module({
  imports: [HealthModule, ExchangeRateModule],
  exports: [HealthModule, ExchangeRateModule],
})
export class CommonModule {}
