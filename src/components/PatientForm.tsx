import React, { useState } from 'react';
import {
  User,
  Heart,
  Calendar,
  Home,
  Phone,
  AlertTriangle,
  Pill,
  Plus,
  Trash2,
  CheckCircle2,
  FileCheck,
  Sparkles,
  Shield,
  Activity,
  FileText
} from 'lucide-react';
import { Paciente, GrauDependencia, StatusPaciente, Sexo, Mobilidade, TipoSanguineo, Medicamento } from '../types/patient';
import { cadastrarPacienteNoFirebase } from '../lib/firebase';

interface PatientFormProps {
  onSuccess: (pacienteCadastrado: Paciente) => void;
  onOpenConfig: () => void;
  isFirebaseConnected: boolean;
}

export const PatientForm: React.FC<PatientFormProps> = ({
  onSuccess,
  onOpenConfig,
  isFirebaseConnected,
}) => {
  // Form State
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [nomeSocial, setNomeSocial] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [sexo, setSexo] = useState<Sexo>('feminino');
  const [estadoCivil, setEstadoCivil] = useState('viuvo');

  const [quarto, setQuarto] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<StatusPaciente>('ativo');

  const [grauDependencia, setGrauDependencia] = useState<GrauDependencia>('grau1');
  const [mobilidade, setMobilidade] = useState<Mobilidade>('independente');
  const [tipoSanguineo, setTipoSanguineo] = useState<TipoSanguineo>('O+');
  const [convenioMedico, setConvenioMedico] = useState('');
  const [numeroCarteirinha, setNumeroCarteirinha] = useState('');
  const [hospitalReferencia, setHospitalReferencia] = useState('');

  const [alergias, setAlergias] = useState<string[]>([]);
  const [novaAlergiaInput, setNovaAlergiaInput] = useState('');

  const [diagnosticos, setDiagnosticos] = useState<string[]>(['Hipertensão']);
  const [novoDiagnosticoInput, setNovoDiagnosticoInput] = useState('');

  const [medicamentosContinuos, setMedicamentosContinuos] = useState<Medicamento[]>([
    { id: '1', nome: 'Losartana Potássica', dosagem: '50mg', horario: '08:00' },
  ]);

  const [dieta, setDieta] = useState('Dieta Geral');

  const [responsavelNome, setResponsavelNome] = useState('');
  const [responsavelParentesco, setResponsavelParentesco] = useState('Filho(a)');
  const [responsavelTelefone, setResponsavelTelefone] = useState('');
  const [responsavelTelefoneSec, setResponsavelTelefoneSec] = useState('');
  const [responsavelEmail, setResponsavelEmail] = useState('');
  const [responsavelEndereco, setResponsavelEndereco] = useState('');

  const [observacoesGerais, setObservacoesGerais] = useState('');
  const [preferenciasHabitos, setPreferenciasHabitos] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mask helpers
  const formatCPF = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  };

  const formatPhone = (val: string) => {
    return val
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2')
      .slice(0, 15);
  };

  // Age calculator
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

  const calculatedAge = calculateAge(dataNascimento);

  // Medication handlers
  const handleAddMed = () => {
    setMedicamentosContinuos([
      ...medicamentosContinuos,
      { id: Date.now().toString(), nome: '', dosagem: '', horario: '08:00' },
    ]);
  };

  const handleUpdateMed = (id: string, field: keyof Medicamento, value: string) => {
    setMedicamentosContinuos(
      medicamentosContinuos.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleRemoveMed = (id: string) => {
    setMedicamentosContinuos(medicamentosContinuos.filter((m) => m.id !== id));
  };

  // Tag list handlers
  const handleAddAlergia = (alergia: string) => {
    const trimmed = alergia.trim();
    if (trimmed && !alergias.includes(trimmed)) {
      setAlergias([...alergias, trimmed]);
      setNovaAlergiaInput('');
    }
  };

  const handleRemoveAlergia = (alergia: string) => {
    setAlergias(alergias.filter((a) => a !== alergia));
  };

  const handleAddDiagnostico = (diag: string) => {
    const trimmed = diag.trim();
    if (trimmed && !diagnosticos.includes(trimmed)) {
      setDiagnosticos([...diagnosticos, trimmed]);
      setNovoDiagnosticoInput('');
    }
  };

  const handleRemoveDiagnostico = (diag: string) => {
    setDiagnosticos(diagnosticos.filter((d) => d !== diag));
  };

  // Quick fill demo data for verification
  const handleFillDemo = () => {
    setNomeCompleto('Maria de Lourdes Silveira');
    setNomeSocial('Dona Lourdes');
    setDataNascimento('1943-05-18');
    setCpf('287.491.839-04');
    setRg('14.832.901-7');
    setSexo('feminino');
    setEstadoCivil('viuvo');
    setQuarto('Suíte 204 - Ala Jardim');
    setDataAdmissao(new Date().toISOString().split('T')[0]);
    setStatus('ativo');
    setGrauDependencia('grau2');
    setMobilidade('bengala_andador');
    setTipoSanguineo('A+');
    setConvenioMedico('Unimed Pleno');
    setNumeroCarteirinha('002938102938');
    setHospitalReferencia('Hospital Santa Catarina');
    setAlergias(['Dipirona', 'Frutos do mar']);
    setDiagnosticos(['Hipertensão', 'Diabetes Tipo 2', 'Osteoporose leve']);
    setMedicamentosContinuos([
      { id: '1', nome: 'Losartana', dosagem: '50mg', horario: '08:00' },
      { id: '2', nome: 'Metformina', dosagem: '850mg', horario: '12:00' },
      { id: '3', nome: 'Cálcio + Vitamina D', dosagem: '600mg', horario: '18:00' },
    ]);
    setDieta('Dieta Hipossódica e para Diabéticos');
    setResponsavelNome('Carlos Eduardo Silveira');
    setResponsavelParentesco('Filho(a)');
    setResponsavelTelefone('(11) 98452-3319');
    setResponsavelTelefoneSec('(11) 3218-4900');
    setResponsavelEmail('carlos.silveira@email.com');
    setResponsavelEndereco('Rua das Acácias, 420 - São Paulo, SP');
    setObservacoesGerais('Prefere quartos bem arejados. Dorme cedo, por volta das 21h30.');
    setPreferenciasHabitos('Gosta muito de jardinagem matinal, ouvir música clássica e participar do bingo nas terças.');
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomeCompleto.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, preencha o Nome Completo do paciente.' });
      return;
    }

    if (!dataNascimento) {
      setFeedback({ type: 'error', message: 'Por favor, informe a Data de Nascimento.' });
      return;
    }

    if (!responsavelNome.trim() || !responsavelTelefone.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, informe o Nome e Telefone do Familiar Responsável.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const novoPaciente: Omit<Paciente, 'id'> = {
      nomeCompleto: nomeCompleto.trim(),
      nomeSocial: nomeSocial.trim() || undefined,
      dataNascimento,
      cpf: cpf.trim(),
      rg: rg.trim() || undefined,
      sexo,
      estadoCivil,
      quarto: quarto.trim() || 'A definir',
      dataAdmissao,
      status,
      grauDependencia,
      mobilidade,
      tipoSanguineo,
      convenioMedico: convenioMedico.trim() || undefined,
      numeroCarteirinha: numeroCarteirinha.trim() || undefined,
      hospitalReferencia: hospitalReferencia.trim() || undefined,
      alergias,
      diagnosticos,
      medicamentosContinuos: medicamentosContinuos.filter((m) => m.nome.trim() !== ''),
      dieta,
      responsavel: {
        nome: responsavelNome.trim(),
        parentesco: responsavelParentesco,
        telefonePrincipal: responsavelTelefone.trim(),
        telefoneSecundario: responsavelTelefoneSec.trim() || undefined,
        email: responsavelEmail.trim() || undefined,
        endereco: responsavelEndereco.trim() || undefined,
      },
      observacoesGerais: observacoesGerais.trim() || undefined,
      preferenciasHabitos: preferenciasHabitos.trim() || undefined,
    };

    try {
      const res = await cadastrarPacienteNoFirebase(novoPaciente);

      const pacienteCompleto: Paciente = {
        ...novoPaciente,
        id: res.id,
        criadoEm: new Date().toISOString(),
      };

      if (res.savedInFirestore) {
        setFeedback({
          type: 'success',
          message: 'Paciente cadastrado com sucesso diretamente no banco Firestore da Victoria Lar Residencial!',
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Paciente cadastrado com sucesso no sistema! ${res.errorNotice || ''}`,
        });
      }

      onSuccess(pacienteCompleto);

      // Reset form
      setNomeCompleto('');
      setNomeSocial('');
      setDataNascimento('');
      setCpf('');
      setRg('');
      setQuarto('');
      setAlergias([]);
      setDiagnosticos(['Hipertensão']);
      setMedicamentosContinuos([{ id: '1', nome: '', dosagem: '', horario: '08:00' }]);
      setResponsavelNome('');
      setResponsavelTelefone('');
      setResponsavelTelefoneSec('');
      setResponsavelEmail('');
      setResponsavelEndereco('');
      setObservacoesGerais('');
      setPreferenciasHabitos('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Erro ao cadastrar paciente: ' + (err?.message || 'Falha inesperada'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Banner / Header */}
      <div className="bg-gradient-to-r from-[#143d30] via-[#1a4d3d] to-[#143d30] text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#dfb842] text-xs font-semibold uppercase tracking-widest">
            <Shield className="w-4 h-4" />
            Victoria Lar Residencial &bull; Admissão de Residentes
          </div>
          <h2 className="font-serif-brand text-2xl md:text-3xl font-bold mt-1 tracking-tight">
            Ficha de Cadastro de Paciente
          </h2>
          <p className="text-xs md:text-sm text-stone-200 mt-1 max-w-xl">
            Preencha os dados clínicos, pessoais e de contato familiar para alimentar o prontuário digital e a base do Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            type="button"
            onClick={handleFillDemo}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#143d30] bg-[#dfb842] hover:bg-[#ebd06b] rounded-lg shadow-sm transition-all"
            title="Preencher com dados fictícios para testar rapidamente"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Exemplo Rápido
          </button>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">
                {feedback.type === 'success' ? 'Sucesso!' : 'Atenção:'}
              </span>
              {feedback.message}
            </div>
            {!isFirebaseConnected && (
              <button
                type="button"
                onClick={onOpenConfig}
                className="text-xs underline font-semibold text-stone-700 hover:text-black ml-2 shrink-0"
              >
                Configurar Firebase
              </button>
            )}
          </div>
        )}

        {/* 1. DADOS PESSOAIS */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-200">
            <div className="w-7 h-7 rounded-lg bg-[#143d30]/10 text-[#143d30] flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h3 className="font-serif-brand text-lg font-bold text-[#143d30] flex items-center gap-2">
              <User className="w-4 h-4 text-[#8c6b2d]" />
              Identificação do Paciente / Residente
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Maria de Lourdes Silveira"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome Social / Como prefere ser chamado(a)
              </label>
              <input
                type="text"
                placeholder="Ex: Dona Lourdes"
                value={nomeSocial}
                onChange={(e) => setNomeSocial(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Data de Nascimento * {calculatedAge !== null && (
                  <span className="text-emerald-700 font-bold ml-1">({calculatedAge} anos)</span>
                )}
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                CPF
              </label>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                maxLength={14}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                RG
              </label>
              <input
                type="text"
                placeholder="00.000.000-0"
                value={rg}
                onChange={(e) => setRg(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Sexo
              </label>
              <select
                value={sexo}
                onChange={(e) => setSexo(e.target.value as Sexo)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              >
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
                <option value="outro">Outro / Prefere não informar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Estado Civil
              </label>
              <select
                value={estadoCivil}
                onChange={(e) => setEstadoCivil(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              >
                <option value="viuvo">Viúvo(a)</option>
                <option value="casado">Casado(a)</option>
                <option value="solteiro">Solteiro(a)</option>
                <option value="divorciado">Divorciado(a)</option>
                <option value="uniao_estavel">União Estável</option>
              </select>
            </div>
          </div>
        </section>

        {/* 2. ACOMODAÇÃO & STATUS NO LAR */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-200">
            <div className="w-7 h-7 rounded-lg bg-[#143d30]/10 text-[#143d30] flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h3 className="font-serif-brand text-lg font-bold text-[#143d30] flex items-center gap-2">
              <Home className="w-4 h-4 text-[#8c6b2d]" />
              Acomodação & Admissão na Victoria Lar
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Quarto / Suíte / Leito Atribuído
              </label>
              <input
                type="text"
                placeholder="Ex: Suíte 104 - Ala Jardim"
                value={quarto}
                onChange={(e) => setQuarto(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Data de Entrada / Admissão
              </label>
              <input
                type="date"
                value={dataAdmissao}
                onChange={(e) => setDataAdmissao(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Status do Residente
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusPaciente)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              >
                <option value="ativo">Residente Ativo (Morador)</option>
                <option value="avaliacao">Em Período de Avaliação</option>
                <option value="temporario">Hospedagem Temporária / Reabilitação</option>
                <option value="alta">Alta / Histórico</option>
              </select>
            </div>
          </div>
        </section>

        {/* 3. SAÚDE, DEPENDÊNCIA & CUIDADOS */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-200">
            <div className="w-7 h-7 rounded-lg bg-[#143d30]/10 text-[#143d30] flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h3 className="font-serif-brand text-lg font-bold text-[#143d30] flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-600" />
              Saúde, Grau de Dependência & Cuidados Médicos
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Grau de Dependência ANVISA */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Grau de Dependência (Norma ILPI)
              </label>
              <select
                value={grauDependencia}
                onChange={(e) => setGrauDependencia(e.target.value as GrauDependencia)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              >
                <option value="grau1">Grau I - Independente / Apoio leve</option>
                <option value="grau2">Grau II - Semidependente (até 3 AVDs)</option>
                <option value="grau3">Grau III - Totalmente dependente</option>
              </select>
              <p className="text-[11px] text-stone-500 mt-1">
                Define a intensidade da equipe de cuidadores e enfermagem 24h.
              </p>
            </div>

            {/* Mobilidade */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Mobilidade
              </label>
              <select
                value={mobilidade}
                onChange={(e) => setMobilidade(e.target.value as Mobilidade)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              >
                <option value="independente">Caminha sem auxílio</option>
                <option value="bengala_andador">Com auxílio (Bengala / Andador)</option>
                <option value="cadeira_rodas">Cadeira de Rodas</option>
                <option value="acamado">Acamado(a)</option>
              </select>
            </div>

            {/* Tipo Sanguíneo */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Tipo Sanguíneo
              </label>
              <select
                value={tipoSanguineo}
                onChange={(e) => setTipoSanguineo(e.target.value as TipoSanguineo)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="desconhecido">Não informado</option>
              </select>
            </div>

            {/* Convênio & Hospital */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Plano de Saúde / Convênio
              </label>
              <input
                type="text"
                placeholder="Ex: Unimed, Bradesco Saúde, SUS"
                value={convenioMedico}
                onChange={(e) => setConvenioMedico(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Número da Carteirinha / Matrícula
              </label>
              <input
                type="text"
                placeholder="Ex: 002938102938"
                value={numeroCarteirinha}
                onChange={(e) => setNumeroCarteirinha(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Hospital de Preferência / Emergência
              </label>
              <input
                type="text"
                placeholder="Ex: Hospital Santa Catarina, Sírio-Libanês"
                value={hospitalReferencia}
                onChange={(e) => setHospitalReferencia(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>
          </div>

          {/* ALERGIAS (ALERTA EM DESTAQUE) */}
          <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                Alergias Conhecidas (Medicamentosas ou Alimentares)
              </label>
              <span className="text-[11px] text-red-700 font-medium">Item crítico para enfermagem</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {alergias.map((alergia) => (
                <span
                  key={alergia}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold border border-red-300"
                >
                  {alergia}
                  <button
                    type="button"
                    onClick={() => handleRemoveAlergia(alergia)}
                    className="hover:text-red-950 font-bold"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {alergias.length === 0 && (
                <span className="text-xs text-stone-500 italic">Nenhuma alergia adicionada.</span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Adicionar alergia (ex: Dipirona, Penicilina, Iodo, Lactose)..."
                value={novaAlergiaInput}
                onChange={(e) => setNovaAlergiaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAlergia(novaAlergiaInput);
                  }
                }}
                className="flex-1 px-3 py-2 text-xs bg-white border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={() => handleAddAlergia(novaAlergiaInput)}
                className="px-3 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                + Adicionar
              </button>
            </div>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5 items-center pt-1">
              <span className="text-[10px] text-stone-500">Sugestões rápidas:</span>
              {['Dipirona', 'Penicilina', 'Sulfa', 'Anti-inflamatórios', 'Lactose', 'Glúten', 'Frutos do Mar'].map(
                (sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => handleAddAlergia(sug)}
                    className="text-[10px] px-2 py-0.5 bg-white border border-stone-300 rounded text-stone-700 hover:border-red-400 hover:text-red-700 transition-colors"
                  >
                    + {sug}
                  </button>
                )
              )}
            </div>
          </div>

          {/* DIAGNÓSTICOS / COMORBIDADES */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
            <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#143d30]" />
              Diagnósticos Médicos & Condições Pré-existentes
            </label>

            <div className="flex flex-wrap gap-1.5">
              {diagnosticos.map((diag) => (
                <span
                  key={diag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-200 text-stone-800 text-xs font-medium border border-stone-300"
                >
                  {diag}
                  <button
                    type="button"
                    onClick={() => handleRemoveDiagnostico(diag)}
                    className="hover:text-black font-bold"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {diagnosticos.length === 0 && (
                <span className="text-xs text-stone-500 italic">Nenhum diagnóstico listado.</span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Adicionar diagnóstico (ex: Diabetes, Alzheimer, Cardiopatia, AVC Prévio)..."
                value={novoDiagnosticoInput}
                onChange={(e) => setNovoDiagnosticoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDiagnostico(novoDiagnosticoInput);
                  }
                }}
                className="flex-1 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
              <button
                type="button"
                onClick={() => handleAddDiagnostico(novoDiagnosticoInput)}
                className="px-3 py-2 bg-[#143d30] hover:bg-[#1a4d3d] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                + Adicionar
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 items-center pt-1">
              <span className="text-[10px] text-stone-500">Comuns em idosos:</span>
              {[
                'Hipertensão',
                'Diabetes Mellitus',
                'Alzheimer / Demência',
                'Doença de Parkinson',
                'Osteoporose',
                'Cardiopatia',
                'Sequela de AVC',
                'Depressão',
              ].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => handleAddDiagnostico(sug)}
                  className="text-[10px] px-2 py-0.5 bg-white border border-stone-300 rounded text-stone-700 hover:border-[#143d30] hover:text-[#143d30] transition-colors"
                >
                  + {sug}
                </button>
              ))}
            </div>
          </div>

          {/* MEDICAMENTOS DE USO CONTÍNUO */}
          <div className="border border-stone-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-emerald-700" />
                Medicamentos de Uso Contínuo
              </label>
              <button
                type="button"
                onClick={handleAddMed}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#143d30] hover:text-[#8c6b2d] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Medicamento
              </button>
            </div>

            <div className="space-y-2.5">
              {medicamentosContinuos.map((med, index) => (
                <div key={med.id} className="flex flex-col md:flex-row items-center gap-2 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
                  <span className="text-xs font-bold text-stone-500 w-5 text-center">#{index + 1}</span>
                  <input
                    type="text"
                    placeholder="Nome do medicamento (ex: Losartana)"
                    value={med.nome}
                    onChange={(e) => handleUpdateMed(med.id, 'nome', e.target.value)}
                    className="flex-1 w-full md:w-auto px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#143d30]"
                  />
                  <input
                    type="text"
                    placeholder="Dosagem (ex: 50mg, 1 cp)"
                    value={med.dosagem}
                    onChange={(e) => handleUpdateMed(med.id, 'dosagem', e.target.value)}
                    className="w-full md:w-36 px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#143d30]"
                  />
                  <input
                    type="text"
                    placeholder="Horários (ex: 08:00 / 20:00)"
                    value={med.horario}
                    onChange={(e) => handleUpdateMed(med.id, 'horario', e.target.value)}
                    className="w-full md:w-40 px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-[#143d30]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveMed(med.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
                    title="Remover medicamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dieta */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Dieta & Restrições Nutricionais
            </label>
            <input
              type="text"
              placeholder="Ex: Dieta Geral, Pastosa, Hipossódica, Sem Açúcar, Enteral"
              value={dieta}
              onChange={(e) => setDieta(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
            />
          </div>
        </section>

        {/* 4. FAMILIAR RESPONSÁVEL / CONTATO DE EMERGÊNCIA */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-200">
            <div className="w-7 h-7 rounded-lg bg-[#143d30]/10 text-[#143d30] flex items-center justify-center font-bold text-xs">
              4
            </div>
            <h3 className="font-serif-brand text-lg font-bold text-[#143d30] flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#8c6b2d]" />
              Familiar Responsável & Contato de Emergência
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nome do Responsável *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Eduardo Silveira"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Grau de Parentesco *
              </label>
              <select
                value={responsavelParentesco}
                onChange={(e) => setResponsavelParentesco(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              >
                <option value="Filho(a)">Filho(a)</option>
                <option value="Cônjuge">Cônjuge</option>
                <option value="Irmão(ã)">Irmão(ã)</option>
                <option value="Neto(a)">Neto(a)</option>
                <option value="Sobrinho(a)">Sobrinho(a)</option>
                <option value="Tutor / Curador Legal">Tutor / Curador Legal</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Telefone Principal / WhatsApp *
              </label>
              <input
                type="text"
                required
                placeholder="(00) 00000-0000"
                value={responsavelTelefone}
                onChange={(e) => setResponsavelTelefone(formatPhone(e.target.value))}
                maxLength={15}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Telefone Secundário / Comercial
              </label>
              <input
                type="text"
                placeholder="(00) 0000-0000"
                value={responsavelTelefoneSec}
                onChange={(e) => setResponsavelTelefoneSec(formatPhone(e.target.value))}
                maxLength={15}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                E-mail do Responsável
              </label>
              <input
                type="email"
                placeholder="responsavel@email.com"
                value={responsavelEmail}
                onChange={(e) => setResponsavelEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Endereço / Cidade do Responsável
              </label>
              <input
                type="text"
                placeholder="Rua, número, bairro e cidade"
                value={responsavelEndereco}
                onChange={(e) => setResponsavelEndereco(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>
          </div>
        </section>

        {/* 5. ROTINA, HÁBITOS E OBSERVAÇÕES */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-stone-200">
            <div className="w-7 h-7 rounded-lg bg-[#143d30]/10 text-[#143d30] flex items-center justify-center font-bold text-xs">
              5
            </div>
            <h3 className="font-serif-brand text-lg font-bold text-[#143d30] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#8c6b2d]" />
              Hábitos, Preferências e Observações da Equipe
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Preferências Pessoais & Rotina
              </label>
              <textarea
                rows={3}
                placeholder="Gostos musicais, passatempos, horário de acordar/dormir, banho, o que acalma ou alegra o residente..."
                value={preferenciasHabitos}
                onChange={(e) => setPreferenciasHabitos(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Observações Gerais da Admissão
              </label>
              <textarea
                rows={3}
                placeholder="Anotações para a equipe de enfermagem, cuidadores ou nutricionista na recepção do paciente..."
                value={observacoesGerais}
                onChange={(e) => setObservacoesGerais(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-stone-50/60 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#143d30]"
              />
            </div>
          </div>
        </section>

        {/* Submit Bar */}
        <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <div className={`w-2.5 h-2.5 rounded-full ${isFirebaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>
              Destino:{' '}
              <strong className="text-stone-700 font-mono">
                Firestore (victoria-lar-residencial / coleção &apos;pacientes&apos;)
              </strong>{' '}
              &bull; <span className="text-emerald-700 font-semibold">Zero Storage Local</span>
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-[#143d30] via-[#1a4d3d] to-[#143d30] hover:from-[#0f3026] hover:to-[#174738] rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cadastrando Paciente...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-[#dfb842]" />
                  Finalizar e Salvar Cadastro
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
