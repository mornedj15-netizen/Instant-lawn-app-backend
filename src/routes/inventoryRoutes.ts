import express from 'express';
import { getInventory, updateStock } from '../controllers/inventoryController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, adminOnly, getInventory);
router.put('/:id/stock', protect, adminOnly, updateStock);

export default router;