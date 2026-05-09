import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc,
    updateDoc,
    deleteDoc,
    query, 
    collection, 
    where, 
    getDocs, 
    orderBy,
    serverTimestamp
} from "firebase/firestore";
import { initializeApp } from "firebase/app";
import fs from "fs";
import path from "path";
import type { DatabaseAdapter } from "../index.js";

export class FirebaseAdapter implements DatabaseAdapter {
  private db: any;

  constructor() {
    let config: any = null;

    // Check environment variables first (Production/Vercel)
    if (process.env.FIREBASE_PROJECT_ID) {
      console.log("[FIREBASE] Using environment variables for configuration");
      config = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
        firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || "(default)"
      };
    } else {
      // Fallback to local config file (AI Studio Development)
      try {
        const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          console.log("[FIREBASE] Using local firebase-applet-config.json");
        }
      } catch (err) {
        console.warn("[FIREBASE] No configuration found. Please set FIREBASE_* environment variables.");
      }
    }

    if (!config) {
      throw new Error("Firebase configuration is missing. Set FIREBASE_* environment variables or provide firebase-applet-config.json");
    }

    const app = initializeApp(config);
    this.db = getFirestore(app, config.firestoreDatabaseId || "(default)");
  }

  async getDoc(col: string, id: string) {
    const docSnap = await getDoc(doc(this.db, col, id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  }

  async setDoc(col: string, id: string, data: any) {
    await setDoc(doc(this.db, col, id), {
      ...data,
      updated_at: serverTimestamp()
    });
  }

  async addDoc(col: string, data: any) {
    const docRef = await addDoc(collection(this.db, col), {
      ...data,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    return docRef.id;
  }

  async updateDoc(col: string, id: string, data: any) {
    await updateDoc(doc(this.db, col, id), {
      ...data,
      updated_at: serverTimestamp()
    });
  }

  async deleteDoc(col: string, id: string) {
    await deleteDoc(doc(this.db, col, id));
  }

  async getDocs(col: string, filters: any[] = []) {
    let q = query(collection(this.db, col), orderBy("created_at", "desc"));
    // Simplification for now, we can add complex filtering if needed
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}
