import { Module } from '@nestjs/common';
import { ProductController } from './product.controller';
import { UnitelModule } from '../unitel/unitel.module';

@Module({
  imports: [UnitelModule],
  controllers: [ProductController],
})
export class ProductModule {}
