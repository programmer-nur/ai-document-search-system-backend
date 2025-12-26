import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import {
  registerSchema,
  loginSchema,
  updateUserSchema,
  getUserSchema,
  getUsersSchema,
  deleteUserSchema,
} from './user.validator';
import type { UserRole } from '@prisma/client';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), UserController.register);
router.post('/login', validate(loginSchema), UserController.login);

// Protected routes
router.get('/me', authenticate, UserController.getCurrentUser);
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
