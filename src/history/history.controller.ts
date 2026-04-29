import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../users/roles.decorator';
import { RolesGuard } from '../users/roles.guard';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { SimIdQueryDto } from '../shared/dto';

@ApiTags('history')
@Controller('history')
@UseGuards(AuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener historial de cambios de simulacion' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Lista de cambios' })
  getHistory(@Query() query: SimIdQueryDto) {
    return this.historyService.getHistory(
      query.limit,
      query.cursor,
      query.simId,
    );
  }
}
