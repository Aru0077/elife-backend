import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('api/exchange-rate')
export class ExchangeRateController {
  private readonly logger = new Logger(ExchangeRateController.name);

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * 获取当前汇率（公开接口）
   * GET /api/exchange-rate?currency=MNT_TO_CNY
   */
  @Get()
  async getCurrentRate(@Query('currency') currency?: string) {
    this.logger.log(`获取汇率请求: ${currency || 'MNT_TO_CNY'}`);
    return this.exchangeRateService.getCurrentRate(currency);
  }
}
