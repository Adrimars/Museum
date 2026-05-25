import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = (request: Partial<Request>, response: Partial<Response>): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    }) as unknown as ArgumentsHost;

  it('formats HTTP exceptions with error code', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const request = {
      method: 'POST',
      url: '/auth/register',
      headers: { 'x-request-id': 'req-123' },
    } as unknown as Request;

    const filter = new HttpExceptionFilter();
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const exception = new HttpException(
      { message: ['Invalid email'], errorCode: 'VALIDATION_ERROR' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, createHost(request, response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid email',
        errorCode: 'VALIDATION_ERROR',
        requestId: 'req-123',
        path: '/auth/register',
        timestamp: expect.any(String),
      }),
    );
    expect(loggerSpy).not.toHaveBeenCalled();

    loggerSpy.mockRestore();
  });

  it('logs and formats unexpected errors', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const request = {
      method: 'GET',
      url: '/health',
      headers: {},
    } as unknown as Request;

    const filter = new HttpExceptionFilter();
    const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(new Error('boom'), createHost(request, response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        errorCode: 'INTERNAL_ERROR',
        requestId: 'unknown',
        path: '/health',
        timestamp: expect.any(String),
      }),
    );
    expect(loggerSpy).toHaveBeenCalled();

    loggerSpy.mockRestore();
  });
});
