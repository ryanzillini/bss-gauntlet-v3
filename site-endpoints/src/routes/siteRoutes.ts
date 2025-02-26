import express from 'express';
// Import controllers (to be created)
// import { getSiteInfo, updateSiteInfo } from '../controllers/siteController';

const router = express.Router();

/**
 * @route GET /api/site/info
 * @description Get site information
 * @access Public
 */
router.get('/info', (req, res) => {
  // Placeholder until controller is implemented
  res.status(200).json({
    status: 'success',
    message: 'Site info endpoint',
    data: {
      name: 'Example Site',
      version: '1.0.0',
      description: 'This is a placeholder for site information'
    }
  });
});

/**
 * @route POST /api/site/info
 * @description Update site information
 * @access Private
 */
router.post('/info', (req, res) => {
  // Placeholder until controller is implemented
  res.status(200).json({
    status: 'success',
    message: 'Site info updated successfully',
    data: req.body
  });
});

export default router; 