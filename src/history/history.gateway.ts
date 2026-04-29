import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as admin from 'firebase-admin';
import { HistoryService } from './history.service';
import { PrismaService } from '../prisma/prisma.service';
import { getFirebaseAdmin } from '../auth/firebase-admin.provider';

@WebSocketGateway({ namespace: '/history', cors: { origin: '*' } })
export class HistoryGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(HistoryGateway.name);

  constructor(
    private readonly historyService: HistoryService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.historyService.setWsServer(server);
  }

  async handleConnection(client: Socket) {
    const handleSocketError = (err: Error) => {
      this.logger.error(`Socket error: ${err.message}`);
      if (!client.disconnected) {
        client.disconnect();
      }
    };

    client.on('error', handleSocketError);

    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);
      if (!token) {
        client.disconnect();
        return;
      }
      const firebaseApp = getFirebaseAdmin();
      if (!firebaseApp) {
        client.disconnect();
        return;
      }
      const decoded = await admin.auth(firebaseApp).verifyIdToken(token);
      const simId =
        (client.handshake.query?.simId as string) ||
        (client.handshake.auth?.simId as string);
      if (simId) {
        client.join(`sim:${simId}`);
      } else {
        client.join(`user:${decoded.uid}`);
      }
    } catch (err) {
      this.logger.error(`Connection error: ${err?.message || 'unknown'}`);
      client.disconnect();
    }
  }
}