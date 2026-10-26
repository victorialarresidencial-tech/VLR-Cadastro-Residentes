export type GrauDependencia = 'grau1' | 'grau2' | 'grau3';
export type StatusPaciente = 'ativo' | 'avaliacao' | 'temporario' | 'alta';
export type Sexo = 'feminino' | 'masculino' | 'outro';
export type Mobilidade = 'independente' | 'bengala_andador' | 'cadeira_rodas' | 'acamado';
export type TipoSanguineo = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'desconhecido';

export interface Medicamento {
  id: string;
  nome: string;
  dosagem: string;
  horario: string;
  instrucoes?: string;
}

export interface Responsavel {
  nome: string;
  parentesco: string;
  telefonePrincipal: string;
  telefoneSecundario?: string;
  email?: string;
  cpf?: string;
  endereco?: string;
}

export interface Paciente {
  id?: string;
  // Identificação Pessoal
  nomeCompleto: string;
  nomeSocial?: string;
  dataNascimento: string;
  cpf: string;
  rg?: string;
  sexo: Sexo;
  estadoCivil?: string;

  // Acomodação e Internação
  quarto: string; // Ex: Suíte 104 - Ala Tulipas
  dataAdmissao: string;
  status: StatusPaciente;

  // Saúde e Cuidados
  grauDependencia: GrauDependencia;
  mobilidade: Mobilidade;
  tipoSanguineo: TipoSanguineo;
  convenioMedico?: string;
  numeroCarteirinha?: string;
  hospitalReferencia?: string;

  alergias: string[];
  diagnosticos: string[];
  medicamentosContinuos: Medicamento[];
  dieta: string;

  // Familiar Responsável
  responsavel: Responsavel;

  // Rotina e Observações
  observacoesGerais?: string;
  preferenciasHabitos?: string;

  // Metadados
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface FirebaseConnectionStatus {
  configured: boolean;
  connected: boolean;
  projectId: string;
  databaseId?: string;
  errorMessage?: string;
  usingLocalStorageFallback: boolean;
}
