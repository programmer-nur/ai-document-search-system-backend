import { Router } from 'express';
import authRoutes from './modules/auth/auth.route';
import userRoutes from './modules/user/user.route';
import workspaceRoutes from './modules/workspace/workspace.route';
import documentRoutes from './modules/document/document.route';
import searchRoutes from './modules/search/search.route';

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

// Workspace routes
router.use('/workspaces', workspaceRoutes);

// Document routes
router.use('/documents', documentRoutes);

// Search routes
router.use('/search', searchRoutes);

export default router;
