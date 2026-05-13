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
    });

    let userName = 'Unknown';
    if (user) {
      userName = user.name || user.email || 'Unknown';
    }

    let message = `${data.field}: ${data.oldValue} -> ${data.newValue}`;
    
    // Handle special cases for deleted/created entities
    if (data.field === 'deleted') {
      message = `deleted:  -> `;
    } else if (data.field === 'created') {
      message = `created:  -> ${data.newValue}`;
    }

    const changeLog = await this.prisma.changeLog.create({
      data: {
        user: { connect: { firebaseUid: data.userId } },
        userName,
        simId: data.simId,
        entityType: data.entityType,
        entityId: data.entityId,
        field: data.field,
        message,
      },
    });

    // Emit via WebSocket if server is set
    if (this.wsServer) {
      this.emitHistory(
        {
          id: changeLog.id,
          userId: changeLog.userId,
          userName: changeLog.userName,
          entityType: changeLog.entityType,
          entityId: changeLog.entityId,
          field: changeLog.field,
          oldValue: data.oldValue,
          newValue: data.newValue,
          timestamp: changeLog.timestamp.getTime(),
        },
        data.simId,
      );
    }

    return changeLog;
  }

  emitHistory(entry: Record<string, unknown>, simId: string) {
    if (!this.wsServer) return;
    this.wsServer.to(`sim:${simId}`).emit('history:new', entry);
  }

  async saveAuditEvent(event: {
    eventId: string;
    simId: string;
    actor: { uid: string; name: string; avatarUrl?: string };
    commandType: string;
    action: 'add' | 'modify' | 'delete';
    entity: { type: string; id: string };
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    payload: Record<string, unknown>;
    occurredAt: number;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: event.actor.uid },
      select: { name: true, email: true },
    });
    const userName = event.actor.name || user?.name || user?.email || 'Sistema';
    const message = `${event.action}: ${event.entity.type}`;

    const entry = await this.prisma.changeLog.create({
      data: {
        eventId: event.eventId,
        user: { connect: { firebaseUid: event.actor.uid } },
        userName,
        simId: event.simId,
        entityType: event.entity.type,
        entityId: event.entity.id,
        action: event.action,
        commandType: event.commandType,
        payload: event.payload as any,
        before: event.before as any,
        after: event.after as any,
        field: event.action,
        message,
        timestamp: new Date(event.occurredAt),
      },
    });

    return {
      id: entry.id,
      eventId: entry.eventId,
      userId: entry.userId,
      userName: entry.userName || userName,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      commandType: entry.commandType,
      payload: entry.payload,
      before: entry.before,
      after: entry.after,
      field: entry.field,
      timestamp: entry.timestamp.getTime(),
    };
  }

  async getHistory(limit = 50, cursor?: string, simId?: string) {
    const entries = await this.prisma.changeLog.findMany({
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      ...(simId ? { where: { simId } } : {}),
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      include: { user: { select: { name: true, email: true } } },
    });
    return entries.map((e) => ({
      ...this.parseMessage(e.message),
      id: e.id,
      eventId: e.eventId,
      userId: e.userId,
      userName: e.userName || e.user.name || e.user.email,
      entityType: e.entityType,
      entityId: e.entityId,
      action: e.action,
      commandType: e.commandType,
      payload: e.payload,
      before: e.before,
      after: e.after,
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
