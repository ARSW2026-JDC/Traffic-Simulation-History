import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  private wsServer: Server | null = null;

  constructor(private readonly prisma: PrismaService) {}

  setWsServer(server: Server) {
    this.wsServer = server;
  }

  emitHistory(
    entry: {
      id: string;
      userId: string;
      userName: string;
      entityType: string;
      entityId: string;
      field: string;
      oldValue: string;
      newValue: string;
      timestamp: number;
    },
    simId: string,
  ) {
    if (!this.wsServer) return;
    this.wsServer.to(`sim:${simId}`).emit('history:new', entry);
  }

  async saveChange(data: {
    userId: string;
    simId: string;
    entityType: string;
    entityId: string;
    field: string;
    oldValue: string;
    newValue: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: data.userId },
      select: { name: true, email: true },
    });

    const message = `${data.field}: ${data.oldValue} -> ${data.newValue}`;
    const entry = await this.prisma.changeLog.create({
      data: {
        user: { connect: { firebaseUid: data.userId } },
        simId: data.simId,
        entityType: data.entityType,
        entityId: data.entityId,
        field: data.field,
        message,
      },
    });

    return {
      id: entry.id,
      userId: entry.userId,
      userName: user?.name || user?.email || 'Unknown',
      entityType: entry.entityType,
      entityId: entry.entityId,
      field: entry.field,
      oldValue: data.oldValue,
      newValue: data.newValue,
      timestamp: entry.timestamp.getTime(),
    };
  }

  async getHistory(limit = 50, cursor?: string, simId?: string) {
    const entries = await this.prisma.changeLog.findMany({
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      ...(simId ? { where: { simId } } : {}),
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });
    return entries.map((e) => ({
      ...this.parseMessage(e.message),
      id: e.id,
      userId: e.userId,
      userName: e.user.name || e.user.email,
      entityType: e.entityType,
      entityId: e.entityId,
      field: e.field,
      timestamp: e.timestamp.getTime(),
    }));
  }

  private parseMessage(message: string) {
    const arrowIndex = message.indexOf(' -> ');
    if (arrowIndex === -1) {
      return { oldValue: '', newValue: '' };
    }
    const before = message.slice(0, arrowIndex);
    const after = message.slice(arrowIndex + 4);
    const colonIndex = before.indexOf(': ');
    const oldValue = colonIndex === -1 ? before : before.slice(colonIndex + 2);
    return {
      oldValue: oldValue.trim(),
      newValue: after.trim(),
    };
  }
}
