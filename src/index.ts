import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import initializeFirebase from './config/db';
import authRoutes from './routes/authRoutes';
import orderRoutes from './routes/orderRoutes';
import inventoryRoutes from './routes/inventoryRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Firebase
initializeFirebase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
// Health check
app.get('/', (req, res) => {
  res.json({ message: 'SESMYL API is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;