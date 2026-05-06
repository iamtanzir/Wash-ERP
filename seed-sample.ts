import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 

async function seedData() {
  try {
    console.log("Seeding sample order...");
    const orderRef = await addDoc(collection(db, "erp_orders"), {
        buyer: "SAMPLE BUYER",
        file_no: "FILE-TEST-001",
        style_no: "STYLE-2024-X",
        order_qty: 5000,
        color: "NAVY BLUE",
        wash_type: "NORMAL WASH",
        sew_floor: "FLOOR-G2",
        status: "Pending",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
    });
    console.log("SUCCESS: Sample order created with ID:", orderRef.id);
  } catch (err: any) {
    console.error("ERROR:", err.code, err.message);
  }
}

seedData();
