import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
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

/**
 * E-mail oficial do Administrador do Victoria Lar Residencial
 * Conforme estabelecido nas regras de segurança do Firestore (firestore.rules)
 */
export const ADMIN_BOOTSTRAP_EMAIL = 'victorialarresidencial@gmail.com';

export type DiagnosticStatus =
  | 'verificando_autenticacao'
  | 'usuario_nao_autenticado'
  | 'autenticado_sem_autorizacao'
  | 'regras_incompativeis_ou_nao_publicadas'
  | 'projeto_ou_banco_incorreto'
  | 'servico_indisponivel'
  | 'falha_configuracao_firebase'
  | 'conectado_autorizado';

export interface DiagnosticResult {
  status: DiagnosticStatus;
  title: string;
  description: string;
  recommendation: string;
  isAdmin: boolean;
  isStaff: boolean;
  canReadResidents: boolean;
  canWriteResidents: boolean;
  canDeleteResidents: boolean;
}

export interface UserAuthorization {
  isAuthenticated: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  role: 'admin' | 'funcionario' | 'nao_autorizado' | 'desconectado';
  user: FirebaseUser | null;
  email: string | null;
  uid: string | null;
  verificationSource: 'bootstrap_admin' | 'admins_collection' | 'funcionarios_collection' | 'none';
  error?: string;
}

/**
 * Verifica a autorização real do usuário autenticado antes de liberar qualquer listener ou consulta.
 * Regras do modelo RBAC da Victoria Lar Residencial:
 * 1. Bootstrap Admin: victorialarresidencial@gmail.com possui acesso administrativo garantido.
 * 2. Coleção /admins/{uid}: se o documento existir e estiver ativo, usuário é Administrador.
 * 3. Coleção /funcionarios/{uid}: se o documento existir e estiver ativo, usuário é Funcionário Autorizado.
 * 4. Padrão Zero-Trust: acesso negado se não houver registro institucional comprovado.
 */
export async function verificarAutorizacaoUsuario(
  user: FirebaseUser | null
): Promise<UserAuthorization> {
  if (!user) {
    return {
      isAuthenticated: false,
      isAuthorized: false,
      isAdmin: false,
      isStaff: false,
      role: 'desconectado',
      user: null,
      email: null,
      uid: null,
      verificationSource: 'none',
    };
  }

  const userEmail = (user.email || '').toLowerCase().trim();
  const isBootstrap = userEmail === ADMIN_BOOTSTRAP_EMAIL.toLowerCase().trim();

  // 1. Administrador institucional oficial (Bootstrap Admin)
  if (isBootstrap) {
    return {
      isAuthenticated: true,
      isAuthorized: true,
      isAdmin: true,
      isStaff: true,
      role: 'admin',
      user,
      email: user.email,
      uid: user.uid,
      verificationSource: 'bootstrap_admin',
    };
  }

  // 2. Consulta à coleção /admins/{uid}
  try {
    const { db } = getFirebaseServices();

    try {
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists()) {
        const data = adminDoc.data();
        if (data?.ativo === true) {
          return {
            isAuthenticated: true,
            isAuthorized: true,
            isAdmin: true,
            isStaff: true,
            role: 'admin',
            user,
            email: user.email,
            uid: user.uid,
            verificationSource: 'admins_collection',
          };
        }
      }
    } catch {
      // Ignorar erro se documento não existir ou permissão para /admins for restrita
    }

    // 3. Consulta à coleção /funcionarios/{uid}
    try {
      const staffDoc = await getDoc(doc(db, 'funcionarios', user.uid));
      if (staffDoc.exists()) {
        const data = staffDoc.data();
        if (data?.ativo === true) {
          return {
            isAuthenticated: true,
            isAuthorized: true,
            isAdmin: false,
            isStaff: true,
            role: 'funcionario',
            user,
            email: user.email,
            uid: user.uid,
            verificationSource: 'funcionarios_collection',
          };
        }
      }
    } catch {
      // Ignorar erro se documento não existir ou permissão for restrita
    }

    // Usuário autenticado mas sem registro nas coleções RBAC
    return {
      isAuthenticated: true,
      isAuthorized: false,
      isAdmin: false,
      isStaff: false,
      role: 'nao_autorizado',
      user,
      email: user.email,
      uid: user.uid,
      verificationSource: 'none',
    };
  } catch (err: unknown) {
    const isOffline =
      err instanceof Error &&
      (err.message.includes('unavailable') ||
        err.message.includes('offline') ||
        err.message.includes('network'));

    return {
      isAuthenticated: true,
      isAuthorized: false,
      isAdmin: false,
      isStaff: false,
      role: 'nao_autorizado',
      user,
      email: user.email,
      uid: user.uid,
      verificationSource: 'none',
      error: isOffline
        ? 'Serviço do Firestore temporariamente indisponível. Verifique sua conexão de rede.'
        : undefined,
    };
  }
}

/**
 * Diagnostica detalhadamente o estado de conexão e autorização com o Cloud Firestore.
 * Não registra tokens ou chaves em logs.
 * Preserva integralmente a distinção entre administradores e funcionários.
 */
export function diagnosticarAcessoFirestore(
  user: FirebaseUser | null,
  error?: unknown,
  authStatus?: UserAuthorization
): DiagnosticResult {
  const envVal = validateFirebaseEnvironment();
  if (!envVal.isValid) {
    return {
      status: 'falha_configuracao_firebase',
      title: 'Configuração do Firebase Incompleta ou Inconsistente',
      description:
        envVal.errorMessage ||
        'Variáveis obrigatórias do Firebase ausentes no ambiente de execução.',
      recommendation:
        envVal.missingVars.length > 0
          ? `Configure as seguintes variáveis nos Secrets do AI Studio: ${envVal.missingVars.join(
              ', '
            )}.`
          : 'Verifique a configuração do projeto no arquivo de variáveis de ambiente.',
      isAdmin: false,
      isStaff: false,
      canReadResidents: false,
      canWriteResidents: false,
      canDeleteResidents: false,
    };
  }

  if (!user) {
    return {
      status: 'usuario_nao_autenticado',
      title: 'Usuário Não Autenticado',
      description:
        'Nenhum usuário conectado. O acesso aos dados clínicos da Victoria Lar Residencial exige autenticação institucional via Google.',
      recommendation:
        'Efetue login com o Google utilizando sua conta institucional para iniciar a comunicação com o Cloud Firestore.',
      isAdmin: false,
      isStaff: false,
      canReadResidents: false,
      canWriteResidents: false,
      canDeleteResidents: false,
    };
  }

  const isBootstrapAdmin =
    (user.email || '').toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() &&
    user.emailVerified === true;
  const isAdmin = authStatus ? authStatus.isAdmin : isBootstrapAdmin;
  const isStaff = authStatus ? authStatus.isStaff : isBootstrapAdmin;
  const isExplicitlyUnauthorized = authStatus ? !authStatus.isAuthorized : false;

  if (isExplicitlyUnauthorized && !error) {
    return {
      status: 'autenticado_sem_autorizacao',
      title: 'Usuário Autenticado, mas Sem Autorização',
      description: `Você está autenticado com a conta Google "${user.email}", mas esta conta não possui autorização registrada nas regras de segurança do Firestore da Victoria Lar Residencial (coleções 'admins' ou 'funcionarios').`,
      recommendation: `Solicite ao administrador da instituição (${ADMIN_BOOTSTRAP_EMAIL}) a inclusão do seu usuário (UID: ${user.uid}) na lista de funcionários autorizados no Firestore.`,
      isAdmin: false,
      isStaff: false,
      canReadResidents: false,
      canWriteResidents: false,
      canDeleteResidents: false,
    };
  }

  if (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code || '';

    const isPermissionDenied =
      errorCode === 'permission-denied' ||
      rawMessage.includes('permission-denied') ||
      rawMessage.includes('Missing or insufficient permissions') ||
      rawMessage.includes('Permissão negada');

    const isNotFound =
      errorCode === 'not-found' ||
      rawMessage.includes('NOT_FOUND') ||
      rawMessage.includes('not found') ||
      rawMessage.includes('não encontrado');

    const isUnavailable =
      errorCode === 'unavailable' ||
      rawMessage.includes('unavailable') ||
      rawMessage.includes('offline') ||
      rawMessage.includes('indisponível');

    if (isPermissionDenied) {
      if (isAdmin) {
        return {
          status: 'regras_incompativeis_ou_nao_publicadas',
          title: 'Regras do Firestore Incompatíveis ou Não Publicadas',
          description: `O usuário autenticado (${user.email}) é o administrador oficial configurado, porém o Cloud Firestore rejeitou a consulta com "Permissão negada". Isso indica que as regras de segurança em "firestore.rules" ainda não foram publicadas no Firebase Console do projeto "${TARGET_FIREBASE_PROJECT_ID}" ou o banco está utilizando regras de negação padrão.`,
          recommendation:
            'Acesse o Firebase Console > Firestore Database > Rules e publique as regras de segurança do projeto.',
          isAdmin: true,
          isStaff: true,
          canReadResidents: false,
          canWriteResidents: false,
          canDeleteResidents: false,
        };
      }

      return {
        status: 'autenticado_sem_autorizacao',
        title: 'Usuário Autenticado, mas Sem Autorização',
        description: `Você está autenticado com a conta Google "${user.email}", mas esta conta não possui autorização registrada nas regras de segurança do Firestore da Victoria Lar Residencial (coleções 'admins' ou 'funcionarios').`,
        recommendation: `Solicite ao administrador da instituição a inclusão do seu usuário (UID: ${user.uid}) na lista de funcionários autorizados no Firestore, ou conecte-se com a conta institucional administrativa (${ADMIN_BOOTSTRAP_EMAIL}).`,
        isAdmin: false,
        isStaff: false,
        canReadResidents: false,
        canWriteResidents: false,
        canDeleteResidents: false,
      };
    }

    if (isNotFound) {
      return {
        status: 'projeto_ou_banco_incorreto',
        title: 'Projeto ou Banco de Dados Incorreto',
        description: `O banco de dados Firestore especificado não foi localizado no projeto "${TARGET_FIREBASE_PROJECT_ID}".`,
        recommendation:
          'Verifique no Console do Firebase se a instância do Cloud Firestore está ativada e se o ID da base coincide com o configurado.',
        isAdmin,
        isStaff,
        canReadResidents: false,
        canWriteResidents: false,
        canDeleteResidents: false,
      };
    }

    if (isUnavailable) {
      return {
        status: 'servico_indisponivel',
        title: 'Serviço Firestore Temporariamente Indisponível',
        description:
          'O cliente Firestore não conseguiu contatar os servidores do Google Cloud no momento (cliente offline ou conexão instável).',
        recommendation:
          'Verifique a conexão de rede da estação de trabalho e tente novamente.',
        isAdmin,
        isStaff,
        canReadResidents: false,
        canWriteResidents: false,
        canDeleteResidents: false,
      };
    }

    return {
      status: 'servico_indisponivel',
      title: 'Erro de Comunicação com Firestore',
      description: rawMessage,
      recommendation: 'Tente recarregar a página ou verifique a conexão com o Firebase.',
      isAdmin,
      isStaff,
      canReadResidents: false,
      canWriteResidents: false,
      canDeleteResidents: false,
    };
  }

  return {
    status: 'conectado_autorizado',
    title: 'Conectado e Autorizado',
    description: `Sessão ativa e sincronizada em tempo real com o Cloud Firestore do projeto "${TARGET_FIREBASE_PROJECT_ID}".`,
    recommendation: isAdmin
      ? 'Privilégios totais de Administrador ativos (leitura, cadastro, edição e exclusão).'
      : 'Privilégios de Funcionário Autorizado ativos (leitura, cadastro e edição).',
    isAdmin,
    isStaff: true,
    canReadResidents: true,
    canWriteResidents: true,
    canDeleteResidents: isAdmin,
  };
}

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
  const env: Record<string, string | undefined> = {
    ...((typeof process !== 'undefined' && (process.env as Record<string, string | undefined>)) || {}),
    ...((typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env) || {}),
  };

  const apiKey = (env.VITE_FIREBASE_API_KEY || '').trim();
  const rawProjectId = (env.VITE_FIREBASE_PROJECT_ID || TARGET_FIREBASE_PROJECT_ID).trim();
  const projectId = rawProjectId || TARGET_FIREBASE_PROJECT_ID;
  const authDomain = (env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`).trim();
  const storageBucket = (
    env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`
  ).trim();
  const appId = (env.VITE_FIREBASE_APP_ID || '').trim();
  const messagingSenderId = (env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();

  // Verificação estrita do projeto oficial: rejeitar qualquer outro projeto legado ou divergente
  if (projectId !== TARGET_FIREBASE_PROJECT_ID) {
    return {
      isValid: false,
      missingVars: [],
      config: null,
      errorMessage: `Projeto Firebase divergente detectado ("${projectId}"). O projeto obrigatório é "${TARGET_FIREBASE_PROJECT_ID}".`,
    };
  }

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

export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void,
  onInitialized?: () => void
): () => void {
  try {
    const { auth } = getFirebaseServices();
    let isInitial = true;
    return onAuthStateChanged(
      auth,
      (user) => {
        callback(user);
        if (isInitial) {
          isInitial = false;
          if (onInitialized) onInitialized();
        }
      },
      (error) => {
        if (isInitial) {
          isInitial = false;
          if (onInitialized) onInitialized();
        }
        callback(null);
      }
    );
  } catch {
    callback(null);
    if (onInitialized) onInitialized();
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
  const { db, auth } = getFirebaseServices();

  if (!auth.currentUser) {
    throw new Error(
      'Usuário não autenticado. Faça login com o Google para cadastrar novos residentes no Firestore.'
    );
  }

  const authStatus = await verificarAutorizacaoUsuario(auth.currentUser);
  if (!authStatus.isAuthorized) {
    throw new Error(
      `Acesso negado: a conta "${auth.currentUser.email}" não possui autorização para cadastrar residentes no Cloud Firestore.`
    );
  }

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

  const { db, auth } = getFirebaseServices();

  if (!auth.currentUser) {
    throw new Error(
      'Usuário não autenticado. Faça login com o Google para atualizar residentes no Firestore.'
    );
  }

  const authStatus = await verificarAutorizacaoUsuario(auth.currentUser);
  if (!authStatus.isAuthorized) {
    throw new Error(
      `Acesso negado: a conta "${auth.currentUser.email}" não possui autorização para atualizar residentes no Cloud Firestore.`
    );
  }

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
 * Apenas Administradores possuem autorização para excluir prontuários.
 */
export async function excluirPacienteNoFirebase(id: string): Promise<boolean> {
  if (!id || id.trim() === '') {
    throw new Error('ID do residente inválido para exclusão no Firestore.');
  }

  const { db, auth } = getFirebaseServices();

  if (!auth.currentUser) {
    throw new Error(
      'Usuário não autenticado. Faça login com o Google para excluir residentes no Firestore.'
    );
  }

  const authStatus = await verificarAutorizacaoUsuario(auth.currentUser);
  if (!authStatus.isAdmin) {
    throw new Error(
      'Acesso negado: a exclusão de prontuários de residentes é restrita exclusivamente a Administradores da Victoria Lar Residencial.'
    );
  }

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
 * NÃO inicia escuta se o usuário estiver desconectado.
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

  // Não iniciar a escuta da coleção pacientes antes de o usuário estar autenticado
  if (!services.auth.currentUser) {
    onError(
      new Error(
        'Usuário não autenticado. A escuta da coleção pacientes só é iniciada após o login com Google.'
      )
    );
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
  diagnostic: DiagnosticResult;
}> {
  const validation = validateFirebaseEnvironment();
  if (!validation.isValid || !validation.config) {
    const diag = diagnosticarAcessoFirestore(
      null,
      new Error(validation.errorMessage || 'Variáveis ausentes')
    );
    return {
      ok: false,
      message:
        validation.errorMessage ||
        'Variáveis de ambiente do Firebase ausentes no ambiente de execução.',
      projectId: TARGET_FIREBASE_PROJECT_ID,
      databaseId: '(default)',
      diagnostic: diag,
    };
  }

  try {
    const { db, auth, config } = getFirebaseServices();
    const currentDb = config.databaseId || '(default)';

    if (!auth.currentUser) {
      const diag = diagnosticarAcessoFirestore(null);
      return {
        ok: false,
        message:
          'Usuário não autenticado. O acesso à coleção pacientes no Firestore requer autenticação com uma conta autorizada da Victoria Lar Residencial.',
        projectId: config.projectId,
        databaseId: currentDb,
        diagnostic: diag,
      };
    }

    const colRef = collection(db, 'pacientes');
    const snap = await getDocs(query(colRef, limit(10)));
    const diag = diagnosticarAcessoFirestore(auth.currentUser, null);

    return {
      ok: true,
      message: `Conexão bem-sucedida com o Firestore do projeto "${config.projectId}" (Banco: ${currentDb}). Leitura operacional verificada diretamente no Firestore (${snap.size} registros lidos).`,
      count: snap.size,
      projectId: config.projectId,
      databaseId: currentDb,
      diagnostic: diag,
    };
  } catch (err: unknown) {
    let currentUser: FirebaseUser | null = null;
    try {
      const services = getFirebaseServices();
      currentUser = services.auth.currentUser;
    } catch {
      // ignore
    }
    const formatted = formatFirestoreError(err, 'testar conexão');
    const diag = diagnosticarAcessoFirestore(currentUser, err);

    return {
      ok: false,
      message: formatted.message,
      projectId: validation.config?.projectId || TARGET_FIREBASE_PROJECT_ID,
      databaseId: validation.config?.databaseId || '(default)',
      diagnostic: diag,
    };
  }
}
