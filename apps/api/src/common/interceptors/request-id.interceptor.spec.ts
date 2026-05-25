import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

import { RequestIdInterceptor } from './request-id.interceptor';

jest.mock('uuid', () => ({
  v4: () => 'abc-123',
}));

describe('RequestIdInterceptor', () => {
  it('keeps existing request id', async () => {
    const interceptor = new RequestIdInterceptor();
    const headers = { 'x-request-id': 'existing-id' };
    const response = { setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const handler = { handle: () => of({ ok: true }) } as CallHandler;

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(headers['x-request-id']).toBe('existing-id');
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-id');
  });

  it('generates a request id when missing', async () => {
    const interceptor = new RequestIdInterceptor();
    const headers: Record<string, string> = {};
    const response = { setHeader: jest.fn() };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const handler = { handle: () => of({ ok: true }) } as CallHandler;

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(headers['x-request-id']).toBe('req_abc123');
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-ID', 'req_abc123');
  });
});
