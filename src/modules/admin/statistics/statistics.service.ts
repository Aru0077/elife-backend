import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@common/prisma/prisma.service';
import {
  UserStatsDto,
  OrderStatsDto,
  RevenueStatsDto,
  QueryStatsDto,
} from './dto';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 获取用户统计信息
   */
  async getUserStats(query?: QueryStatsDto): Promise<UserStatsDto> {
    try {
      const whereClause: Prisma.UserWhereInput = {};

      // 按 AppID 过滤
      if (query?.appid) {
        whereClause.appid = query.appid;
      }

      // 总用户数
      const total = await this.prisma.user.count({ where: whereClause });

      // 今日新增用户数
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayNew = await this.prisma.user.count({
        where: {
          ...whereClause,
          createdAt: { gte: startOfToday },
        },
      });

      // 按 AppID 分组统计
      let byAppid: Record<string, number> | undefined;
      if (!query?.appid) {
        const groupByAppid = await this.prisma.user.groupBy({
          by: ['appid'],
          _count: true,
        });
        byAppid = groupByAppid.reduce(
          (acc, item) => {
            acc[item.appid || 'unknown'] = item._count;
            return acc;
          },
          {} as Record<string, number>,
        );
      }

      return {
        total,
        todayNew,
        byAppid,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('获取用户统计信息失败', {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * 获取订单统计信息
   */
  async getOrderStats(query?: QueryStatsDto): Promise<OrderStatsDto> {
    try {
      const whereClause: Prisma.OrderWhereInput = {};

      // 日期范围过滤
      if (query?.startDate || query?.endDate) {
        whereClause.createdAt = {};
        if (query.startDate) {
          whereClause.createdAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          const endDate = new Date(query.endDate);
          endDate.setHours(23, 59, 59, 999);
          whereClause.createdAt.lte = endDate;
        }
      }

      // 按 AppID 过滤（通过关联的用户）
      if (query?.appid) {
        whereClause.user = { appid: query.appid };
      }

      // 总订单数
      const total = await this.prisma.order.count({ where: whereClause });

      // 按支付状态统计
      const pending = await this.prisma.order.count({
        where: { ...whereClause, paymentStatus: 'pending' },
      });

      const paid = await this.prisma.order.count({
        where: { ...whereClause, paymentStatus: 'paid' },
      });

      const completed = await this.prisma.order.count({
        where: { ...whereClause, rechargeStatus: 'completed' },
      });

      // 今日订单数
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayOrders = await this.prisma.order.count({
        where: {
          ...whereClause,
          createdAt: { gte: startOfToday },
        },
      });

      // 按运营商统计
      const byOperatorData = await this.prisma.order.groupBy({
        by: ['productOperator'],
        where: whereClause,
        _count: true,
      });
      const byOperator = byOperatorData.reduce(
        (acc, item) => {
          acc[item.productOperator] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      );

      // 按充值类型统计
      const byRechargeTypeData = await this.prisma.order.groupBy({
        by: ['productRechargeType'],
        where: whereClause,
        _count: true,
      });
      const byRechargeType = byRechargeTypeData.reduce(
        (acc, item) => {
          acc[item.productRechargeType] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        total,
        pending,
        paid,
        completed,
        todayOrders,
        byOperator,
        byRechargeType,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('获取订单统计信息失败', {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * 获取收入统计信息
   */
  async getRevenueStats(query?: QueryStatsDto): Promise<RevenueStatsDto> {
    try {
      const whereClause: Prisma.OrderWhereInput = { paymentStatus: 'paid' };

      // 日期范围过滤
      if (query?.startDate || query?.endDate) {
        whereClause.paidAt = {};
        if (query.startDate) {
          whereClause.paidAt.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          const endDate = new Date(query.endDate);
          endDate.setHours(23, 59, 59, 999);
          whereClause.paidAt.lte = endDate;
        }
      }

      // 按 AppID 过滤
      if (query?.appid) {
        whereClause.user = { appid: query.appid };
      }

      // 总收入
      const totalRevenueResult = await this.prisma.order.aggregate({
        where: whereClause,
        _sum: { productPriceRmb: true },
      });
      const totalRevenue = totalRevenueResult._sum.productPriceRmb || 0;

      // 今日收入
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayRevenueResult = await this.prisma.order.aggregate({
        where: {
          ...whereClause,
          paidAt: { gte: startOfToday },
        },
        _sum: { productPriceRmb: true },
      });
      const todayRevenue = todayRevenueResult._sum.productPriceRmb || 0;

      // 本月收入
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthRevenueResult = await this.prisma.order.aggregate({
        where: {
          ...whereClause,
          paidAt: { gte: startOfMonth },
        },
        _sum: { productPriceRmb: true },
      });
      const monthRevenue = monthRevenueResult._sum.productPriceRmb || 0;

      return {
        totalRevenue,
        todayRevenue,
        monthRevenue,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error('获取收入统计信息失败', {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }

  /**
   * 获取完整统计信息
   */
  async getAllStats(query?: QueryStatsDto) {
    const [userStats, orderStats, revenueStats] = await Promise.all([
      this.getUserStats(query),
      this.getOrderStats(query),
      this.getRevenueStats(query),
    ]);

    return {
      users: userStats,
      orders: orderStats,
      revenue: revenueStats,
      generatedAt: new Date().toISOString(),
    };
  }
}
