import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { User } from '@prisma/client';

export interface FindOrCreateUserDto {
  openid: string;
  unionid?: string;
  appid?: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 查找或创建用户 (自动登录核心逻辑)
   */
  async findOrCreate(dto: FindOrCreateUserDto): Promise<User> {
    try {
      // 优先通过 unionid 查找 (如果提供)
      if (dto.unionid) {
        const userByUnionid = await this.prisma.user.findUnique({
          where: { unionid: dto.unionid },
        });

        if (userByUnionid) {
          // 找到用户，更新 appid（如果不同）
          if (dto.appid && userByUnionid.appid !== dto.appid) {
            return await this.prisma.user.update({
              where: { openid: userByUnionid.openid },
              data: { appid: dto.appid },
            });
          }
          return userByUnionid;
        }
      }

      // 通过 openid 查找或创建
      return await this.prisma.user.upsert({
        where: { openid: dto.openid },
        create: {
          openid: dto.openid,
          unionid: dto.unionid,
          appid: dto.appid,
        },
        update: {
          ...(dto.unionid !== undefined && { unionid: dto.unionid }),
          ...(dto.appid !== undefined && { appid: dto.appid }),
        },
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error('查找或创建用户失败', {
        message: err.message,
        stack: err.stack,
      });
      throw error;
    }
  }
}
