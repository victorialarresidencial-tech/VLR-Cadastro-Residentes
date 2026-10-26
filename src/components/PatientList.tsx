import React, { useState, useMemo } from 'react';
import {
  Search,
  Eye,
  Trash2,
  AlertTriangle,
  Heart,
  Phone,
  Home,
  User,
  Plus,
  RefreshCw,
  ArrowDownAZ,
  ArrowUpAZ,
  LayoutList,
  LayoutGrid,
  FileText,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import { Paciente, GrauDependencia, StatusPaciente } from '../types/patient';
import { excluirPacienteNoFirebase } from '../lib/firebase';

interface PatientListProps {
  pacientes: Paciente[];
  isLoading: boolean;
  onSelectPaciente: (paciente: Paciente) => void;
  onNewPatientClick: () => void;
  onRefresh: () => void;
}

export const PatientList: React.FC<PatientListProps> = ({
  pacientes,
  isLoading,
  onSelectPaciente,
  onNewPatientClick,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrau, setSelectedGrau] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'lista' | 'grid'>('lista');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age > 0 ? age : null;
  };

  // Filter and sort alphabetically by name
  const sortedAndFilteredPacientes = useMemo(() => {
    return pacientes
      .filter((p) => {
        const matchesSearch =
          p.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.nomeSocial && p.nomeSocial.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (p.quarto && p.quarto.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (p.cpf && p.cpf.includes(searchTerm));

        const matchesGrau = selectedGrau === 'todos' || p.grauDependencia === selectedGrau;
        const matchesStatus = selectedStatus === 'todos' || p.status === selectedStatus;

        return matchesSearch && matchesGrau && matchesStatus;
      })
      .sort((a, b) => {
        const comp = a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR', { sensitivity: 'base' });
        return sortDirection === 'asc' ? comp : -comp;
      });
  }, [pacientes, searchTerm, selectedGrau, selectedStatus, sortDirection]);

  const handleDelete = async (id: string, nome: string) => {
    if (confirm(`Tem certeza que deseja remover o cadastro de ${nome}?`)) {
      setDeletingId(id);
      await excluirPacienteNoFirebase(id);
      setDeletingId(null);
      onRefresh();
    }
  };

  const getGrauBadge = (grau: GrauDependencia) => {
    switch (grau) {
      case 'grau1':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Grau I &bull; Independente
          </span>
        );
      case 'grau2':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
            Grau II &bull; Semidependente
          </span>
        );
      case 'grau3':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-900 border border-red-300">
            Grau III &bull; Cuidados 24h
          </span>
        );
      default:
        return null;
    }
  };

  // Quick metrics
  const totalPacientes = pacientes.length;
  const totalGrau3 = pacientes.filter((p) => p.grauDependencia === 'grau3').length;
  const totalComAlergias = pacientes.filter((p) => p.alergias && p.alergias.length > 0).length;

  return (
    <div className="space-y-6">
      {/* Quick Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-stone-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#133827]/10 text-[#133827] flex items-center justify-center font-bold">
            <User className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
              Total de Residentes
            </span>
            <div className="font-serif-brand text-2xl md:text-3xl font-bold text-[#133827]">
              {totalPacientes}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-stone-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center font-bold">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
              Grau III (Cuidados 24h)
            </span>
            <div className="font-serif-brand text-2xl md:text-3xl font-bold text-red-700">
              {totalGrau3}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-2xl border border-stone-200/90 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
              Alergias Cadastradas
            </span>
            <div className="font-serif-brand text-2xl md:text-3xl font-bold text-amber-700">
              {totalComAlergias}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-stone-200/90 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome (ordem alfabética), quarto ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#133827]"
            />
          </div>

          {/* Filters & Order */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Alphabetical sort button */}
            <button
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl border border-stone-300 transition-colors"
              title={sortDirection === 'asc' ? 'Ordem Alfabética: A até Z (Clique para inverter)' : 'Ordem Alfabética: Z até A (Clique para inverter)'}
            >
              {sortDirection === 'asc' ? (
                <>
                  <ArrowDownAZ className="w-4 h-4 text-[#133827]" />
                  <span>A &rarr; Z</span>
                </>
              ) : (
                <>
                  <ArrowUpAZ className="w-4 h-4 text-[#133827]" />
                  <span>Z &rarr; A</span>
                </>
              )}
            </button>

            {/* View Mode Toggle: Lista vs Grid */}
            <div className="inline-flex p-1 bg-stone-100 rounded-xl border border-stone-300">
              <button
                onClick={() => setViewMode('lista')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'lista'
                    ? 'bg-white shadow-xs text-[#133827] font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Visualização em Lista"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-xs text-[#133827] font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Visualização em Cards"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <select
              value={selectedGrau}
              onChange={(e) => setSelectedGrau(e.target.value)}
              className="px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#133827]"
            >
              <option value="todos">Todos os Graus</option>
              <option value="grau1">Grau I (Independente)</option>
              <option value="grau2">Grau II (Semidependente)</option>
              <option value="grau3">Grau III (Dependente)</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#133827]"
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativo (Morador)</option>
              <option value="avaliacao">Em Avaliação</option>
              <option value="temporario">Temporário</option>
              <option value="alta">Alta / Histórico</option>
            </select>

            <button
              onClick={onRefresh}
              className="p-2 text-stone-600 hover:text-[#133827] hover:bg-stone-100 rounded-xl transition-colors"
              title="Atualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onNewPatientClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#133827] hover:bg-[#1a4d36] rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#dfb842]" />
              Novo Cadastro
            </button>
          </div>
        </div>
      </div>

      {/* Patient List or Grid Container */}
      {sortedAndFilteredPacientes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200/90 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-serif-brand text-lg font-bold text-stone-800">
              Nenhum paciente encontrado
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
              {searchTerm || selectedGrau !== 'todos'
                ? 'Nenhum paciente corresponde aos filtros informados. Tente limpar os filtros de busca.'
                : 'Cadastre o primeiro paciente da Victoria Lar Residencial utilizando o formulário de admissão.'}
            </p>
          </div>
          <button
            onClick={onNewPatientClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#133827] hover:bg-[#1a4d36] rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#dfb842]" />
            Cadastrar Novo Residente
          </button>
        </div>
      ) : viewMode === 'lista' ? (
        /* FORMATO LISTA (ORDEM ALFABÉTICA) */
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-xs overflow-hidden">
          {/* Table Header Info Bar */}
          <div className="bg-[#f7f5ed] border-b border-stone-200/80 px-6 py-3 flex items-center justify-between text-xs text-stone-600">
            <div className="flex items-center gap-2 font-medium">
              <span className="font-bold text-[#133827]">Lista de Residentes</span>
              <span>&bull;</span>
              <span className="text-stone-500">Ordenados de A a Z ({sortedAndFilteredPacientes.length} residentes)</span>
            </div>
            <span className="text-[11px] text-stone-500 hidden sm:inline">
              Clique em &quot;Ver Ficha&quot; para abrir prontuário e imprimir
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {sortedAndFilteredPacientes.map((paciente, index) => {
              const age = calculateAge(paciente.dataNascimento);
              const initialLetter = paciente.nomeCompleto.charAt(0).toUpperCase();

              return (
                <div
                  key={paciente.id || paciente.nomeCompleto}
                  className="p-4 sm:p-5 hover:bg-[#faf9f5] transition-colors flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  {/* Left: Avatar + Resident Details */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Monogram Avatar */}
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#133827] to-[#1c523a] text-[#dfb842] flex items-center justify-center font-serif-brand font-bold text-lg shadow-xs shrink-0 border border-[#dfb842]/30">
                      {initialLetter}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-serif-brand text-base sm:text-lg font-bold text-stone-900 leading-snug">
                          {paciente.nomeCompleto}
                        </h4>
                        {paciente.nomeSocial && (
                          <span className="text-xs text-stone-500 italic">
                            ({paciente.nomeSocial})
                          </span>
                        )}
                        {paciente.id?.startsWith('local-') ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title="Salvo localmente em modo de teste">
                            Teste Local
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300" title="Sincronizado diretamente no Firestore">
                            Firestore
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-stone-600">
                        {/* Room */}
                        <span className="inline-flex items-center gap-1 font-semibold text-[#133827]">
                          <Home className="w-3.5 h-3.5 text-[#8c6b2d]" />
                          {paciente.quarto || 'Sem quarto definido'}
                        </span>

                        <span className="text-stone-300">&bull;</span>

                        {/* Age */}
                        {age !== null && (
                          <span>
                            <strong>{age}</strong> anos{' '}
                            <span className="text-stone-400 text-[11px]">({paciente.dataNascimento})</span>
                          </span>
                        )}

                        {/* Blood Type */}
                        {paciente.tipoSanguineo && (
                          <>
                            <span className="text-stone-300">&bull;</span>
                            <span className="text-red-700 font-bold">
                              Tipo: {paciente.tipoSanguineo}
                            </span>
                          </>
                        )}

                        {/* Status */}
                        <span className="text-stone-300">&bull;</span>
                        <span className="text-[11px] uppercase font-bold text-emerald-800">
                          {paciente.status === 'ativo' ? 'Morador Ativo' : paciente.status}
                        </span>
                      </div>

                      {/* Allergies and Health notes */}
                      {paciente.alergias && paciente.alergias.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-800 bg-red-50/80 px-2.5 py-1 rounded-lg border border-red-200 w-fit max-w-full">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span className="truncate">
                            <strong className="font-semibold">Alergias:</strong> {paciente.alergias.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle / Right: Dependency Badge & Family Contact */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 lg:gap-6 self-stretch lg:self-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-stone-100">
                    {/* Dependency badge */}
                    <div className="shrink-0">
                      {getGrauBadge(paciente.grauDependencia)}
                    </div>

                    {/* Family contact */}
                    <div className="text-xs text-stone-700 text-left lg:text-right shrink-0">
                      <div className="font-semibold text-stone-800 flex items-center lg:justify-end gap-1">
                        <span>{paciente.responsavel.nome}</span>
                        <span className="text-stone-400 font-normal text-[11px]">
                          ({paciente.responsavel.parentesco})
                        </span>
                      </div>
                      <div className="flex items-center lg:justify-end gap-1.5 text-stone-600 font-mono text-[11px] mt-0.5">
                        <Phone className="w-3 h-3 text-[#133827]" />
                        <a
                          href={`tel:${paciente.responsavel.telefonePrincipal}`}
                          className="hover:underline hover:text-[#133827]"
                        >
                          {paciente.responsavel.telefonePrincipal}
                        </a>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onSelectPaciente(paciente)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#133827] hover:bg-[#1a4d36] rounded-xl shadow-xs transition-colors cursor-pointer"
                        title="Abrir prontuário completo e ficha de admissão para imprimir"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#dfb842]" />
                        <span>Ver Ficha</span>
                      </button>

                      {paciente.id && (
                        <button
                          onClick={() => handleDelete(paciente.id!, paciente.nomeCompleto)}
                          disabled={deletingId === paciente.id}
                          className="p-2 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="Excluir cadastro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* FORMATO CARDS / GRID (ORDEM ALFABÉTICA) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAndFilteredPacientes.map((paciente) => {
            const age = calculateAge(paciente.dataNascimento);
            return (
              <div
                key={paciente.id || paciente.nomeCompleto}
                className="bg-white rounded-2xl border border-stone-200/90 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar with Room & Status */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#133827]">
                      <Home className="w-3.5 h-3.5 text-[#8c6b2d]" />
                      <span>{paciente.quarto || 'Sem quarto definido'}</span>
                    </div>
                    {getGrauBadge(paciente.grauDependencia)}
                  </div>

                  {/* Name & Basic Info */}
                  <div className="mt-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-serif-brand text-lg font-bold text-stone-900 leading-snug">
                        {paciente.nomeCompleto}
                      </h4>
                      {paciente.id?.startsWith('local-') ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          Teste Local
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                          Firestore
                        </span>
                      )}
                    </div>
                    {paciente.nomeSocial && (
                      <p className="text-xs text-stone-500 italic">
                        &quot;{paciente.nomeSocial}&quot;
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-stone-600">
                      {age !== null && <span>{age} anos</span>}
                      {paciente.tipoSanguineo && (
                        <span className="font-bold text-red-700">Tipo: {paciente.tipoSanguineo}</span>
                      )}
                    </div>
                  </div>

                  {/* Allergies Pill */}
                  {paciente.alergias && paciente.alergias.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 bg-red-50 text-red-800 text-[11px] p-2 rounded-lg border border-red-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span className="truncate">
                        <strong>Alergias:</strong> {paciente.alergias.join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Responsible Family Contact */}
                  <div className="mt-3 text-xs text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-200/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-stone-700">
                        Familiar: {paciente.responsavel.nome}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        {paciente.responsavel.parentesco}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-stone-700 font-mono text-[11px]">
                      <Phone className="w-3 h-3 text-[#133827]" />
                      <a
                        href={`tel:${paciente.responsavel.telefonePrincipal}`}
                        className="hover:underline hover:text-[#133827]"
                      >
                        {paciente.responsavel.telefonePrincipal}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                  <button
                    onClick={() => onSelectPaciente(paciente)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#133827] bg-[#133827]/10 hover:bg-[#133827]/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver Ficha Completa
                  </button>

                  {paciente.id && (
                    <button
                      onClick={() => handleDelete(paciente.id!, paciente.nomeCompleto)}
                      disabled={deletingId === paciente.id}
                      className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Excluir cadastro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
