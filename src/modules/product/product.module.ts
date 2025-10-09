import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { UnitelModule } from '../unitel/unitel.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [UnitelModule, UserModule],
  controllers: [ProductController],
})
export class ProductModule {}
