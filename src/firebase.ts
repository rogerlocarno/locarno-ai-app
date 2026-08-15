import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// IMPORTANTE: reemplaza estos valores con los de TU proyecto de Firebase
// (Firebase Console -> Configuración del proyecto -> tus apps -> SDK setup and configuration).
// Puedes usar un proyecto de Firebase nuevo, separado del de la OPV, o el mismo si prefieres.
const firebaseConfig = {
  apiKey: 'TU_API_KEY',
  authDomain: 'TU_PROYECTO.firebaseapp.com',
  projectId: 'TU_PROYECTO',
  storageBucket: 'TU_PROYECTO.appspot.com',
  messagingSenderId: 'TU_SENDER_ID',
  appId: 'TU_APP_ID',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);