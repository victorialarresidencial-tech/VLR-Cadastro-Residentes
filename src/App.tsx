import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  Users,
  Settings,
  Database,
  ExternalLink,
  Shield,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { Paciente } from './types/patient';
import {
  ouvirPacientes,
  getActiveFirebaseConfig,
  DEFAULT_PROJECT_ID,
  DEFAULT_DATABASE_ID
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
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const activeConfig = getActiveFirebaseConfig();

  // Initialize direct Firestore real-time listener with resilient offline/fallback support
  useEffect(() => {
    const config = getActiveFirebaseConfig();
    const hasKey = Boolean(config.apiKey && config.apiKey.trim().length > 0);
    setIsFirebaseConnected(hasKey);

    setLoading(true);
    const unsubscribe = ouvirPacientes(
      (updatedPacientes, isOnline, errorDetail) => {
        setPacientes(updatedPacientes);
        setIsFirebaseConnected(isOnline);
        setFirebaseError(errorDetail || null);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handlePatientRegistered = (novo: Paciente) => {
    // Immediately ensure the patient is present in state
    setPacientes((prev) => {
      const exists = prev.some((p) => p.id === novo.id);
      return exists ? prev : [novo, ...prev];
    });

    setNotification({
      message: `${novo.nomeCompleto} adicionado com sucesso aos Residentes!`,
      type: 'success',
    });

    // Automatically switch to the "Residentes Cadastrados" list tab so the user sees the new record
    setActiveTab('lista');
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRefresh = () => {
    setLoading(true);
    ouvirPacientes(
      (updatedPacientes, isOnline, errorDetail) => {
        setPacientes(updatedPacientes);
        setIsFirebaseConnected(isOnline);
        setFirebaseError(errorDetail || null);
        setLoading(false);
      }
    );
  };

  const firestoreConsoleUrl =
    activeConfig.databaseId && activeConfig.databaseId !== '(default)'
      ? `https://console.firebase.google.com/project/${activeConfig.projectId}/firestore/databases/${activeConfig.databaseId}/data`
      : `https://console.firebase.google.com/project/${activeConfig.projectId}/firestore/databases/-default-/data`;

  return (
    <div className="min-h-screen bg-[#f7f6f1] text-stone-800 flex flex-col">
      {/* Top Bar for Victoria Lar Residencial */}
      <header className="bg-[#133827] text-white border-b border-[#214f3b] sticky top-0 z-40 shadow-md no-print">
        {/* Upper Brand Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Logo with exact landing page image */}
          <div className="flex items-center gap-3">
            <VictoriaLogo size="md" />
          </div>

          {/* Right Status & Quick Actions */}
          <div className="flex items-center gap-2.5">
            {/* Firebase Status Badge */}
            <button
              onClick={() => setIsConfigOpen(true)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                isFirebaseConnected
                  ? 'bg-[#1b4834] text-emerald-300 border-emerald-500/50 hover:bg-[#20573e]'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/50 hover:bg-amber-900/70'
              }`}
              title="Clique para ver ou configurar a conexão com o Firebase Firestore"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isFirebaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isFirebaseConnected
                  ? `Firestore Conectado (${activeConfig.projectId} • ${activeConfig.databaseId || DEFAULT_DATABASE_ID})`
                  : 'Modo Local / Configurar Firebase'}
              </span>
              <span className="sm:hidden font-mono text-[11px]">
                {isFirebaseConnected ? 'Firestore OK' : 'Configurar'}
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

            {/* Settings button */}
            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Configurações do Firebase"
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
              Novo Cadastro de Paciente
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
        {/* Informative status notice if in local mode or if there's a Firebase notice */}
        {!isFirebaseConnected && (
          <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Modo de Teste Local Ativo:</span> Cadastros serão exibidos imediatamente nesta sessão. Para sincronizar em tempo real com o Firestore oficial, configure os <strong>Secrets</strong> (<code>VITE_FIREBASE_API_KEY</code> e <code>VITE_FIREBASE_DATABASE_ID</code>).
              </div>
            </div>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="px-3 py-1.5 bg-[#143d30] text-amber-300 hover:text-white rounded-lg font-semibold shrink-0 text-xs transition-colors"
            >
              Conectar Firebase
            </button>
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
              className="ml-2 underline text-[#dfb842] font-semibold text-xs"
            >
              Ver na lista
            </button>
          </div>
        )}

        {/* Content based on tab */}
        {activeTab === 'cadastro' ? (
          <div className="space-y-6">
            <PatientForm
              onSuccess={handlePatientRegistered}
              onOpenConfig={() => setIsConfigOpen(true)}
              isFirebaseConnected={isFirebaseConnected}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <PatientList
              pacientes={pacientes}
              isLoading={loading}
              onSelectPaciente={(p) => setSelectedPaciente(p)}
              onNewPatientClick={() => setActiveTab('cadastro')}
              onRefresh={handleRefresh}
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
            <span>Módulo de Admissão & Cadastro Clínico de Pacientes</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>
              Projeto Firestore: <code className="font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded">{activeConfig.projectId}</code> ({activeConfig.databaseId || DEFAULT_DATABASE_ID})
            </span>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="text-[#143d30] hover:underline font-semibold cursor-pointer"
            >
              Configuração Firebase
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <PatientDetailsModal
        paciente={selectedPaciente}
        onClose={() => setSelectedPaciente(null)}
      />

      <FirebaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigSaved={() => {
          setIsConfigOpen(false);
          const config = getActiveFirebaseConfig();
          setIsFirebaseConnected(Boolean(config.apiKey && config.apiKey.trim().length > 0));
          handleRefresh();
        }}
      />
    </div>
  );
}
