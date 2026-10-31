import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

let app: App;
let firestore: Firestore;

const initializeFirebase = (): void => {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(join(__dirname, '../../serviceAccount.json'), 'utf8')
    );

    app = initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      }),
    });

    firestore = getFirestore(app);
    console.log('Firebase Connected Successfully');
  } catch (error) {
    console.error(`Firebase connection error: ${error}`);
    process.exit(1);
  }
};

export const getDB = (): Firestore => firestore;
export default initializeFirebase;