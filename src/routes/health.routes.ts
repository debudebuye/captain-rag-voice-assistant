import { Router } from 'express';
import { checkDatabaseConnection } from '../shared/db';

const router = Router();

router.get('/health', async (_req, res) => {
  const dbOk = await checkDatabaseConnection();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbOk ? 'ok' : 'unreachable',
    },
  });
});

export { router as healthRouter };