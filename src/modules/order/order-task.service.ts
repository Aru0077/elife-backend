import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderService } from './order.service';
import { RechargeStatus, PaymentStatus } from './enums';

@Injectable()
export class OrderTaskService {
  private readonly logger = new Logger(OrderTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  /**
   * 每分钟补偿卡在 PENDING 状态的订单
   * 处理因服务重启等原因丢失的充值任务 daixiufu
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryPendingRecharges() {
    try {
      // 查找 PENDING 状态且 rechargeAt 为空的订单（1 分钟前的）
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

      const pendingOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          rechargeStatus: RechargeStatus.PENDING,
          rechargeAt: null,
          paidAt: {
            lt: oneMinuteAgo,
          },
        },
        take: 10, // 每次处理 10 个，避免过载
        orderBy: {
          paidAt: 'asc',
        },
      });

      if (pendingOrders.length === 0) {
        this.logger.debug('无需补偿的 PENDING 订单');
        return;
      }

      this.logger.warn(
        `发现 ${pendingOrders.length} 个需要补偿的 PENDING 订单`,
      );

      // 依次处理订单（只发送一次充值请求）
      for (const order of pendingOrders) {
        this.logger.log(`补偿充值订单: ${order.orderNumber}`);
        await this.orderService.rechargeOrder(order.orderNumber);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('补偿 PENDING 订单异常', {
        message: err.message,
        stack: err.stack,
      });
    }
  }

  /**
   * 每 5 分钟查询失败的充值订单
   * 仅查询 24 小时内支付成功但充值失败的订单
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkFailedRechargeOrders() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // 查询失败订单
      const failedOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          rechargeStatus: RechargeStatus.FAILED,
          paidAt: {
            gte: twentyFourHoursAgo,
          },
        },
        orderBy: {
          paidAt: 'desc',
        },
      });

      if (failedOrders.length === 0) {
        this.logger.debug('无失败的充值订单');
        return;
      }

      this.logger.warn(
        `发现 ${failedOrders.length} 个失败的充值订单（24小时内）:`,
      );

      // 记录失败订单详情
      for (const order of failedOrders) {
        this.logger.warn(
          `订单: ${order.orderNumber}, 手机: ${order.phoneNumber}, ` +
            `产品: ${order.productName}, 金额: ${order.productPriceTg.toString()} TG, ` +
            `支付时间: ${order.paidAt?.toISOString()}`,
        );
      }

      // TODO: 可以在这里添加告警通知（如发送邮件、企业微信等）
      // await this.notifyAdmin(failedOrders);
    } catch (error) {
      const err = error as Error;
      this.logger.error('查询失败充值订单异常', {
        message: err.message,
        stack: err.stack,
      });
    }
  }

  /**
   * 每天凌晨2点统计前一天的充值情况
   */
  @Cron('0 2 * * *')
  async dailyRechargeReport() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date(yesterday);
      today.setDate(today.getDate() + 1);

      // 统计昨天的充值情况
      const stats = await this.prisma.order.groupBy({
        by: ['rechargeStatus'],
        where: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: {
            gte: yesterday,
            lt: today,
          },
        },
        _count: {
          orderNumber: true,
        },
        _sum: {
          productPriceTg: true,
        },
      });

      this.logger.log('========== 昨日充值统计 ==========');
      this.logger.log(`日期: ${yesterday.toISOString().split('T')[0]}`);

      for (const stat of stats) {
        this.logger.log(
          `状态: ${stat.rechargeStatus || '未充值'}, ` +
            `订单数: ${stat._count.orderNumber}, ` +
            `总金额: ${stat._sum.productPriceTg?.toString() || '0'} TG`,
        );
      }

      this.logger.log('==================================');
    } catch (error) {
      const err = error as Error;
      this.logger.error('生成每日充值报告异常', {
        message: err.message,
        stack: err.stack,
      });
    }
  }
}
