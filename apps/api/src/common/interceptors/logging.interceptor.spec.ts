import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Logger as WinstonLogger } from 'winston';
import { firstValueFrom, of } from 'rxjs';

import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  it('logs request metadata on completion', async () => {
    const logger = { info: jest.fn() } as unknown as WinstonLogger;
    const interceptor = new LoggingInterceptor(logger);
    const request = {
      method: 'GET',
      path: '/museums',
      headers: { 'x-request-id': 'req-999' },
      user: { sub: 'user-1' },
    };
    const response = { statusCode: 200 };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    const handler = { handle: () => of({ ok: true }) } as CallHandler;
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(100).mockReturnValueOnce(150);

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(logger.info).toHaveBeenCalledWith('GET /museums 200', {
      method: 'GET',
      path: '/museums',
      statusCode: 200,
      durationMs: 50,
      requestId: 'req-999',
      userId: 'user-1',
    });

    nowSpy.mockRestore();
  });
});
