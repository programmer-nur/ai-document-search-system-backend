import { Router } from 'express';
import { SearchController } from './search.controller';
import { authenticate, requireWorkspace } from '../../middlewares';
import { validate } from '../../middlewares/validate';
import { searchSchema, questionSchema, getQueryHistorySchema } from './search.validator';

const router = Router();

// All routes require authentication and workspace context
router.use(authenticate);

// Search routes
router.post(
  '/workspaces/:id/search',
  requireWorkspace,
  validate(searchSchema),
  SearchController.search
);
router.post(
  '/workspaces/:id/question',
  requireWorkspace,
  validate(questionSchema),
  SearchController.askQuestion
);
router.get(
  '/workspaces/:id/queries',
  requireWorkspace,
  validate(getQueryHistorySchema),
  SearchController.getQueryHistory
);

export default router;

