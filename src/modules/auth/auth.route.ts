import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { authRateLimit } from '../../middlewares/rateLimit';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from './auth.validator';

const router = Router();

// Public routes with rate limiting
router.post('/register', authRateLimit, validate(registerSchema), AuthController.register);
router.post('/login', authRateLimit, validate(loginSchema), AuthController.login);

// Protected routes
router.get('/me', authenticate, AuthController.getCurrentUser);
router.post('/change-password', authenticate, validate(changePasswordSchema), AuthController.changePassword);

export default router;

