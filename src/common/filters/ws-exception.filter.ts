import { Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    let errorMessage = 'Internal server error';
    if (exception instanceof WsException) {
      errorMessage = exception.getError() as string;
    } else if (exception instanceof HttpException) {
      errorMessage = exception.getResponse() as string;
    } else if (exception instanceof Error) {
      errorMessage = exception.message;
    }

    this.logger.error(`WebSocket error: ${errorMessage}`, exception instanceof Error ? exception.stack : undefined);

    client.emit('exception', {
      success: false,
      message: errorMessage,
    });

    // If the client is waiting for an acknowledgement, return error via callback
    const args = host.getArgs();
    const callback = args[args.length - 1];
    if (typeof callback === 'function') {
      callback({ success: false, message: errorMessage });
    }
  }
}
