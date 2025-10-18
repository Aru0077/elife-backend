import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@common/prisma/prisma.service';
import { OrderService } from './order.service';
import { RechargeStatus, PaymentStatus } from './enums';
import { UnitelService } from '@modules/wechat-mp/unitel/unitel.service';

@Injectable()
export class OrderTaskService {
  private readonly logger = new Logger(OrderTaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly unitelService: UnitelService,
  ) {}

  /**
   * 每分钟补偿卡在 PENDING 状态的订单
   * ⚠️ 严格条件：仅处理系统重启导致未发送API请求的订单
   * - 条件1: rechargeAt为null（完全未开始充值）
   * - 条件2: rechargeAt>10分钟 且 seqId为null（获取锁后崩溃，未发送API请求）
   * ⚠️ 注意：超时订单(TIMEOUT状态)已被排除，不会被补偿充值
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryPendingRecharges() {
    try {
      // 查找 PENDING 状态且 rechargeAt 为空的订单（1 分钟前的）
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const pendingOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          rechargeStatus: RechargeStatus.PENDING,
          paidAt: {
            lt: oneMinuteAgo,
          },
          OR: [
            // 条件1: 完全未开始充值
            { rechargeAt: null },
            // 条件2: 获取锁后崩溃（严格条件）
            {
              rechargeAt: { lt: tenMinutesAgo }, // 10分钟前获取锁但仍未完成
              seqId: null, // 必须无seqId - 说明未发送API请求
            },
          ],
        },
        take: 10, // 每次处理 10 个，避免过载
        orderBy: {
          paidAt: 'asc',
        },
      });

      if (pendingOrders.length === 0) {
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
   * 每5分钟检查待确认结果的订单
   * 查询已发送充值请求但状态仍为PENDING的订单，调用API确认最终结果
   * ✅ 有效场景：API返回pending状态且有seqId的订单
   * ⚠️ 注意：此方法只查询结果更新状态，绝不重新充值！
   * ⚠️ 必须条件：seqId不为空（无seqId的订单无法查询）
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkPendingTransactionResults() {
    try {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // 查找已发送充值请求但仍为PENDING状态的订单
      // 必须有 seqId 才能查询结果
      const pendingOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          rechargeStatus: RechargeStatus.PENDING,
          rechargeAt: {
            gte: twelveHoursAgo, // 12小时内（优化：从24小时缩短到12小时,减少API调用）
            lt: fiveMinutesAgo, // 5分钟前(给充值请求一些处理时间)
          },
          seqId: {
            not: null, // 必须有 seqId
          },
        },
        take: 10, // 每次处理10个
        orderBy: {
          rechargeAt: 'asc',
        },
      });

      if (pendingOrders.length === 0) {
        return;
      }

      this.logger.log(
        `发现 ${pendingOrders.length} 个有seqId的PENDING订单，可查询结果`,
      );

      // 逐个查询结果
      for (const order of pendingOrders) {
        try {
          if (!order.seqId) {
            this.logger.warn(`订单 ${order.orderNumber} 没有 seqId,跳过`);
            continue;
          }

          this.logger.log(
            `查询订单充值结果: ${order.orderNumber}, seqId: ${order.seqId}`,
          );

          // 调用 API 查询交易结果
          const result = await this.unitelService.checkTransactionResult({
            seq_id: order.seqId,
          });

          this.logger.log(
            `订单 ${order.orderNumber} 查询结果: status=${result.status}, result=${result.result}`,
          );

          // 根据结果更新订单状态
          if (result.status === 'success') {
            // 充值成功
            await this.prisma.order.update({
              where: { orderNumber: order.orderNumber },
              data: {
                rechargeStatus: RechargeStatus.SUCCESS,
              },
            });
            this.logger.log(
              `订单 ${order.orderNumber} 确认充值成功,已更新状态为 SUCCESS`,
            );
          } else if (result.status === 'failed') {
            // 充值失败
            await this.prisma.order.update({
              where: { orderNumber: order.orderNumber },
              data: {
                rechargeStatus: RechargeStatus.FAILED,
              },
            });
            this.logger.warn(
              `订单 ${order.orderNumber} 确认充值失败,已更新状态为 FAILED`,
            );
          } else {
            // 仍然 pending,不做任何操作
            this.logger.log(
              `订单 ${order.orderNumber} 仍在处理中,保持 PENDING 状态`,
            );
          }
        } catch (error) {
          const err = error as Error;
          this.logger.error(`查询订单 ${order.orderNumber} 结果失败`, {
            message: err.message,
            stack: err.stack,
          });
          // 继续处理下一个订单
          continue;
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('检查待确认订单异常', {
        message: err.message,
        stack: err.stack,
      });
    }
  }

  /**
   * 每5分钟检查超时订单（需人工核查）
   * ⚠️ 超时订单状态未知，可能已充值也可能未充值
   * ⚠️ 禁止自动重试，必须人工核查后处理
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkTimeoutOrders() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const timeoutOrders = await this.prisma.order.findMany({
        where: {
          paymentStatus: PaymentStatus.PAID,
          rechargeStatus: RechargeStatus.TIMEOUT,
          paidAt: { gte: twentyFourHoursAgo },
        },
        orderBy: { paidAt: 'desc' },
      });

      if (timeoutOrders.length === 0) {
        return;
      }

      this.logger.error(
        `⚠️ 发现 ${timeoutOrders.length} 个超时订单（需人工核查是否已充值）`,
      );

      for (const order of timeoutOrders) {
        this.logger.error(
          `订单: ${order.orderNumber}, 手机: ${order.phoneNumber}, ` +
            `金额: ${order.productPriceTg.toString()} TG, ` +
            `充值时间: ${order.rechargeAt?.toISOString()}, ` +
            `⚠️ 状态: 超时未知，禁止自动重试`,
        );
      }

      // TODO: 可以在这里添加告警通知（如发送邮件、企业微信等）
      // await this.notifyAdmin(timeoutOrders);
    } catch (error) {
      const err = error as Error;
      this.logger.error('检查超时订单异常', {
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
