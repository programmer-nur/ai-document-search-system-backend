import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  updateUserSchema,
  getUserSchema,
  getUsersSchema,
  deleteUserSchema,
} from './user.validator';
// UserRole enum from Prisma
const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

const router = Router();

// All user routes are protected
router.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(getUsersSchema),
  UserController.getUsers
);
router.get('/:id', authenticate, validate(getUserSchema), UserController.getUserById);
router.patch('/:id', authenticate, validate(updateUserSchema), UserController.updateUser);
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validate(deleteUserSchema),
  UserController.deleteUser
);

export default router;
