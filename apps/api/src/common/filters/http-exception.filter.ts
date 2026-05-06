import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const resp = exceptionResponse as Record<string, unknown>;
      message = (resp['message'] as string | string[]) instanceof Array
        ? (resp['message'] as string[])[0] ?? message
        : (resp['message'] as string) ?? message;
      errorCode = (resp['errorCode'] as string) ?? errorCode;
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const requestId = (request.headers['x-request-id'] as string) ?? 'unknown';

    response.status(status).json({
      statusCode: status,
      message,
      errorCode,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
