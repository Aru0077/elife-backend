import { Controller, Get, Logger } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';

@Controller('exchange-rate')
export class ExchangeRateController {
  private readonly logger = new Logger(ExchangeRateController.name);

  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * 获取当前 MNT_TO_CNY 汇率（公开接口）
   * GET /exchange-rate/current
   */
  @Get('current')
  async getCurrentRate() {
    this.logger.log('获取 MNT_TO_CNY 汇率请求');
    return this.exchangeRateService.getCurrentRate('MNT_TO_CNY');
  }
}
