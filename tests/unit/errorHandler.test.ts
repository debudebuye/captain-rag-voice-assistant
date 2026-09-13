import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../src/middleware/errorHandler';
import {
  ExternalServiceError,
  ValidationError,
  AppError,
} from '../../src/shared/errors';

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as unknown as Response;
  return res;
}

const req = {} as Request;
const next = (() => {}) as NextFunction;

describe('errorHandler', () => {
  it('hides raw external-service details from the client', () => {
    const res = mockRes();
    const raw = new Error('Cloudflare API 400: internal proxy secret stack trace');
    errorHandler(
      new ExternalServiceError('cloudflare', 'Failed to generate embeddings', raw.message),
      req,
      res,
      next,
    );

    expect(res.statusCode).toBe(502);
    const body = res.body as { error: { code: string; details?: unknown } };
    expect(body.error.code).toBe('CLOUDFLARE_ERROR');
    expect(body.error.details).toBeUndefined();
  });

  it('keeps structured validation details for the client', () => {
    const res = mockRes();
    errorHandler(
      new ValidationError('Invalid request body', [{ path: 'query', message: 'Required' }]),
      req,
      res,
      next,
    );

    const body = res.body as { error: { code: string; message: string; details: unknown } };
    expect(res.statusCode).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual([{ path: 'query', message: 'Required' }]);
  });

  it('returns a generic 500 for unexpected errors without exposing internals', () => {
    const res = mockRes();
    errorHandler(new Error('db connection string leaked: postgres://user:pass@host'), req, res, next);

    expect(res.statusCode).toBe(500);
    const body = res.body as { error: { code: string; message: string; details?: unknown } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    expect(body.error.details).toBeUndefined();
  });

  it('preserves app error status codes', () => {
    const res = mockRes();
    errorHandler(new AppError(503, 'KB_NOT_INDEXED', 'Run seed first'), req, res, next);
    expect(res.statusCode).toBe(503);
  });
});