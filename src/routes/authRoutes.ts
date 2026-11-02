import express from 'express';
import { register, login, getProfile, forgotPassword } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { getBookedDates } from '../controllers/orderController';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/profile', protect, getProfile);
router.get('/booked-dates', protect, getBookedDates);

export default router;