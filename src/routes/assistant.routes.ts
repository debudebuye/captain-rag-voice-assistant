import { Router } from 'express';
import { z } from 'zod';
import { runPipeline } from '../modules/assistant/pipeline';
import { buildPipelineDependencies } from '../modules/assistant/di';
import { ValidationError } from '../shared/errors';

const router = Router();

const querySchema = z.object({
  query: z.string().min(1, 'query must not be empty').max(1000, 'query is too long'),
  targetLanguage: z
    .string()
    .min(2, 'targetLanguage is required (e.g. "am" for Amharic)')
    .max(20, 'targetLanguage is too long')
    .default('am'),
});

const deps = buildPipelineDependencies();

router.post('/query', async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid request body',
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }

    const result = await runPipeline(deps, parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { router as assistantRouter };