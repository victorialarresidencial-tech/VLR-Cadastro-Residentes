import React, { useState } from 'react';
import {
  X,
  Database,
  ExternalLink,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  UploadCloud
} from 'lucide-react';
import {
  getActiveFirebaseConfig,
  saveUserCredentials,
  clearUserCredentials,
  testarConexaoFirestore,
  sincronizarPacientesLocais,
  getLocalPatients,
  DEFAULT_PROJECT_ID,
  DEFAULT_DATABASE_ID
} from '../lib/firebase';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const currentConfig = getActiveFirebaseConfig();
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [appId, setAppId] = useState(currentConfig.appId || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || DEFAULT_PROJECT_ID);
  const [databaseId, setDatabaseId] = useState(currentConfig.databaseId || DEFAULT_DATABASE_ID);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; count?: number; databaseId?: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const localPatients = getLocalPatients();
  const pendingLocalCount = localPatients.filter((p) => p.id && p.id.startsWith('local-')).length;

  const handleSave = () => {
    saveUserCredentials(apiKey, appId, projectId, databaseId);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onConfigSaved();
    }, 1000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    saveUserCredentials(apiKey, appId, projectId, databaseId);
    const res = await testarConexaoFirestore();
    setTestResult(res);
    setTesting(false);
  };

  const handleClear = () => {
    if (confirm('Deseja limpar as chaves salvas localmente?')) {
      clearUserCredentials();
      setApiKey('');
      setAppId('');
      setProjectId(DEFAULT_PROJECT_ID);
      setDatabaseId(DEFAULT_DATABASE_ID);
      setTestResult(null);
      onConfigSaved();
    }
  };

  const handleSyncToFirestore = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await sincronizarPacientesLocais();
      setSyncResult(`Sincronização concluída: ${res.synced} cadastros enviados para o Firestore.${res.failed > 0 ? ` (${res.failed} falhas)` : ''}`);
      onConfigSaved();
    } catch (err: any) {
      setSyncResult(`Erro ao sincronizar: ${err?.message || 'Falha de conexão'}`);
    } finally {
      setSyncing(false);
    }
  };

  const firestoreConsoleUrl = databaseId && databaseId !== '(default)'
    ? `https://console.firebase.google.com/project/${projectId}/firestore/databases/${databaseId}/data`
    : `https://console.firebase.google.com/project/${projectId}/firestore/databases/-default-/data`;

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
                Projeto: <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono">{projectId}</code> &bull; Banco: <code className="bg-black/30 px-1.5 py-0.5 rounded text-amber-300 font-mono">{databaseId}</code>
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
        <div className="p-6 overflow-y-auto space-y-6 text-stone-700 text-sm">
          {/* Target Database Link */}
          <div className="bg-[#f7f5ed] border border-[#e1d9c2] rounded-xl p-4 flex items-start gap-3">
            <Server className="w-5 h-5 text-[#143d30] shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-[#143d30] text-sm flex items-center gap-2">
                Banco de Dados Firestore Oficial
              </h4>
              <p className="text-xs text-stone-600 mt-1">
                Os dados de cadastro alimentam diretamente a coleção <strong className="font-mono text-[#143d30]">/pacientes</strong> no banco de dados Firestore da Victoria Lar Residencial.
              </p>
              <a
                href={firestoreConsoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#143d30] hover:text-[#cda45e] transition-colors underline"
              >
                Abrir Banco &quot;{databaseId}&quot; no Firebase Console
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Pending local test data banner */}
          {pendingLocalCount > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-xs text-amber-900">
                    {pendingLocalCount} paciente(s) salvo(s) localmente em modo de teste
                  </div>
                  <div className="text-[11px] text-amber-800">
                    Após conectar seu Firestore, você pode enviá-los diretamente para o banco de dados.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncToFirestore}
                disabled={syncing || !apiKey}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#143d30] bg-[#dfb842] hover:bg-[#c9a335] rounded-lg shadow-xs transition-colors shrink-0 disabled:opacity-50"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${syncing ? 'animate-bounce' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar no Firestore'}
              </button>
            </div>
          )}

          {syncResult && (
            <div className="p-3 bg-stone-100 border border-stone-300 rounded-lg text-xs text-stone-800">
              {syncResult}
            </div>
          )}

          {/* Instructions Box */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 text-amber-700" />
              Como configurar nos Secrets ou nos Campos abaixo
            </div>
            <p className="text-xs text-amber-950/80 leading-relaxed">
              Você pode cadastrar as chaves no painel <strong>Secrets</strong> do AI Studio ou preenchê-las diretamente aqui:
            </p>
            <ul className="text-xs text-amber-950/80 space-y-1 list-disc list-inside leading-relaxed font-mono">
              <li><strong>VITE_FIREBASE_API_KEY</strong>: Web API Key do Firebase</li>
              <li><strong>VITE_FIREBASE_PROJECT_ID</strong>: ID do projeto (ex.: {DEFAULT_PROJECT_ID})</li>
              <li><strong>VITE_FIREBASE_DATABASE_ID</strong>: Database ID do Firestore (padrão: <code>(default)</code>)</li>
            </ul>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Chave de API do Firebase (Web API Key) *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30] focus:border-transparent font-mono"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Lida da secret <code>VITE_FIREBASE_API_KEY</code> ou salva no navegador.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  ID do Projeto Firebase (Project ID)
                </label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30] font-mono text-stone-700"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Secret: <code>VITE_FIREBASE_PROJECT_ID</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                  Database ID do Firestore
                </label>
                <input
                  type="text"
                  placeholder="(default)"
                  value={databaseId}
                  onChange={(e) => setDatabaseId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30] font-mono text-stone-700"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Secret: <code>VITE_FIREBASE_DATABASE_ID</code> (Padrão: <code>(default)</code>)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                App ID (Opcional)
              </label>
              <input
                type="text"
                placeholder="1:456322168913:web:..."
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30] font-mono text-stone-700"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Secret: <code>VITE_FIREBASE_APP_ID</code>
              </p>
            </div>
          </div>

          {/* Test Status feedback */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 ${
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
                  {testResult.ok ? 'Conexão Estabelecida com Sucesso!' : 'Não foi possível conectar:'}
                </span>
                {testResult.message}
              </div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Configurações salvas! Atualizando conexão com Firestore...
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-700 font-medium px-2 py-1.5 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar credenciais locais
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={testing || !apiKey}
              onClick={handleTest}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#143d30] bg-[#143d30]/10 hover:bg-[#143d30]/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              Testar Conexão
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#143d30] hover:bg-[#1a4d3d] rounded-lg shadow-sm transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-[#dfb842]" />
              Salvar Credenciais
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
