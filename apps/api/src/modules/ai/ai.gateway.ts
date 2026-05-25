import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { ErrorCode } from '../../common/errors/error-codes';

import { AiService } from './ai.service';

interface SendMessagePayload {
  sessionId?: string;
  message?: string;
}

// CRITICAL: JWT must be in Socket.io auth handshake object, NEVER in URL query params (PRD §10.5)
@WebSocketGateway({
  namespace: '/ws/ai',
  cors: {
    origin:
      process.env['NODE_ENV'] === 'production'
        ? process.env['ALLOWED_ORIGIN']
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  },
})
export class AiGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AiGateway.name);

  constructor(
    private readonly aiService: AiService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.rejectClient(client, 'No authentication token provided.');
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token, {
        publicKey: this.config.getOrThrow<string>('auth.jwtPublicKey'),
        algorithms: ['RS256'],
      });

      // Guest tokens are not permitted on the AI namespace
      if (payload.role === 'guest') {
        this.rejectClient(client, 'Guest sessions cannot use the AI chat.');
        return;
      }

      client.data.user = payload;
      this.logger.log(`WS /ws/ai connected: ${client.id} (user=${payload.sub})`);
    } catch {
      this.rejectClient(client, 'Invalid or expired token.');
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`WS /ws/ai disconnected: ${client.id}`);
  }

  @SubscribeMessage('ai:send_message')
  async handleSendMessage(client: Socket, payload: SendMessagePayload): Promise<void> {
    const user = client.data.user as JwtPayload | undefined;

    if (!user) {
      client.emit('ai:error', { errorCode: ErrorCode.AUTH_TOKEN_INVALID, message: 'Not authenticated.' });
      return;
    }

    const { sessionId, message } = payload;

    if (!sessionId || typeof sessionId !== 'string') {
      client.emit('ai:error', { errorCode: ErrorCode.VALIDATION_ERROR, message: 'sessionId is required.' });
      return;
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      client.emit('ai:error', { errorCode: ErrorCode.VALIDATION_ERROR, message: 'message is required.' });
      return;
    }

    if (message.length > 2_000) {
      client.emit('ai:error', { errorCode: ErrorCode.VALIDATION_ERROR, message: 'Message too long (max 2000 chars).' });
      return;
    }

    await this.aiService.streamMessage(client, user, sessionId, message.trim());
  }

  private extractToken(client: Socket): string {
    const auth = client.handshake.auth as { token?: string };
    const raw = auth.token ?? '';
    return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  }

  private rejectClient(client: Socket, message: string): void {
    client.emit('ai:error', { errorCode: ErrorCode.AUTH_TOKEN_INVALID, message });
    client.disconnect();
  }
}
