import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UnitelService } from './unitel.service';

@Module({
  imports: [HttpModule],
  providers: [UnitelService],
  exports: [UnitelService],
})
export class UnitelModule {}
