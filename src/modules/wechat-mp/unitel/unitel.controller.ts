import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UnitelService } from './unitel.service';
import {
  QueryServiceDto,
  GetPostpaidBillDto,
  GetPostpaidBillResponse,
} from './dto';

/**
 * Unitel API Controller
 * 提供前端查询 Unitel 资费套餐列表、后付费账单等接口
 * 注意:此接口为公开接口，不需要用户认证
 */
@ApiTags('Unitel')
@Controller('unitel')
export class UnitelController {
  constructor(private readonly unitelService: UnitelService) {}

  /**
   * 查询资费列表
   * 前端调用此接口获取可购买的充值套餐
   */
  @Post('products/services')
  @ApiOperation({ summary: '查询 Unitel 资费套餐列表' })
  async getServiceTypes(@Body() dto: QueryServiceDto) {
    return await this.unitelService.getServiceTypes(dto);
  }

  /**
   * 获取后付费账单
   * 前端调用此接口查询用户的后付费账单信息
   */
  @Post('postpaid-bill')
  @ApiOperation({ summary: '获取 Unitel 后付费账单' })
  async getPostpaidBill(
    @Body() dto: GetPostpaidBillDto,
  ): Promise<GetPostpaidBillResponse> {
    return await this.unitelService.getPostpaidBill(dto);
  }
}
