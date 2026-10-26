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
  query,
  limit,
  serverTimestamp,
  Firestore,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import { Paciente } from '../types/patient';

/**
 * Projeto oficial Victoria Lar Residencial
 */
export const TARGET_FIREBASE_PROJECT_ID = 'victoria-lar-residencial';

export interface FirebaseEnvironmentConfig {
  apiKey: string;
  projectId: string;
  authDomain: string;
  storageBucket: string;
  appId: string;
  messagingSenderId?: string;
  databaseId?: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  missingVars: string[];
  config: FirebaseEnvironmentConfig | null;
  errorMessage?: string;
}

/**
 * Validação rigorosa das variáveis de ambiente fornecidas pelo ambiente/build.
 * Leitura estrita de variáveis de ambiente.
 * Nenhuma chave ou token é impresso em logs.
 */
export function validateFirebaseEnvironment(): ConfigValidationResult {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env || {};

  const apiKey = (env.VITE_FIREBASE_API_KEY || '').trim();
  const projectId = (env.VITE_FIREBASE_PROJECT_ID || TARGET_FIREBASE_PROJECT_ID).trim();
  const authDomain = (env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`).trim();
  const storageBucket = (
    env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`
  ).trim();
  const appId = (env.VITE_FIREBASE_APP_ID || '').trim();
  const messagingSenderId = (env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();

  // Normalização do Database ID: '(default)', '(defaut)', 'default' ou vazio -> banco padrão
  const rawDbId = (env.VITE_FIREBASE_DATABASE_ID || '').trim();
  const isDefaultDatabase =
    !rawDbId ||
    rawDbId === '(default)' ||
    rawDbId === '(defaut)' ||
    rawDbId.toLowerCase() === 'default';
  const databaseId = isDefaultDatabase ? undefined : rawDbId;

  const missingVars: string[] = [];
  if (!apiKey) missingVars.push('VITE_FIREBASE_API_KEY');
  if (!projectId) missingVars.push('VITE_FIREBASE_PROJECT_ID');
  if (!appId) missingVars.push('VITE_FIREBASE_APP_ID');

  if (missingVars.length > 0) {
    return {
      isValid: false,
      missingVars,
      config: null,
      errorMessage: `Configuração do Firebase incompleta no ambiente. Variáveis obrigatórias ausentes nos Secrets: ${missingVars.join(
        ', '
      )}.`,
    };
  }

  return {
    isValid: true,
    missingVars: [],
    config: {
      apiKey,
      projectId,
      authDomain,
      storageBucket,
      appId,
      messagingSenderId: messagingSenderId || undefined,
      databaseId,
    },
  };
}

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

/**
 * Inicializa ou reutiliza a instância do Firebase App e Firestore.
 * Garante uma única instância e valida variáveis obrigatórias.
 */
export function getFirebaseServices(): {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
  config: FirebaseEnvironmentConfig;
} {
  const validation = validateFirebaseEnvironment();

  if (!validation.isValid || !validation.config) {
    throw new Error(
      validation.errorMessage ||
        'Não foi possível inicializar o Firebase: variáveis de ambiente ausentes.'
    );
  }

  const { config } = validation;

  if (!firebaseAppInstance) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseAppInstance = existingApps[0];
    } else {
      firebaseAppInstance = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        appId: config.appId,
        messagingSenderId: config.messagingSenderId,
      });
    }
  }

  if (!firestoreInstance) {
    firestoreInstance = config.databaseId
      ? getFirestore(firebaseAppInstance, config.databaseId)
      : getFirestore(firebaseAppInstance);
  }

  if (!authInstance) {
    authInstance = getAuth(firebaseAppInstance);
  }

  return {
    app: firebaseAppInstance,
    db: firestoreInstance,
    auth: authInstance,
    config,
  };
}

/**
 * Autenticação via Google para equipe autorizada
 */
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function logout(): Promise<void> {
  const { auth } = getFirebaseServices();
  await firebaseSignOut(auth);
}

export function subscribeToAuthState(callback: (user: FirebaseUser | null) => void): () => void {
  try {
    const { auth } = getFirebaseServices();
    return onAuthStateChanged(auth, callback);
  } catch {
    callback(null);
    return () => {};
  }
}

/**
 * Tratamento centralizado de erros do Firestore (sem vazar credenciais nos logs).
 */
export function formatFirestoreError(error: unknown, operacao: string): Error {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as { code?: string })?.code || '';

  if (
    errorCode === 'permission-denied' ||
    rawMessage.includes('permission-denied') ||
    rawMessage.includes('Missing or insufficient permissions')
  ) {
    return new Error(
      `Permissão negada ao ${operacao} no Firestore. O usuário atual precisa estar autenticado e autorizado nas regras de segurança da Victoria Lar Residencial.`
    );
  }

  if (
    errorCode === 'unavailable' ||
    rawMessage.includes('unavailable') ||
    rawMessage.includes('offline')
  ) {
    return new Error(
      `Serviço Firestore temporariamente indisponível ao ${operacao}. Verifique a conexão de rede da estação de trabalho.`
    );
  }

  if (errorCode === 'not-found' || rawMessage.includes('NOT_FOUND')) {
    return new Error(
      `Banco de dados ou registro de residente não encontrado no projeto "${TARGET_FIREBASE_PROJECT_ID}".`
    );
  }

  return new Error(`Falha no Firestore ao ${operacao}: ${rawMessage}`);
}

/**
 * OPERAÇÕES CRUD EXCLUSIVAS NO CLOUD FIRESTORE
 * Sem qualquer uso de armazenamento local do cliente; persistência 100% Firestore.
 */

/**
 * Cadastra um novo residente exclusivamente no Firestore.
 * Rejeita a operação em caso de erro; nunca salva localmente nem simula sucesso.
 */
export async function cadastrarPacienteNoFirebase(
  paciente: Omit<Paciente, 'id'>
): Promise<{ id: string }> {
  const { db } = getFirebaseServices();

  const timestampIso = new Date().toISOString();
  const payload = {
    ...paciente,
    criadoEm: timestampIso,
    atualizadoEm: timestampIso,
    servidorTimestamp: serverTimestamp(),
  };

  try {
    const colRef = collection(db, 'pacientes');
    const docRef = await addDoc(colRef, payload);
    return { id: docRef.id };
  } catch (error) {
    throw formatFirestoreError(error, 'cadastrar novo residente');
  }
}

/**
 * Atualiza um residente existente exclusivamente no Firestore.
 */
export async function atualizarPacienteNoFirebase(
  id: string,
  dados: Partial<Paciente>
): Promise<boolean> {
  if (!id || id.trim() === '') {
    throw new Error('ID do residente inválido para atualização no Firestore.');
  }

  const { db } = getFirebaseServices();

  const timestampIso = new Date().toISOString();
  const payload = {
    ...dados,
    atualizadoEm: timestampIso,
    servidorAtualizadoEm: serverTimestamp(),
  };

  try {
    const docRef = doc(db, 'pacientes', id);
    await updateDoc(docRef, payload);
    return true;
  } catch (error) {
    throw formatFirestoreError(error, `atualizar os dados do residente (${id})`);
  }
}

/**
 * Exclui um residente exclusivamente do Firestore.
 */
export async function excluirPacienteNoFirebase(id: string): Promise<boolean> {
  if (!id || id.trim() === '') {
    throw new Error('ID do residente inválido para exclusão no Firestore.');
  }

  const { db } = getFirebaseServices();

  try {
    const docRef = doc(db, 'pacientes', id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    throw formatFirestoreError(error, `excluir o residente (${id})`);
  }
}

/**
 * Listener em tempo real da coleção 'pacientes' do Firestore.
 * Alimentado exclusivamente pelo Firestore; sem mesclagem ou injeção de dados locais.
 */
export function ouvirPacientes(
  onSuccess: (pacientes: Paciente[]) => void,
  onError: (error: Error) => void
): () => void {
  let services: ReturnType<typeof getFirebaseServices>;

  try {
    services = getFirebaseServices();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }

  try {
    const colRef = collection(services.db, 'pacientes');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const lista: Paciente[] = [];
        snapshot.forEach((docSnap) => {
          lista.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Paciente, 'id'>),
          });
        });

        // Ordenação decrescente por data de criação / admissão
        lista.sort((a, b) => {
          const tA = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
          const tB = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
          return tB - tA;
        });

        onSuccess(lista);
      },
      (firestoreErr) => {
        const formatted = formatFirestoreError(firestoreErr, 'escutar a coleção de residentes');
        onError(formatted);
      }
    );

    return unsubscribe;
  } catch (err) {
    onError(formatFirestoreError(err, 'iniciar escuta em tempo real'));
    return () => {};
  }
}

/**
 * Testa a conexão real com a coleção 'pacientes' do Firestore.
 * Não aconselha regras inseguras como 'allow read, write: if true'.
 */
export async function testarConexaoFirestore(): Promise<{
  ok: boolean;
  message: string;
  count?: number;
  projectId: string;
  databaseId: string;
}> {
  const validation = validateFirebaseEnvironment();
  if (!validation.isValid || !validation.config) {
    return {
      ok: false,
      message:
        validation.errorMessage ||
        'Variáveis de ambiente do Firebase ausentes no ambiente de execução.',
      projectId: TARGET_FIREBASE_PROJECT_ID,
      databaseId: '(default)',
    };
  }

  try {
    const { db, config } = getFirebaseServices();
    const currentDb = config.databaseId || '(default)';
    const colRef = collection(db, 'pacientes');
    const snap = await getDocs(query(colRef, limit(10)));

    return {
      ok: true,
      message: `Conexão bem-sucedida com o Firestore do projeto "${config.projectId}" (Banco: ${currentDb}). Leitura operacional verificada diretamente no Firestore.`,
      count: snap.size,
      projectId: config.projectId,
      databaseId: currentDb,
    };
  } catch (err: unknown) {
    const formatted = formatFirestoreError(err, 'testar conexão');
    return {
      ok: false,
      message: formatted.message,
      projectId: validation.config?.projectId || TARGET_FIREBASE_PROJECT_ID,
      databaseId: validation.config?.databaseId || '(default)',
    };
  }
}
