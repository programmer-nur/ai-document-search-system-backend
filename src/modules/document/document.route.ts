import { Router } from 'express';
import { DocumentController } from './document.controller';
import { authenticate, requireWorkspace } from '../../middlewares';
import { validate } from '../../middlewares/validate';
import { uploadSingle, uploadMultiple, handleUploadError } from '../../middlewares/upload';
import {
  createDocumentSchema,
  updateDocumentSchema,
  getDocumentSchema,
  getDocumentsSchema,
  deleteDocumentSchema,
} from './document.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Document routes with workspace context
router.get(
  '/workspaces/:id/documents/upload-url',
  requireWorkspace,
  DocumentController.getUploadUrl
);

// Upload endpoints (with multer middleware)
router.post(
  '/workspaces/:id/documents/upload',
  requireWorkspace,
  uploadSingle,
  handleUploadError,
  DocumentController.upload
);

router.post(
  '/workspaces/:id/documents/upload-multiple',
  requireWorkspace,
  uploadMultiple,
  handleUploadError,
  DocumentController.uploadMultiple
);

// Legacy create endpoint (for backward compatibility)
router.post(
  '/workspaces/:id/documents',
  requireWorkspace,
  validate(createDocumentSchema),
  DocumentController.create
);

router.get(
  '/workspaces/:id/documents',
  requireWorkspace,
  validate(getDocumentsSchema),
  DocumentController.getAll
);

// Document routes without workspace in path (workspace verified in service)
router.get('/:id', validate(getDocumentSchema), DocumentController.getById);
router.patch('/:id', validate(updateDocumentSchema), DocumentController.update);
router.delete('/:id', validate(deleteDocumentSchema), DocumentController.delete);
router.post('/:id/reindex', validate(getDocumentSchema), DocumentController.reindex);

export default router;
