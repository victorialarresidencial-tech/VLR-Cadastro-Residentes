import React, { useState } from 'react';
import {
  X,
  Database,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Lock,
  UserCheck,
  LogIn,
  LogOut,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  validateFirebaseEnvironment,
  testarConexaoFirestore,
  loginWithGoogle,
  logout,
  TARGET_FIREBASE_PROJECT_ID,
  ADMIN_BOOTSTRAP_EMAIL,
  DiagnosticResult,
} from '../lib/firebase';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: FirebaseUser | null;
  onRefreshData?: () => void;
  diagnostic?: DiagnosticResult | null;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onRefreshData,
  diagnostic,
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    count?: number;
    projectId: string;
    databaseId: string;
    diagnostic?: DiagnosticResult;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const envValidation = validateFirebaseEnvironment();
  const config = envValidation.config;
  const activeProjectId = config?.projectId || TARGET_FIREBASE_PROJECT_ID;
  const activeDatabaseId = config?.databaseId || '(default)';

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testarConexaoFirestore();
      setTestResult(res);
      if (res.ok && onRefreshData) {
        onRefreshData();
      }
    } finally {
      setTesting(false);
    }
  };

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
      if (onRefreshData) onRefreshData();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Falha na autenticação Google');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setAuthLoading(true);
    try {
      await logout();
      if (onRefreshData) onRefreshData();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Falha ao desconectar');
    } finally {
      setAuthLoading(false);
    }
  };

  const firestoreConsoleUrl =
    activeDatabaseId && activeDatabaseId !== '(default)'
      ? `https://console.firebase.google.com/project/${activeProjectId}/firestore/databases/${activeDatabaseId}/data`
      : `https://console.firebase.google.com/project/${activeProjectId}/firestore/databases/-default-/data`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#143d30] via-[#1a4d3d] to-[#143d30] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#cda45e]/20 border border-[#cda45e]/40 flex items-center justify-center text-[#dfb842]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-brand text-lg font-bold">
                Conexão Firestore Victoria Lar
              </h3>
              <p className="text-xs text-stone-200">
                Projeto:{' '}
                <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                  {activeProjectId}
                </code>{' '}
                &bull; Banco:{' '}
                <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                  {activeDatabaseId}
                </code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-stone-700 text-sm">
          {/* Architecture notice: Zero local persistence policy */}
          <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <h4 className="font-bold text-emerald-950 text-sm">
                Política de Persistência Centralizada e Segura
              </h4>
              <p className="text-emerald-900/90 mt-1 leading-relaxed">
                As credenciais e configurações são carregadas <strong>exclusivamente por variáveis de ambiente (Secrets)</strong> do ambiente de execução.
                Não há qualquer retenção de credenciais ou de dados sensíveis de prontuários em armazenamento persistente no navegador do usuário.
              </p>
            </div>
          </div>

          {/* User Authentication Status */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  currentUser
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {currentUser ? <UserCheck className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
                  Usuário Autenticado no Firebase
                </div>
                <div className="text-sm font-bold text-stone-800">
                  {currentUser ? currentUser.email : 'Nenhum usuário conectado'}
                </div>
                {currentUser && (
                  <div className="text-[11px] text-stone-500 mt-0.5">
                    Perfil:{' '}
                    {currentUser.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() ? (
                      <span className="font-semibold text-emerald-800">
                        Administrador Oficial ({ADMIN_BOOTSTRAP_EMAIL})
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-800">
                        Funcionário (Verificação via regras do Firestore em /funcionarios)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {currentUser ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={authLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 hover:text-red-900 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={authLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#143d30] bg-[#dfb842] hover:bg-[#ebd06b] rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {authLoading ? 'Conectando...' : 'Entrar com Google'}
                </button>
              )}
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
              {authError}
            </div>
          )}

          {/* Active Diagnostic Status */}
          {diagnostic && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                diagnostic.status === 'conectado_autorizado'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : diagnostic.status === 'usuario_nao_autenticado'
                  ? 'bg-stone-50 border-stone-300 text-stone-800'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              {diagnostic.status === 'conectado_autorizado' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : diagnostic.status === 'usuario_nao_autenticado' ? (
                <Lock className="w-5 h-5 text-stone-500 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-bold block text-sm">{diagnostic.title}</span>
                <p>{diagnostic.description}</p>
                <p className="font-semibold text-[11px] opacity-90">
                  Ação recomendada: {diagnostic.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* Target Database Details */}
          <div className="bg-[#f7f5ed] border border-[#e1d9c2] rounded-xl p-4 flex items-start gap-3">
            <Server className="w-5 h-5 text-[#143d30] shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-[#143d30] text-sm">
                Banco de Dados Firestore Oficial
              </h4>
              <p className="text-xs text-stone-600 mt-1">
                Coleção de dados clínicos:{' '}
                <strong className="font-mono text-[#143d30]">/pacientes</strong> no projeto{' '}
                <strong className="font-mono text-[#143d30]">{activeProjectId}</strong>.
              </p>
              <a
                href={firestoreConsoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#143d30] hover:text-[#cda45e] transition-colors underline"
              >
                Abrir Firestore no Firebase Console
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Environment Variables Audit Table (Read-Only, Secrets Masked) */}
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <div className="bg-stone-100 px-4 py-2.5 border-b border-stone-200 text-xs font-bold text-stone-700 uppercase tracking-wider">
              Auditoria de Variáveis de Ambiente (Secrets)
            </div>
            <div className="divide-y divide-stone-100 text-xs">
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-stone-800">
                    VITE_FIREBASE_PROJECT_ID
                  </span>
                  <span className="text-[11px] text-stone-500 block">Identificador do projeto</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {activeProjectId}
                </div>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-stone-800">
                    VITE_FIREBASE_API_KEY
                  </span>
                  <span className="text-[11px] text-stone-500 block">Web API Key do Firebase</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {config?.apiKey ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ativa nos Secrets (Protegida)
                    </span>
                  ) : (
                    <span className="text-red-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-red-600" /> Ausente
                    </span>
                  )}
                </div>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-stone-800">
                    VITE_FIREBASE_APP_ID
                  </span>
                  <span className="text-[11px] text-stone-500 block">Identificador da Aplicação Web</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {config?.appId ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Ativo nos Secrets
                    </span>
                  ) : (
                    <span className="text-red-700 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-red-600" /> Ausente
                    </span>
                  )}
                </div>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-stone-800">
                    VITE_FIREBASE_DATABASE_ID
                  </span>
                  <span className="text-[11px] text-stone-500 block">Instância do Cloud Firestore</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-stone-700">
                  {activeDatabaseId}
                </div>
              </div>

              <div className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-stone-800">
                    VITE_FIREBASE_AUTH_DOMAIN
                  </span>
                  <span className="text-[11px] text-stone-500 block">Domínio de autenticação OAuth</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-stone-700">
                  {config?.authDomain || `${activeProjectId}.firebaseapp.com`}
                </div>
              </div>
            </div>
          </div>

          {/* Test Status feedback */}
          {testResult && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                testResult.ok
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed">
                <span className="font-bold block mb-0.5">
                  {testResult.ok ? 'Conexão Verificada com Sucesso!' : 'Falha na Conexão ao Firestore:'}
                </span>
                {testResult.message}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-stone-500">
            Origem: <strong className="font-mono">process.env</strong> exclusivamente
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing || !envValidation.isValid}
              onClick={handleTest}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#143d30] bg-[#143d30]/10 hover:bg-[#143d30]/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testando...' : 'Testar Conexão'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-200 hover:bg-stone-300 rounded-lg transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
