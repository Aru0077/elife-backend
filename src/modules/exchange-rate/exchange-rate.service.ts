import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateExchangeRateDto } from './dto';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 获取当前汇率（公开接口）
   * @param currency 货币对，例如 "MNT_TO_CNY"
   */
  async getCurrentRate(currency: string = 'MNT_TO_CNY') {
    try {
      const exchangeRate = await this.prisma.exchangeRate.findFirst({
        where: {
          currency,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (!exchangeRate) {
        this.logger.warn(`汇率不存在: ${currency}`);
        throw new NotFoundException('汇率配置不存在');
      }

      return {
        currency: exchangeRate.currency,
        rate: Number(exchangeRate.rate),
        updatedAt: exchangeRate.updatedAt,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`获取汇率失败: ${currency}`, {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * 更新汇率（管理员接口，暂时保留供将来使用）
   * @param currency 货币对
   * @param updateDto 更新数据
   */
  async updateRate(currency: string, updateDto: UpdateExchangeRateDto) {
    try {
      const exchangeRate = await this.prisma.exchangeRate.upsert({
        where: { currency },
        update: {
          rate: updateDto.rate,
        },
        create: {
          currency,
          rate: updateDto.rate,
          isActive: true,
        },
      });

      this.logger.log(`汇率更新成功: ${currency} = ${updateDto.rate}`);

      return {
        currency: exchangeRate.currency,
        rate: Number(exchangeRate.rate),
        updatedAt: exchangeRate.updatedAt,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`更新汇率失败: ${currency}`, {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }
}
