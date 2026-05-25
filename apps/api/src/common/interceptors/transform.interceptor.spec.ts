import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';

import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  it('wraps response payloads in an envelope', async () => {
    const interceptor = new TransformInterceptor();
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as unknown as ExecutionContext;
    const handler = {
      handle: () => of({ ok: true }),
    } as CallHandler;

    const result = await firstValueFrom(interceptor.intercept(context, handler));

    expect(result).toEqual({
      statusCode: 201,
      data: { ok: true },
      timestamp: expect.any(String),
    });
  });
});
