import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  Users,
  Settings,
  Database,
  ExternalLink,
  Shield,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { Paciente } from './types/patient';
import {
  ouvirPacientes,
  validateFirebaseEnvironment,
  subscribeToAuthState,
  loginWithGoogle,
  logout,
  TARGET_FIREBASE_PROJECT_ID,
  ADMIN_BOOTSTRAP_EMAIL,
  diagnosticarAcessoFirestore,
  verificarAutorizacaoUsuario,
  DiagnosticResult,
  UserAuthorization,
} from './lib/firebase';
import { VictoriaLogo } from './components/VictoriaLogo';
import { PatientForm } from './components/PatientForm';
import { PatientList } from './components/PatientList';
import { PatientDetailsModal } from './components/PatientDetailsModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'cadastro' | 'lista'>('cadastro');
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [editingPaciente, setEditingPaciente] = useState<Paciente | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userAuth, setUserAuth] = useState<UserAuthorization | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const envValidation = validateFirebaseEnvironment();
  const config = envValidation.config;
  const activeProjectId = config?.projectId || TARGET_FIREBASE_PROJECT_ID;
  const activeDatabaseId = config?.databaseId || '(default)';

  // 1. Subscrição do estado de autenticação Firebase Auth
  useEffect(() => {
    const unsubAuth = subscribeToAuthState(
      (user) => {
        setCurrentUser(user);
        setAuthInitialized(true);
      },
      () => {
        setAuthInitialized(true);
      }
    );
    return () => unsubAuth();
  }, []);

  // 2. Gerenciamento do listener da coleção 'pacientes' com verificação de autorização obrigatória
  useEffect(() => {
    // 2.1. Aguardar resolução do Firebase Auth antes de qualquer ação
    if (!authInitialized) {
      return;
    }

    // 2.2. Se o ambiente estiver inválido (variáveis de ambiente pendentes ou projeto incorreto)
    if (!envValidation.isValid) {
      setPacientes([]);
      setIsFirestoreConnected(false);
      setUserAuth(null);
      setFirebaseError(envValidation.errorMessage || 'Configuração do Firebase incompleta.');
      setDiagnostic(diagnosticarAcessoFirestore(currentUser, new Error(envValidation.errorMessage)));
      setLoading(false);
      return;
    }

    // 2.3. Usuário desconectado:
    // Limpar residentes, NÃO iniciar listeners e NÃO executar consultas protegidas
    if (!currentUser) {
      setPacientes([]);
      setIsFirestoreConnected(false);
      setUserAuth(null);
      setFirebaseError(null);
      setDiagnostic(diagnosticarAcessoFirestore(null));
      setLoading(false);
      return;
    }

    // 2.4. Usuário autenticado: verificar autorização real antes de iniciar o listener
    let isCancelled = false;
    let unsubscribeListener: (() => void) | null = null;
    setLoading(true);

    const checkAuthorizationAndSubscribe = async () => {
      try {
        const authStatus = await verificarAutorizacaoUsuario(currentUser);
        if (isCancelled) return;

        setUserAuth(authStatus);

        // Se o usuário não estiver explicitamente autorizado, NÃO inicia o listener!
        if (!authStatus.isAuthorized) {
          setPacientes([]);
          setIsFirestoreConnected(false);
          setFirebaseError(null);
          setDiagnostic(diagnosticarAcessoFirestore(currentUser, null, authStatus));
          setLoading(false);
          return;
        }

        // 2.5. Iniciar o listener SOMENTE DEPOIS da autorização confirmada
        unsubscribeListener = ouvirPacientes(
          (updatedPacientes) => {
            if (isCancelled) return;
            setPacientes(updatedPacientes);
            setIsFirestoreConnected(true);
            setFirebaseError(null);
            setDiagnostic(diagnosticarAcessoFirestore(currentUser, null, authStatus));
            setLoading(false);
          },
          (error) => {
            if (isCancelled) return;
            // Bloqueio rigoroso: falha de permissão não exibe dados
            setPacientes([]);
            setIsFirestoreConnected(false);
            setFirebaseError(error.message);
            setDiagnostic(diagnosticarAcessoFirestore(currentUser, error, authStatus));
            setLoading(false);
          }
        );
      } catch (err: unknown) {
        if (isCancelled) return;
        setPacientes([]);
        setIsFirestoreConnected(false);
        const errMsg = err instanceof Error ? err.message : String(err);
        setFirebaseError(errMsg);
        setDiagnostic(diagnosticarAcessoFirestore(currentUser, err));
        setLoading(false);
      }
    };

    checkAuthorizationAndSubscribe();

    // 2.6 e 2.7. Cancelamento garantido do listener anterior ao mudar usuário ou desmontar
    return () => {
      isCancelled = true;
      if (typeof unsubscribeListener === 'function') {
        unsubscribeListener();
      }
    };
  }, [
    authInitialized,
    currentUser,
    envValidation.isValid,
    envValidation.errorMessage,
    refreshTrigger,
  ]);

  const handlePatientRegistered = (paciente: Paciente) => {
    setNotification({
      message: `${paciente.nomeCompleto} sincronizado com sucesso no Firestore!`,
      type: 'success',
    });
    setEditingPaciente(null);
    setActiveTab('lista');
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const handleLoginGoogle = async () => {
    setAuthBusy(true);
    try {
      await loginWithGoogle();
      // onAuthStateChanged irá atualizar currentUser e acionar o listener automaticamente
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha na autenticação com o Google');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setAuthBusy(true);
    try {
      await logout();
      setCurrentUser(null);
      setUserAuth(null);
      setPacientes([]);
      setIsFirestoreConnected(false);
      setDiagnostic(diagnosticarAcessoFirestore(null));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao desconectar');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleStartEdit = (paciente: Paciente) => {
    setEditingPaciente(paciente);
    setSelectedPaciente(null);
    setActiveTab('cadastro');
  };

  const handleCancelEdit = () => {
    setEditingPaciente(null);
    setActiveTab('lista');
  };

  const firestoreConsoleUrl =
    activeDatabaseId && activeDatabaseId !== '(default)'
      ? `https://console.firebase.google.com/project/${activeProjectId}/firestore/databases/${activeDatabaseId}/data`
      : `https://console.firebase.google.com/project/${activeProjectId}/firestore/databases/-default-/data`;

  const isBootstrapAdmin =
    (currentUser?.email || '').toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase();

  return (
    <div className="min-h-screen bg-[#f7f6f1] text-stone-800 flex flex-col">
      {/* Top Bar for Victoria Lar Residencial */}
      <header className="bg-[#133827] text-white border-b border-[#214f3b] sticky top-0 z-40 shadow-md no-print">
        {/* Upper Brand Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <VictoriaLogo size="md" />
          </div>

          {/* Right Status & Quick Actions */}
          <div className="flex items-center gap-2.5">
            {/* User session status badge */}
            {currentUser ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1a4d36] text-stone-200 border border-emerald-500/40">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="max-w-[170px] truncate">{currentUser.email}</span>
                {isBootstrapAdmin && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-400/20 text-[#dfb842] font-bold">
                    Admin
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={authBusy}
                  className="ml-1 text-stone-400 hover:text-white cursor-pointer"
                  title="Desconectar da conta Google"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLoginGoogle}
                disabled={authBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#dfb842] hover:bg-[#ebd06b] text-[#133827] shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar com Google</span>
              </button>
            )}

            {/* Firestore Status Badge */}
            <button
              onClick={() => setIsConfigOpen(true)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                isFirestoreConnected
                  ? 'bg-[#1b4834] text-emerald-300 border-emerald-500/50 hover:bg-[#20573e]'
                  : !currentUser
                  ? 'bg-[#183d2c] text-amber-300 border-amber-400/40 hover:bg-[#1d4734]'
                  : 'bg-red-950/70 text-red-300 border-red-500/50 hover:bg-red-900/80'
              }`}
              title="Clique para abrir o painel de diagnóstico do Firestore"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isFirestoreConnected
                    ? 'bg-emerald-400 animate-pulse'
                    : !currentUser
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isFirestoreConnected
                  ? `Firestore Conectado (${activeProjectId})`
                  : !currentUser
                  ? 'Login Necessário'
                  : 'Aviso Firestore'}
              </span>
              <span className="sm:hidden font-mono text-[11px]">
                {isFirestoreConnected ? 'Firestore OK' : !currentUser ? 'Login' : 'Aviso'}
              </span>
            </button>

            {/* Direct Link to Firebase Console */}
            <a
              href={firestoreConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Abrir Firestore no console do Firebase"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Diagnostics button */}
            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Diagnóstico detalhado da conexão Firebase"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#1c4734]">
          <div className="flex space-x-1 sm:space-x-4">
            <button
              onClick={() => setActiveTab('cadastro')}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'cadastro'
                  ? 'border-[#dfb842] text-[#dfb842]'
                  : 'border-transparent text-stone-300 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-[#dfb842]" />
              {editingPaciente ? 'Editar Residente' : 'Novo Cadastro de Paciente'}
            </button>

            <button
              onClick={() => setActiveTab('lista')}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'lista'
                  ? 'border-[#dfb842] text-[#dfb842]'
                  : 'border-transparent text-stone-300 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 text-[#dfb842]" />
              Residentes Cadastrados
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#dfb842]/20 text-[#dfb842]">
                {pacientes.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-4">
        {/* Environment configuration error banner */}
        {!envValidation.isValid && (
          <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 text-xs text-red-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-sm font-bold text-red-900">
                  Configuração Obrigatória do Firebase Ausente nos Secrets
                </strong>
                <p className="mt-0.5 text-red-800">
                  As seguintes variáveis devem ser configuradas nos Secrets do AI Studio para o projeto{' '}
                  <code className="font-mono font-bold">{TARGET_FIREBASE_PROJECT_ID}</code>:{' '}
                  <span className="font-mono font-semibold">{envValidation.missingVars.join(', ')}</span>.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="px-3.5 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
            >
              Ver Detalhes
            </button>
          </div>
        )}

        {/* Clear Orientation Callout when User is Disconnected (NOT a configuration error!) */}
        {authInitialized && !currentUser && envValidation.isValid && (
          <div className="bg-emerald-50/90 border border-emerald-300/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#133827] text-[#dfb842] flex items-center justify-center shrink-0 shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <strong className="block text-sm font-bold text-[#133827]">
                  Acesso Restrito — Victoria Lar Residencial
                </strong>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Para carregar a lista de residentes em tempo real ou registrar novos cadastros clínicos no Cloud Firestore, entre com a sua conta Google institucional autorizada.
                </p>
              </div>
            </div>
            <button
              onClick={handleLoginGoogle}
              disabled={authBusy}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#dfb842] hover:bg-[#ebd06b] text-[#133827] font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Entrar com Google</span>
            </button>
          </div>
        )}

        {/* Diagnosed Firestore Warning Banner (When Authenticated but Perm Error or Mismatch) */}
        {currentUser && diagnostic && diagnostic.status !== 'conectado_autorizado' && (
          <div
            className={`border rounded-xl p-4 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
              diagnostic.status === 'autenticado_sem_autorizacao'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            <div className="flex items-start gap-3">
              {diagnostic.status === 'autenticado_sem_autorizacao' ? (
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <strong className="block text-sm font-bold">{diagnostic.title}</strong>
                <p>{diagnostic.description}</p>
                <p className="font-semibold text-[11px] opacity-90">
                  Ação recomendada: {diagnostic.recommendation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleLoginGoogle}
                disabled={authBusy}
                className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Trocar de Conta
              </button>
              <button
                onClick={handleRefresh}
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
                title="Tentar reconectar ao Firestore"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Floating toast notification */}
        {notification && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#143d30] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-[#dfb842]/40 text-xs sm:text-sm animate-bounce">
            <CheckCircle2 className="w-5 h-5 text-[#dfb842]" />
            <span>{notification.message}</span>
            <button
              onClick={() => {
                setActiveTab('lista');
                setNotification(null);
              }}
              className="ml-2 underline text-[#dfb842] font-semibold text-xs cursor-pointer"
            >
              Ver na lista
            </button>
          </div>
        )}

        {/* Content based on active tab */}
        {activeTab === 'cadastro' ? (
          <div className="space-y-6">
            <PatientForm
              onSuccess={handlePatientRegistered}
              onOpenConfig={() => setIsConfigOpen(true)}
              isFirebaseConnected={isFirestoreConnected}
              currentUser={currentUser}
              editingPaciente={editingPaciente}
              onCancelEdit={handleCancelEdit}
              onLoginGoogle={handleLoginGoogle}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <PatientList
              pacientes={pacientes}
              isLoading={loading}
              onSelectPaciente={(p) => setSelectedPaciente(p)}
              onNewPatientClick={() => {
                setEditingPaciente(null);
                setActiveTab('cadastro');
              }}
              onRefresh={handleRefresh}
              currentUser={currentUser}
              onLoginGoogle={handleLoginGoogle}
              onEditPaciente={handleStartEdit}
              diagnostic={diagnostic}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-auto py-6 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-serif-brand font-bold text-[#143d30]">Victoria Lar Residencial</span>
            <span>&bull;</span>
            <span>Módulo de Admissão & Cadastro Clínico de Residentes</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>
              Projeto Firestore:{' '}
              <code className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">
                {activeProjectId}
              </code>{' '}
              ({activeDatabaseId})
            </span>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="text-[#143d30] hover:underline font-semibold cursor-pointer"
            >
              Status de Conexão
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PatientDetailsModal
        paciente={selectedPaciente}
        onClose={() => setSelectedPaciente(null)}
        onEdit={handleStartEdit}
      />

      <FirebaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        currentUser={currentUser}
        onRefreshData={handleRefresh}
        diagnostic={diagnostic}
      />
    </div>
  );
}
