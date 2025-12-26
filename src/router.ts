import { Router } from 'express';
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

// User routes
router.use('/users', userRoutes);

export default router;
