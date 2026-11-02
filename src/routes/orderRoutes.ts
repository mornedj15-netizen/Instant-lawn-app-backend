import express from 'express';
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  getBookedDates,
  getEstimate,
} from '../controllers/orderController';
import { protect, adminOnly } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', protect, createOrder);
router.post('/estimate', protect, getEstimate);
router.get('/my-orders', protect, getMyOrders);
router.get('/booked-dates', protect, getBookedDates);
router.get('/all', protect, adminOnly, getAllOrders);
router.put('/:id/status', protect, adminOnly, updateOrderStatus);
router.put('/:id/cancel', protect, cancelOrder);

export default router;