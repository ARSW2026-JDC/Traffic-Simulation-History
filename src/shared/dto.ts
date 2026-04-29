import { IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 50, description: 'Cantidad de elementos' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Cursor para paginación' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SimIdQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'ID de la simulación' })
  @IsOptional()
  @IsString()
  simId?: string;
}

export class RoleDto {
  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] })
  @IsString()
  role: 'USER' | 'ADMIN';
}

export class EstatusDto {
  @ApiProperty({ example: 'BLOCKED', enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'] })
  @IsString()
  estatus: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}
