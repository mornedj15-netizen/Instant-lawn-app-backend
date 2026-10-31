import { Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { ensureInventory } from './inventoryController';

const MAX_ORDERS_PER_DAY = 1;

const LAWN_IDS: Record<string, string> = {
  'Kikuyu': 'kikuyu',
  'LM Berea': 'lm-berea',
  'Golf Green': 'golf-green',
};

// Puts an order's area back into stock (used when an order is cancelled)
const restoreStock = async (order: any): Promise<void> => {
  const id = LAWN_IDS[order.lawnType];
  if (!id) return;

  const db = getFirestore();
  const ref = db.collection('inventory').doc(id);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return;
    const data = doc.data() as any;
    tx.update(ref, { stock: Math.min(data.maxStock, data.stock + order.area) });
  });
};

const getFullDates = async (): Promise<string[]> => {
  const db = getFirestore();
  const today = new Date().toISOString().split("T")[0];
  const snapshot = await db
    .collection("orders")
    .where("deliveryDate", ">=", today)
    .get();

  const counts: Record<string, number> = {};
  snapshot.docs.forEach((doc) => {
    const order = doc.data();
    if (order.status !== "Cancelled") {
      counts[order.deliveryDate] = (counts[order.deliveryDate] || 0) + 1;
    }
  });

  return Object.keys(counts).filter((d) => counts[d] >= MAX_ORDERS_PER_DAY);
};

export const getBookedDates = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    res.status(200).json(await getFullDates());
  } catch (error: any) {
    console.error("getBookedDates error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      lawnType,
      area,
      serviceType,
      deliveryDate,
      address,
      latitude,
      longitude,
      notes,
    } = req.body;

    const areaNum = Number(area);
    const inventoryId = LAWN_IDS[lawnType];
    if (!inventoryId || !Number.isFinite(areaNum) || areaNum <= 0) {
      res.status(400).json({ message: 'Invalid lawn type or area' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    if (deliveryDate < today) {
      res.status(400).json({ message: 'You cannot book a date in the past' });
      return;
    }

    const fullDates = await getFullDates();
    if (fullDates.includes(deliveryDate)) {
      res.status(400).json({ message: 'That date is fully booked' });
      return;
    }

    await ensureInventory();

    const db = getFirestore();
    const inventoryRef = db.collection('inventory').doc(inventoryId);
    const orderRef = db.collection('orders').doc();

    // Check stock, deduct it and save the order in one step
    const result = await db.runTransaction(async (tx) => {
      const inventoryDoc = await tx.get(inventoryRef);
      const stock = inventoryDoc.data()?.stock ?? 0;

      if (stock < areaNum) {
        return { error: `Only ${stock}m² of ${lawnType} is available` };
      }

      tx.update(inventoryRef, { stock: stock - areaNum });
      tx.set(orderRef, {
        customer: (req as any).user.uid,
        lawnType,
        area: areaNum,
        serviceType,
        deliveryDate,
        address,
        latitude: latitude || null,
        longitude: longitude || null,
        status: 'Pending',
        notes: notes || '',
        createdAt: new Date().toISOString(),
      });
      return { error: null };
    });

    if (result.error) {
      res.status(400).json({ message: result.error });
      return;
    }

    const order = await orderRef.get();
    res.status(201).json({ id: order.id, ...order.data() });
  } catch (error: any) {
    console.error('createOrder error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

export const getMyOrders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const db = getFirestore();
    const ordersSnapshot = await db
      .collection("orders")
      .where("customer", "==", (req as any).user.uid)
      .get();

    const orders = ordersSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

    res.status(200).json(orders);
  } catch (error: any) {
    console.error("getMyOrders error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const getAllOrders = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection("orders").get();
    const orders: any[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Look up each customer's name
    const uids = Array.from(new Set(orders.map((o) => o.customer)));
    const userDocs = await Promise.all(
      uids.map((uid) => db.collection("users").doc(uid).get()),
    );
    const names: Record<string, string> = {};
    userDocs.forEach((d) => {
      if (d.exists) {
        const u = d.data();
        names[d.id] = `${u?.firstName} ${u?.lastName}`;
      }
    });

    const result = orders
      .map((o) => ({ ...o, customerName: names[o.customer] || "Unknown" }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.status(200).json(result);
  } catch (error: any) {
    console.error("getAllOrders error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!['Pending', 'Processing', 'Delivered', 'Cancelled'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const db = getFirestore();
    const ref = db.collection('orders').doc(req.params.id);
    const existing = await ref.get();

    if (!existing.exists) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    const order = existing.data() as any;
    if (order.status === 'Cancelled') {
      res.status(400).json({ message: 'This order is already cancelled' });
      return;
    }

    if (status === 'Cancelled') {
      await restoreStock(order);
    }

    await ref.update({ status });
    const updated = await ref.get();
    res.status(200).json({ id: updated.id, ...updated.data() });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getFirestore();
    const ref = db.collection('orders').doc(req.params.id);
    const orderDoc = await ref.get();

    if (!orderDoc.exists) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    const order = orderDoc.data() as any;
    if (order.customer !== (req as any).user.uid) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    if (order.status === 'Cancelled') {
      res.status(400).json({ message: 'This order is already cancelled' });
      return;
    }

    await restoreStock(order);
    await ref.update({ status: 'Cancelled' });

    const updated = await ref.get();
    res.status(200).json({ id: updated.id, ...updated.data() });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};