import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { WechatAuthGuard } from '@modules/wechat-mp/auth/guards/wechat-auth.guard';
import { QueryStatsDto } from './dto';

@ApiTags('统计')
@Controller('statistics')
@UseGuards(WechatAuthGuard)
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('users')
  @ApiOperation({ summary: '获取用户统计信息' })
  async getUserStats(@Query() query: QueryStatsDto) {
    return await this.statisticsService.getUserStats(query);
  }

  @Get('orders')
  @ApiOperation({ summary: '获取订单统计信息' })
  async getOrderStats(@Query() query: QueryStatsDto) {
    return await this.statisticsService.getOrderStats(query);
  }

  @Get('revenue')
  @ApiOperation({ summary: '获取收入统计信息' })
  async getRevenueStats(@Query() query: QueryStatsDto) {
    return await this.statisticsService.getRevenueStats(query);
  }

  @Get()
  @ApiOperation({ summary: '获取完整统计信息' })
  async getAllStats(@Query() query: QueryStatsDto) {
    return await this.statisticsService.getAllStats(query);
  }
}
