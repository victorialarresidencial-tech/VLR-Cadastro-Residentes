import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  Firestore
} from 'firebase/firestore';
import { Paciente } from '../types/patient';

export const DEFAULT_PROJECT_ID = 'cadastro-de-pacientes-be77f';
export const DEFAULT_DATABASE_ID = '(default)';

const STORAGE_KEY_API_KEY = 'victoria_firebase_api_key';
const STORAGE_KEY_APP_ID = 'victoria_firebase_app_id';
const STORAGE_KEY_AUTH_DOMAIN = 'victoria_firebase_auth_domain';
const STORAGE_KEY_PROJECT_ID = 'victoria_firebase_project_id';
const STORAGE_KEY_DATABASE_ID = 'victoria_firebase_database_id';
const STORAGE_KEY_LOCAL_PATIENTS = 'victoria_lar_pacientes_local';

export interface SavedFirebaseConfig {
  apiKey: string;
  projectId: string;
  databaseId: string;
  authDomain: string;
  storageBucket: string;
  appId?: string;
  messagingSenderId?: string;
}

export function getActiveFirebaseConfig(): SavedFirebaseConfig {
  const envApiKey = (import.meta as any).env?.VITE_FIREBASE_API_KEY || '';
  const storedApiKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API_KEY) || '' : '';
  const apiKey = (envApiKey || storedApiKey).trim();

  const envProjectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '';
  const storedProjectId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PROJECT_ID) || '' : '';
  const projectId = (envProjectId || storedProjectId || DEFAULT_PROJECT_ID).trim();

  const envDatabaseId = (import.meta as any).env?.VITE_FIREBASE_DATABASE_ID || '';
  const storedDatabaseId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_DATABASE_ID) || '' : '';
  const databaseId = (envDatabaseId || storedDatabaseId || DEFAULT_DATABASE_ID).trim();

  const envAuthDomain = (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || '';
  const storedAuthDomain = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_AUTH_DOMAIN) || '' : '';
  const authDomain = (envAuthDomain || storedAuthDomain || `${projectId}.firebaseapp.com`).trim();

  const envAppId = (import.meta as any).env?.VITE_FIREBASE_APP_ID || '';
  const storedAppId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_APP_ID) || '' : '';
  const appId = (envAppId || storedAppId || '').trim();

  return {
    apiKey,
    projectId,
    databaseId,
    authDomain,
    storageBucket: `${projectId}.firebasestorage.app`,
    appId,
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  };
}

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;

export function initializeFirebase(): { app: FirebaseApp | null; db: Firestore | null; error?: string } {
  const config = getActiveFirebaseConfig();

  if (!config.apiKey || config.apiKey.trim() === '') {
    return {
      app: null,
      db: null,
      error: 'Chave Web API do Firebase não configurada. Configure VITE_FIREBASE_API_KEY nos Secrets ou informe a chave no painel de conexão.',
    };
  }

  try {
    if (getApps().length > 0) {
      firebaseAppInstance = getApp();
    } else {
      firebaseAppInstance = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        appId: config.appId || undefined,
        messagingSenderId: config.messagingSenderId || undefined,
      });
    }

    const customDbId = config.databaseId && config.databaseId !== '(default)' ? config.databaseId : undefined;
    firestoreInstance = customDbId
      ? getFirestore(firebaseAppInstance, customDbId)
      : getFirestore(firebaseAppInstance);

    return { app: firebaseAppInstance, db: firestoreInstance };
  } catch (err: any) {
    console.error('Erro ao inicializar Firebase:', err);
    return {
      app: null,
      db: null,
      error: err?.message || 'Falha ao conectar ao Firebase.',
    };
  }
}

export function saveUserCredentials(
  apiKey: string,
  appId?: string,
  projectId?: string,
  databaseId?: string
) {
  if (typeof window !== 'undefined') {
    if (apiKey !== undefined) localStorage.setItem(STORAGE_KEY_API_KEY, apiKey.trim());
    if (appId !== undefined) localStorage.setItem(STORAGE_KEY_APP_ID, appId.trim());
    if (projectId !== undefined) localStorage.setItem(STORAGE_KEY_PROJECT_ID, projectId.trim());
    if (databaseId !== undefined) localStorage.setItem(STORAGE_KEY_DATABASE_ID, databaseId.trim());
    firebaseAppInstance = null;
    firestoreInstance = null;
  }
}

export function clearUserCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_API_KEY);
    localStorage.removeItem(STORAGE_KEY_APP_ID);
    localStorage.removeItem(STORAGE_KEY_PROJECT_ID);
    localStorage.removeItem(STORAGE_KEY_DATABASE_ID);
    localStorage.removeItem(STORAGE_KEY_AUTH_DOMAIN);
    firebaseAppInstance = null;
    firestoreInstance = null;
  }
}

// Local Storage helpers for resilient testing and offline support
export function getLocalPatients(): Paciente[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_PATIENTS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Erro ao ler pacientes locais:', e);
    return [];
  }
}

export function saveLocalPatient(paciente: Paciente): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalPatients();
    const updated = [paciente, ...list.filter((p) => p.id !== paciente.id)];
    localStorage.setItem(STORAGE_KEY_LOCAL_PATIENTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Erro ao salvar paciente localmente:', e);
  }
}

export function deleteLocalPatient(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLocalPatients();
    const updated = list.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY_LOCAL_PATIENTS, JSON.stringify(updated));
  } catch (e) {
    console.error('Erro ao excluir paciente local:', e);
  }
}

// DIRECT FIRESTORE CRUD WITH LOCAL TEST RESILIENCE
export async function cadastrarPacienteNoFirebase(
  paciente: Omit<Paciente, 'id'>
): Promise<{ id: string; savedInFirestore: boolean; errorNotice?: string }> {
  const timestamp = new Date().toISOString();
  const pacienteCompleto = {
    ...paciente,
    criadoEm: timestamp,
    atualizadoEm: timestamp,
  };

  const { db, error } = initializeFirebase();

  // Try direct Firestore first
  if (db && !error) {
    try {
      const colRef = collection(db, 'pacientes');
      const docRef = await addDoc(colRef, pacienteCompleto);
      const novoComId: Paciente = { ...pacienteCompleto, id: docRef.id };
      saveLocalPatient(novoComId);
      return { id: docRef.id, savedInFirestore: true };
    } catch (err: any) {
      console.warn('Erro ao salvar no Firestore. Armazenando localmente para teste:', err);
      const tempId = 'local-' + Date.now();
      const novoComId: Paciente = { ...pacienteCompleto, id: tempId };
      saveLocalPatient(novoComId);
      return {
        id: tempId,
        savedInFirestore: false,
        errorNotice: `Aviso Firestore: ${err?.message || 'Permissão ou banco inacessível'}. O residente foi salvo localmente no seu navegador para você visualizar o teste de cadastro imediatamente.`,
      };
    }
  }

  // Fallback to local storage so patient registration tests ALWAYS succeed and feed the UI
  const tempId = 'local-' + Date.now();
  const novoComId: Paciente = { ...pacienteCompleto, id: tempId };
  saveLocalPatient(novoComId);
  return {
    id: tempId,
    savedInFirestore: false,
    errorNotice: error || 'Chave de API do Firebase não configurada. Paciente gravado em modo local de teste.',
  };
}

export async function atualizarPacienteNoFirebase(id: string, dados: Partial<Paciente>): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const dadosAtualizados = {
    ...dados,
    atualizadoEm: timestamp,
  };

  if (!id.startsWith('local-')) {
    const { db } = initializeFirebase();
    if (db) {
      try {
        const docRef = doc(db, 'pacientes', id);
        await updateDoc(docRef, dadosAtualizados);
      } catch (err) {
        console.warn('Erro ao atualizar no Firestore:', err);
      }
    }
  }

  // Update in local storage
  const list = getLocalPatients();
  const index = list.findIndex((p) => p.id === id);
  if (index !== -1) {
    list[index] = { ...list[index], ...dadosAtualizados };
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_LOCAL_PATIENTS, JSON.stringify(list));
    }
  }

  return true;
}

export async function excluirPacienteNoFirebase(id: string): Promise<boolean> {
  if (!id.startsWith('local-')) {
    const { db } = initializeFirebase();
    if (db) {
      try {
        const docRef = doc(db, 'pacientes', id);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('Erro ao deletar no Firestore:', err);
      }
    }
  }

  deleteLocalPatient(id);
  return true;
}

// REALTIME LISTENER WITH OFFLINE/FALLBACK MERGING
export function ouvirPacientes(
  onUpdate: (pacientes: Paciente[], isOnline: boolean, errorDetail?: string) => void
): () => void {
  const localList = getLocalPatients();
  const { db, error } = initializeFirebase();

  // If Firebase cannot be initialized, immediately provide local test patients
  if (!db || error) {
    onUpdate(localList, false, error);
    return () => {};
  }

  try {
    const colRef = collection(db, 'pacientes');
    // Using simple collection listener without query orderBy prevents Firestore missing index failures
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const firestorePacientes: Paciente[] = [];
        snapshot.forEach((docSnapshot) => {
          firestorePacientes.push({
            id: docSnapshot.id,
            ...(docSnapshot.data() as Omit<Paciente, 'id'>),
          });
        });

        // Sort descending by creation date
        firestorePacientes.sort((a, b) => {
          const tA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
          const tB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
          return tB - tA;
        });

        // Merge any local-only test patients that haven't been synced to Firestore yet
        const currentLocal = getLocalPatients();
        const idsInFirestore = new Set(firestorePacientes.map((p) => p.id));
        const pendingLocal = currentLocal.filter((p) => p.id && p.id.startsWith('local-') && !idsInFirestore.has(p.id));

        const combined = [...firestorePacientes, ...pendingLocal];
        onUpdate(combined, true);
      },
      (snapshotError) => {
        console.error('Erro ao escutar Firestore:', snapshotError);
        // On permission or network error, still show local patients so the user can test the app
        onUpdate(localList, false, snapshotError.message);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    onUpdate(localList, false, err?.message || 'Erro inesperado.');
    return () => {};
  }
}

// SYNC ALL LOCAL PATIENTS TO FIRESTORE
export async function sincronizarPacientesLocais(): Promise<{ synced: number; failed: number }> {
  const { db, error } = initializeFirebase();
  if (!db || error) {
    throw new Error(error || 'Firebase não conectado.');
  }

  const localPatients = getLocalPatients();
  const toSync = localPatients.filter((p) => p.id && p.id.startsWith('local-'));

  let synced = 0;
  let failed = 0;

  for (const paciente of toSync) {
    try {
      const { id, ...dadosSemId } = paciente;
      const colRef = collection(db, 'pacientes');
      await addDoc(colRef, dadosSemId);
      deleteLocalPatient(id!);
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

// Test connection
export async function testarConexaoFirestore(): Promise<{
  ok: boolean;
  message: string;
  count?: number;
  databaseId?: string;
}> {
  const config = getActiveFirebaseConfig();
  const { db, error } = initializeFirebase();

  if (!db || error) {
    return { ok: false, message: error || 'Firebase não configurado.', databaseId: config.databaseId };
  }

  const currentDbId = config.databaseId || '(default)';

  try {
    const colRef = collection(db, 'pacientes');
    const snap = await getDocs(colRef);
    return {
      ok: true,
      message: `Conexão bem-sucedida com o projeto "${config.projectId}" e banco de dados "${currentDbId}". ${snap.size} registros lidos diretamente da coleção 'pacientes' no Firestore.`,
      count: snap.size,
      databaseId: currentDbId,
    };
  } catch (err: any) {
    let detalhe = err?.message || 'Falha ao consultar coleção no Firestore.';
    if (detalhe.includes('permission-denied') || detalhe.includes('Missing or insufficient permissions')) {
      detalhe += ' -> Permissão negada no Firestore. No Firebase Console > Firestore Database > aba Regras (Rules), certifique-se de permitir leitura e escrita, por exemplo: match /{document=**} { allow read, write: if true; }';
    } else if (detalhe.includes('not-found') || detalhe.includes('NOT_FOUND')) {
      detalhe += ` -> Banco de dados "${currentDbId}" não encontrado no projeto "${config.projectId}". Verifique se o Database ID está correto ou se o banco foi criado no Firebase Console.`;
    }
    return {
      ok: false,
      message: detalhe,
      databaseId: currentDbId,
    };
  }
}
