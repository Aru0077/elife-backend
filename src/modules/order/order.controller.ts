import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { WechatAuthGuard } from '../auth/guards/wechat-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, Prisma } from '@prisma/client';
import { CreateOrderDto, QueryOrderDto } from './dto';

/**
 * 订单 Controller
 * 提供前端用户的订单相关接口
 */
@ApiTags('订单')
@Controller('orders')
@UseGuards(WechatAuthGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 创建订单
   */
  @Post()
  @ApiOperation({ summary: '创建订单' })
  async create(
    @CurrentUser() user: User,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<Prisma.OrderGetPayload<object>> {
    return await this.orderService.create(user.openid, createOrderDto);
  }

  /**
   * 查询我的订单列表
   */
  @Get('my')
  @ApiOperation({ summary: '查询我的订单列表' })
  async findMyOrders(@CurrentUser() user: User, @Query() query: QueryOrderDto) {
    return await this.orderService.findMyOrders(user.openid, query);
  }

  /**
   * 查询订单详情
   */
  @Get(':orderNumber')
  @ApiOperation({ summary: '查询订单详情' })
  async findOne(
    @CurrentUser() user: User,
    @Param('orderNumber') orderNumber: string,
  ): Promise<
    Prisma.OrderGetPayload<{
      include: {
        user: {
          select: {
            openid: true;
            appid: true;
            createdAt: true;
          };
        };
      };
    }>
  > {
    return await this.orderService.findOne(orderNumber, user.openid);
  }
}
