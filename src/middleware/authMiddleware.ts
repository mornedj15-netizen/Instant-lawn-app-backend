import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getFirestore } from 'firebase-admin/firestore';

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ message: 'Not authorized, no token' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists) {
      res.status(401).json({ message: 'Not authorized, user not found' });
      return;
    }

    (req as any).user = { uid: decoded.uid, ...userDoc.data() };
    next();
  } catch (error: any) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if ((req as any).user && (req as any).user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as admin' });
  }
};