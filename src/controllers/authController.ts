import { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const generateToken = (uid: string): string => {
  return jwt.sign({ uid }, process.env.JWT_SECRET as string, {
    expiresIn: '7d',
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    // Create user in Firebase Auth
    const userRecord = await getAuth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
    });

    // Save extra details in Firestore
    const db = getFirestore();
    await db.collection('users').doc(userRecord.uid).set({
      firstName,
      lastName,
      email,
      phone,
      role: 'customer',
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      uid: userRecord.uid,
      firstName,
      lastName,
      email,
      phone,
      role: 'customer',
      token: generateToken(userRecord.uid),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Verify email + password with Firebase Auth
    const authResponse = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true }
    );

    const uid = authResponse.data.localId;

    // Get extra details from Firestore
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();

    res.status(200).json({
      uid,
      firstName: userData?.firstName,
      lastName: userData?.lastName,
      email,
      phone: userData?.phone,
      role: userData?.role,
      token: generateToken(uid),
    });
  } catch (error: any) {
    res.status(401).json({ message: 'Invalid email or password' });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getFirestore();
    const userDoc = await db
      .collection('users')
      .doc((req as any).user.uid)
      .get();

    if (!userDoc.exists) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({ uid: userDoc.id, ...userDoc.data() });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};