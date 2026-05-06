import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 

async function check() {
  try {
    const adminRef = doc(db, "users", "admin");
    const docSnap = await getDoc(adminRef);
    if (docSnap.exists()) {
        console.log("Admin User found:", docSnap.data());
    } else {
        console.log("Admin User NOT found!");
    }
  } catch (err: any) {
    console.error("ERROR:", err.code, err.message);
  }
}

check();
