import { Router } from 'express';
import authRoutes from './modules/auth/auth.route';
import userRoutes from './modules/user/user.route';

const router = Router();

// API info
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    version: '1.0.0',
  });
});

// Auth routes
router.use('/auth', authRoutes);

// User routes
router.use('/users', userRoutes);

export default router;
