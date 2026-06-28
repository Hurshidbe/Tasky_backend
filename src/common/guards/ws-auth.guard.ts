import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket authentication guard.
 * Replaces the duplicate tokenChecker() methods in CardsService and ProjectsService.
 * Extracts and verifies the JWT from Socket handshake and attaches the user payload.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();

    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new WsException('Authentication token not found');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      client.data.user = payload;
      return true;
    } catch (error) {
      this.logger.warn(`WebSocket auth failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new WsException('Authentication failed');
    }
  }

  private extractToken(client: Socket): string | null {
    return client.handshake.auth?.token
      || client.handshake.headers.authorization
      || null;
  }
}
