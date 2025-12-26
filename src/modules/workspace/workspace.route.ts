import { Router } from 'express';
import { WorkspaceController } from './workspace.controller';
import { authenticate, requireWorkspace, requireWorkspaceRole } from '../../middlewares';
import { validate } from '../../middlewares/validate';
import { WorkspaceRole } from '@prisma/client';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  getWorkspaceSchema,
  getWorkspacesSchema,
  addMemberSchema,
  updateMemberSchema,
  removeMemberSchema,
  deleteWorkspaceSchema,
} from './workspace.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Workspace CRUD
router.post('/', validate(createWorkspaceSchema), WorkspaceController.create);
router.get('/', validate(getWorkspacesSchema), WorkspaceController.getAll);
router.get(
  '/:id',
  validate(getWorkspaceSchema),
  requireWorkspace,
  WorkspaceController.getById
);
router.patch(
  '/:id',
  validate(updateWorkspaceSchema),
  requireWorkspace,
  requireWorkspaceRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN),
  WorkspaceController.update
);
router.delete(
  '/:id',
  validate(deleteWorkspaceSchema),
  requireWorkspace,
  requireWorkspaceRole(WorkspaceRole.OWNER),
  WorkspaceController.delete
);

// Member management
router.post(
  '/:id/members',
  validate(addMemberSchema),
  requireWorkspace,
  requireWorkspaceRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN),
  WorkspaceController.addMember
);
router.get(
  '/:id/members',
  validate(getWorkspaceSchema),
  requireWorkspace,
  WorkspaceController.getMembers
);
router.patch(
  '/:id/members/:memberId',
  validate(updateMemberSchema),
  requireWorkspace,
  requireWorkspaceRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN),
  WorkspaceController.updateMember
);
router.delete(
  '/:id/members/:memberId',
  validate(removeMemberSchema),
  requireWorkspace,
  requireWorkspaceRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN),
  WorkspaceController.removeMember
);

export default router;

