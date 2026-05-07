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
import type { DatabaseAdapter } from "../index.ts";

export class FirebaseAdapter implements DatabaseAdapter {
  private db: any;

  constructor() {
    const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
    const app = initializeApp(config);
    this.db = getFirestore(app, config.firestoreDatabaseId);
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
