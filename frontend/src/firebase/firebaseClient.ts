import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD-KcEDAkKxdFtlglespR9hZWoZa4NZO5I",
  authDomain: "mumbaihack-8f8d4.firebaseapp.com",
  projectId: "mumbaihack-8f8d4",
  storageBucket: "mumbaihack-8f8d4.firebasestorage.app",
  messagingSenderId: "367484473612",
  appId: "1:367484473612:web:5bcc86011d9fe22aabf929",
  measurementId: "G-JWQDKC56QX"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

const shouldUseEmulators =
  import.meta.env.DEV && import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true';

if (shouldUseEmulators) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, 'localhost', 8081);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectStorageEmulator(storage, 'localhost', 9199);
}

export { app, auth, firestore, storage, functions };

