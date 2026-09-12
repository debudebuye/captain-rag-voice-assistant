import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';
import { assistantRouter } from './routes/assistant.routes';
import { env } from './config/env';
import { logger } from './shared/logger';
import fs from 'node:fs';

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();
  res.on('finish', () => {
    logger.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - start),
      },
      'request',
    );
  });
  next();
}

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(requestLogger);

  fs.mkdirSync(env.AUDIO_DIR, { recursive: true });
  app.use(env.AUDIO_BASE_URL, express.static(env.AUDIO_DIR));

  app.use('/api', healthRouter);
  app.use('/api/assistant', assistantRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}