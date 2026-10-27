import React from 'react';
import {
  X,
  Printer,
  Phone,
  AlertTriangle,
  User,
  Heart,
  Calendar,
  Home,
  Pill,
  Shield,
  Clock,
  Activity,
  CheckCircle2,
  Edit
} from 'lucide-react';
import { Paciente } from '../types/patient';
import { VictoriaLogo } from './VictoriaLogo';

interface PatientDetailsModalProps {
  paciente: Paciente | null;
  onClose: () => void;
  onEdit?: (paciente: Paciente) => void;
}

export const PatientDetailsModal: React.FC<PatientDetailsModalProps> = ({
  paciente,
  onClose,
  onEdit,
}) => {
  if (!paciente) return null;

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

  const age = calculateAge(paciente.dataNascimento);

  const getGrauLabel = (grau: string) => {
    switch (grau) {
      case 'grau1':
        return 'Grau I - Independente';
      case 'grau2':
        return 'Grau II - Semidependente';
      case 'grau3':
        return 'Grau III - Totalmente Dependente';
      default:
        return grau;
    }
  };

  const getMobilidadeLabel = (mob: string) => {
    switch (mob) {
      case 'independente':
        return 'Caminha sem auxílio';
      case 'bengala_andador':
        return 'Com apoio (Bengala / Andador)';
      case 'cadeira_rodas':
        return 'Cadeira de Rodas';
      case 'acamado':
        return 'Acamado(a)';
      default:
        return mob;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        {/* Modal Toolbar (hidden on print) */}
        <div className="bg-[#143d30] text-white p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#dfb842]" />
            <span className="text-xs uppercase tracking-wider font-semibold text-[#dfb842]">
              Ficha do Residente &bull; Victoria Lar Residencial
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(paciente)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                title="Editar dados cadastrais"
              >
                <Edit className="w-3.5 h-3.5 text-[#dfb842]" />
                Editar Dados
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#dfb842] hover:bg-[#ebd06b] text-[#143d30] font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Ficha
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 space-y-6 text-stone-800 print-card">
          {/* Header with Logo */}
          <div className="flex items-start justify-between border-b-2 border-[#143d30]/20 pb-5">
            <div className="bg-[#133827] px-4 py-2 rounded-xl shadow-xs border border-[#dfb842]/30 inline-block">
              <VictoriaLogo size="md" />
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold tracking-wider uppercase text-stone-500 block">
                Ficha Cadastral Oficial
              </span>
              <span className="text-xs font-mono text-stone-600 block mt-0.5">
                Cód: {paciente.id ? paciente.id.slice(0, 10) : 'NOVO'}
              </span>
              <span className="text-[11px] text-stone-500 block">
                Admissão: {paciente.dataAdmissao || 'Não informada'}
              </span>
            </div>
          </div>

          {/* Primary Resident Overview */}
          <div className="bg-[#f7f5ed] border border-[#e1d9c2] rounded-xl p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#8c6b2d] uppercase tracking-wider block">
                  Residente
                </span>
                <h1 className="font-serif-brand text-2xl font-bold text-[#143d30]">
                  {paciente.nomeCompleto}
                </h1>
                {paciente.nomeSocial && (
                  <p className="text-xs text-stone-600 italic">
                    Conhecido(a) como: <strong className="text-stone-800">{paciente.nomeSocial}</strong>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#143d30] text-[#dfb842]">
                  {paciente.quarto || 'Quarto não definido'}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {paciente.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#e1d9c2]/70 text-xs">
              <div>
                <span className="text-stone-500 block text-[11px]">Nascimento</span>
                <strong className="text-stone-800">{paciente.dataNascimento}</strong>
                {age && <span className="text-stone-600 block text-[10px]">({age} anos)</span>}
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">CPF</span>
                <strong className="text-stone-800 font-mono">{paciente.cpf || 'Não informado'}</strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Tipo Sanguíneo</span>
                <strong className="text-red-700 font-bold">{paciente.tipoSanguineo || 'N/I'}</strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Dependência</span>
                <strong className="text-[#143d30] font-semibold">{getGrauLabel(paciente.grauDependencia)}</strong>
              </div>
            </div>
          </div>

          {/* Allergies Alert Banner */}
          {paciente.alergias && paciente.alergias.length > 0 && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">
                  Atenção: Alergias Registradas
                </h4>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {paciente.alergias.map((alergia) => (
                    <span
                      key={alergia}
                      className="px-2.5 py-0.5 bg-red-100 text-red-800 rounded-md text-xs font-bold border border-red-200"
                    >
                      {alergia}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Clinical Profile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Health Info */}
            <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-white">
              <h4 className="font-bold text-[#143d30] uppercase tracking-wider flex items-center gap-1.5 text-xs">
                <Heart className="w-3.5 h-3.5 text-red-600" />
                Quadro Clínico & Mobilidade
              </h4>

              <div className="space-y-1.5">
                <div>
                  <span className="text-stone-500 block text-[11px]">Mobilidade</span>
                  <span className="font-medium text-stone-800">{getMobilidadeLabel(paciente.mobilidade)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Dieta Recomendada</span>
                  <span className="font-medium text-stone-800">{paciente.dieta || 'Geral'}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Plano de Saúde / Convênio</span>
                  <span className="font-medium text-stone-800">
                    {paciente.convenioMedico || 'Particular / Sem convênio'}
                    {paciente.numeroCarteirinha && ` (Carteira: ${paciente.numeroCarteirinha})`}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Hospital de Referência</span>
                  <span className="font-medium text-stone-800">{paciente.hospitalReferencia || 'Não informado'}</span>
                </div>
              </div>

              {/* Diagnósticos */}
              {paciente.diagnosticos && paciente.diagnosticos.length > 0 && (
                <div className="pt-2 border-t border-stone-100">
                  <span className="text-stone-500 block text-[11px] mb-1">Diagnósticos & Comorbidades:</span>
                  <div className="flex flex-wrap gap-1">
                    {paciente.diagnosticos.map((diag) => (
                      <span
                        key={diag}
                        className="px-2 py-0.5 bg-stone-100 text-stone-800 rounded text-[11px] border border-stone-200"
                      >
                        {diag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Continuous Medications */}
            <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-white">
              <h4 className="font-bold text-[#143d30] uppercase tracking-wider flex items-center gap-1.5 text-xs">
                <Pill className="w-3.5 h-3.5 text-emerald-700" />
                Medicamentos de Uso Contínuo
              </h4>

              {paciente.medicamentosContinuos && paciente.medicamentosContinuos.length > 0 ? (
                <ul className="space-y-2">
                  {paciente.medicamentosContinuos.map((med, idx) => (
                    <li key={med.id || idx} className="bg-stone-50 p-2 rounded-lg border border-stone-200">
                      <div className="font-semibold text-stone-900">{med.nome}</div>
                      <div className="flex items-center gap-3 text-stone-600 text-[11px] mt-0.5">
                        <span>Dose: <strong>{med.dosagem || 'N/I'}</strong></span>
                        <span>Horário: <strong>{med.horario || 'N/I'}</strong></span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-stone-500 italic text-[11px]">Nenhum medicamento registrado.</p>
              )}
            </div>
          </div>

          {/* Responsible Family Contact */}
          <div className="bg-[#143d30]/5 border border-[#143d30]/20 rounded-xl p-4 text-xs space-y-2">
            <h4 className="font-bold text-[#143d30] uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#8c6b2d]" />
              Contato Familiar de Emergência
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-stone-500 block text-[11px]">Nome do Familiar</span>
                <strong className="text-stone-800">{paciente.responsavel.nome}</strong>
                <span className="text-stone-600 block text-[10px]">({paciente.responsavel.parentesco})</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Telefone Principal</span>
                <strong className="text-stone-800 font-mono">{paciente.responsavel.telefonePrincipal}</strong>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Telefone Recado / E-mail</span>
                <span className="text-stone-800">{paciente.responsavel.telefoneSecundario || paciente.responsavel.email || '-'}</span>
              </div>
            </div>

            {paciente.responsavel.endereco && (
              <div className="pt-2 border-t border-[#143d30]/10 text-[11px] text-stone-600">
                Endereço: {paciente.responsavel.endereco}
              </div>
            )}
          </div>

          {/* Preferences & Routine */}
          {(paciente.preferenciasHabitos || paciente.observacoesGerais) && (
            <div className="border border-stone-200 rounded-xl p-4 text-xs space-y-3 bg-stone-50/50">
              {paciente.preferenciasHabitos && (
                <div>
                  <span className="font-bold text-stone-700 block mb-0.5">Rotina e Hábitos do Residente:</span>
                  <p className="text-stone-600 leading-relaxed">{paciente.preferenciasHabitos}</p>
                </div>
              )}
              {paciente.observacoesGerais && (
                <div>
                  <span className="font-bold text-stone-700 block mb-0.5">Observações Gerais:</span>
                  <p className="text-stone-600 leading-relaxed">{paciente.observacoesGerais}</p>
                </div>
              )}
            </div>
          )}

          {/* Signatures for Print Sheet */}
          <div className="hidden print-only pt-12 mt-12 border-t border-stone-300">
            <div className="grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-t border-stone-400 pt-1">
                  Enfermagem / Equipe Técnica
                </div>
                <span className="text-[10px] text-stone-500">Victoria Lar Residencial</span>
              </div>
              <div>
                <div className="border-t border-stone-400 pt-1">
                  Assinatura do Familiar / Responsável
                </div>
                <span className="text-[10px] text-stone-500">{paciente.responsavel.nome}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Close */}
        <div className="bg-stone-50 p-4 border-t border-stone-200 flex justify-end no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-200 hover:bg-stone-300 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
