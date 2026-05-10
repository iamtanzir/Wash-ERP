import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Safe import for environment where config might be missing initially
let firebaseConfig = {
    apiKey: "placeholder",
    authDomain: "placeholder",
    projectId: "placeholder",
    storageBucket: "placeholder",
    messagingSenderId: "placeholder",
    appId: "placeholder"
};

try {
    // @ts-ignore
    const config = await import("../../firebase-applet-config.json");
    if (config.default) firebaseConfig = config.default;
} catch (e) {
    console.warn("Firebase config missing, using placeholders. Please run Firebase Setup if needed.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
