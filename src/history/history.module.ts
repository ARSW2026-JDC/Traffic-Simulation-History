import { Module } from '@nestjs/common';
import { HistoryController } from './history.controller';
import { HistoryGateway } from './history.gateway';
import { HistoryService } from './history.service';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../users/roles.guard';

@Module({
  imports: [AuthModule],
  controllers: [HistoryController],
  providers: [HistoryGateway, HistoryService, RolesGuard],
  exports: [HistoryService],
})
export class HistoryModule {}
