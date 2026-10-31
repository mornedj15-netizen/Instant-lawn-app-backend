import { Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';

// Starting data, created automatically the first time inventory is needed.
// Replace the prices with SESMYL's real prices.
const DEFAULT_STOCK = [
  { id: 'kikuyu', name: 'Kikuyu', stock: 850, maxStock: 1000, pricePerM2: 45 },
  { id: 'lm-berea', name: 'LM Berea', stock: 320, maxStock: 500, pricePerM2: 65 },
  { id: 'golf-green', name: 'Golf Green', stock: 80, maxStock: 300, pricePerM2: 95 },
];

export const ensureInventory = async (): Promise<void> => {
  const db = getFirestore();
  const snapshot = await db.collection('inventory').limit(1).get();
  if (!snapshot.empty) return;

  const batch = db.batch();
  DEFAULT_STOCK.forEach(({ id, ...data }) => {
    batch.set(db.collection('inventory').doc(id), {
      ...data,
      lastRestocked: new Date().toISOString().split('T')[0],
    });
  });
  await batch.commit();
};

export const getInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureInventory();
    const db = getFirestore();
    const snapshot = await db.collection('inventory').get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(items);
  } catch (error: any) {
    console.error('getInventory error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

export const updateStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const change = Number(req.body.change);
    if (!Number.isFinite(change) || change === 0) {
      res.status(400).json({ message: 'A valid stock change is required' });
      return;
    }

    const db = getFirestore();
    const ref = db.collection('inventory').doc(req.params.id);

    const updated = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;

      const data = doc.data() as any;
      const newStock = Math.max(0, Math.min(data.maxStock, data.stock + change));
      const update: any = { stock: newStock };
      if (change > 0) update.lastRestocked = new Date().toISOString().split('T')[0];

      tx.update(ref, update);
      return { id: doc.id, ...data, ...update };
    });

    if (!updated) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('updateStock error:', error.message);
    res.status(500).json({ message: error.message });
  }
};