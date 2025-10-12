/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { UserService } from '../../user/user.service';

/**
 * 微信云托管认证守卫
 * 从 HTTP Headers 中读取微信自动注入的用户信息
 */
@Injectable()
export class WechatAuthGuard implements CanActivate {
  private readonly logger = new Logger(WechatAuthGuard.name);

  constructor(private userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. 验证请求来自微信生态
    const source = request.headers['x-wx-source'];
    if (!source) {
      this.logger.warn('非微信环境访问,缺少 X-WX-SOURCE header');
      throw new UnauthorizedException('非微信环境访问');
    }

    // 2. 获取 openid (必需，资源复用场景优先使用 FROM 前缀)
    const openidHeader =
      request.headers['x-wx-from-openid'] || request.headers['x-wx-openid'];
    const openid = openidHeader ? String(openidHeader) : '';
    if (!openid) {
      this.logger.warn('未登录,缺少 X-WX-OPENID header');
      throw new UnauthorizedException('未登录');
    }

    // 3. 获取 unionid (可选，资源复用场景优先使用 FROM 前缀)
    const unionidHeader =
      request.headers['x-wx-from-unionid'] || request.headers['x-wx-unionid'];
    const unionid = unionidHeader ? String(unionidHeader) : undefined;

    // 4. 获取 appid (资源复用场景优先使用 FROM 前缀)
    const appidHeader =
      request.headers['x-wx-from-appid'] || request.headers['x-wx-appid'];
    const appid = appidHeader ? String(appidHeader) : undefined;

    try {
      // 5. 自动创建/更新用户
      const user = await this.userService.findOrCreate({
        openid,
        unionid,
        appid,
      });

      // 6. 注入到请求上下文
      request.user = user;

      this.logger.log({
        message: '用户认证成功',
        openid,
        unionid: unionid ?? null,
        appid: appid ?? null,
      });

      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error('用户认证失败', {
        message: err.message,
        stack: err.stack,
      });
      throw new UnauthorizedException('认证失败');
    }
  }
}
