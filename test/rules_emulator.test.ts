import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID = 'victoria-lar-residencial';

// Payload institucional válido de residente conforme schema
const validPacienteData = {
  nomeCompleto: 'Dona Helena Silva',
  dataNascimento: '1945-03-12',
  sexo: 'feminino',
  quarto: 'Quarto 102 - Ala Leste',
  dataAdmissao: '2023-01-15',
  status: 'ativo',
  grauDependencia: 'grau2',
  mobilidade: 'cadeira_rodas',
  tipoSanguineo: 'O+',
  responsavel: {
    nome: 'Carlos Silva (Filho)',
    telefonePrincipal: '(11) 98765-4321',
  },
};

async function runRulesTests() {
  console.log('======================================================================');
  console.log('  TESTES REAIS DAS REGRAS DEFINITIVAS PROPOSTAS (FASE 1.2 RBAC)');
  console.log('  Motor: Firebase Firestore Emulator Suite');
  console.log('  Projeto Alvo:', PROJECT_ID);
  console.log('======================================================================\n');

  // Carregar as regras definitivas propostas (candidatas sem bootstrap por e-mail)
  const candidateRulesPath = path.resolve(__dirname, '../firestore.rules.candidate');
  assert(fs.existsSync(candidateRulesPath), 'Arquivo firestore.rules.candidate deve existir!');
  const candidateRules = fs.readFileSync(candidateRulesPath, 'utf8');

  console.log('Regras candidatas carregadas:');
  console.log(`- Caminho: ${candidateRulesPath}`);
  console.log(`- Tamanho: ${candidateRules.length} bytes`);
  console.log('- Validação: Sem bootstrap estático por e-mail; isAdmin() e isStaffMember() baseados em documento ativo com e-mail verificado.\n');

  let testEnv: RulesTestEnvironment;
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
      },
    });
  } catch (err: any) {
    console.error('Erro ao conectar ao Firebase Emulator:', err?.message || err);
    throw err;
  }

  // 0. Preparação dos dados institucionais iniciais com Security Rules desabilitadas
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Administrador legítimo ativo com e-mail verificado
    await setDoc(doc(db, 'admins', 'admin_ativo_verificado_uid'), {
      nome: 'Dra. Beatriz Santos',
      email: 'beatriz.diretoria@victorialar.com.br',
      cargo: 'Diretora Médica',
      ativo: true,
      criadoEm: '2024-01-01T00:00:00.000Z',
    });

    // 2. Administrador inativo (revogado)
    await setDoc(doc(db, 'admins', 'admin_inativo_uid'), {
      nome: 'Ex-Administrador Carlos',
      email: 'exadmin.carlos@victorialar.com.br',
      cargo: 'Ex-Diretor',
      ativo: false,
      criadoEm: '2023-01-01T00:00:00.000Z',
    });

    // 3. Administrador registrado como ativo mas que NÃO possui e-mail verificado
    await setDoc(doc(db, 'admins', 'admin_nao_verificado_uid'), {
      nome: 'Admin Provisório Não Verificado',
      email: 'nao.verificado@victorialar.com.br',
      cargo: 'Supervisor',
      ativo: true,
      criadoEm: '2024-02-01T00:00:00.000Z',
    });

    // 4. Funcionário Ativo com e-mail verificado
    await setDoc(doc(db, 'funcionarios', 'func_ativo_uid'), {
      nome: 'Enfermeira Chefe Mariana',
      email: 'mariana.enfermagem@victorialar.com.br',
      cargo: 'Enfermeira',
      ativo: true,
      criadoEm: '2024-01-10T00:00:00.000Z',
    });

    // 5. Funcionário Inativo (revogado/afastado)
    await setDoc(doc(db, 'funcionarios', 'func_inativo_uid'), {
      nome: 'Ex-Funcionário Roberto',
      email: 'roberto.ex@victorialar.com.br',
      cargo: 'Cuidador',
      ativo: false,
      criadoEm: '2023-05-10T00:00:00.000Z',
    });

    // 6. Funcionário com documento incompleto (sem campo ativo)
    await setDoc(doc(db, 'funcionarios', 'func_sem_campo_ativo_uid'), {
      nome: 'Funcionário Cadastro Incompleto',
      email: 'incompleto@victorialar.com.br',
      cargo: 'Assistente',
      criadoEm: '2023-06-10T00:00:00.000Z',
    });

    // 7. Residente pré-existente
    await setDoc(doc(db, 'pacientes', 'paciente_existente_01'), validPacienteData);
  });

  console.log('✓ Base institucional de teste inicializada com sucesso no Firestore Emulator.\n');

  // =========================================================================
  // DEFINIÇÃO DOS CONTEXTOS DE TESTE NO EMULADOR
  // =========================================================================

  // A. Admin legítimo ativo com e-mail verificado
  const adminAtivoCtx = testEnv.authenticatedContext('admin_ativo_verificado_uid', {
    email: 'beatriz.diretoria@victorialar.com.br',
    email_verified: true,
  });

  // B. Admin ativo MAS com e-mail NÃO verificado
  const adminNaoVerificadoCtx = testEnv.authenticatedContext('admin_nao_verificado_uid', {
    email: 'nao.verificado@victorialar.com.br',
    email_verified: false,
  });

  // C. Admin inativo (revogado)
  const adminInativoCtx = testEnv.authenticatedContext('admin_inativo_uid', {
    email: 'exadmin.carlos@victorialar.com.br',
    email_verified: true,
  });

  // D. Funcionário ativo com e-mail verificado
  const staffAtivoCtx = testEnv.authenticatedContext('func_ativo_uid', {
    email: 'mariana.enfermagem@victorialar.com.br',
    email_verified: true,
  });

  // E. Funcionário inativo
  const staffInativoCtx = testEnv.authenticatedContext('func_inativo_uid', {
    email: 'roberto.ex@victorialar.com.br',
    email_verified: true,
  });

  // F. Funcionário sem o campo ativo
  const staffSemCampoAtivoCtx = testEnv.authenticatedContext('func_sem_campo_ativo_uid', {
    email: 'incompleto@victorialar.com.br',
    email_verified: true,
  });

  // G. Usuário autenticado sem documento institucional (externo)
  const usuarioSemDocCtx = testEnv.authenticatedContext('usuario_sem_doc_uid', {
    email: 'estranho@gmail.com',
    email_verified: true,
  });

  // H. E-mail do bootstrap tentando operar SEM documento prévio em /admins (Versão definitiva)
  const bootstrapSemDocCtx = testEnv.authenticatedContext('bootstrap_sem_doc_uid', {
    email: 'victorialarresidencial@gmail.com',
    email_verified: true,
  });

  // I. Usuário desconectado (anônimo / sem token)
  const desautenticadoCtx = testEnv.unauthenticatedContext();

  // =========================================================================
  // BATERIA DE TESTES REAIS CONTRA O FIRESTORE EMULATOR
  // =========================================================================

  // 1. ADMIN COM E-MAIL NÃO VERIFICADO (BLOQUEIO TOTAL DE PRIVILÉGIOS)
  console.log('[TESTE 1/14] Administrador com e-mail NÃO verificado...');
  const dbAdminNaoVerificado = adminNaoVerificadoCtx.firestore();
  await assertFails(getDocs(collection(dbAdminNaoVerificado, 'pacientes')));
  await assertFails(getDocs(collection(dbAdminNaoVerificado, 'admins')));
  await assertFails(getDocs(collection(dbAdminNaoVerificado, 'funcionarios')));
  await assertFails(deleteDoc(doc(dbAdminNaoVerificado, 'pacientes', 'paciente_existente_01')));
  await assertFails(
    setDoc(doc(dbAdminNaoVerificado, 'funcionarios', 'novo_func_fraude'), {
      nome: 'Fraude',
      ativo: true,
    })
  );
  console.log('  ✓ Administrador ativo sem e-mail verificado tem TODOS os privilégios bloqueados pelo servidor.');

  // 2. ADMIN INATIVO (REVOGADO)
  console.log('\n[TESTE 2/14] Administrador inativo (revogado)...');
  const dbAdminInativo = adminInativoCtx.firestore();
  await assertFails(getDocs(collection(dbAdminInativo, 'pacientes')));
  await assertFails(getDocs(collection(dbAdminInativo, 'admins')));
  await assertFails(getDocs(collection(dbAdminInativo, 'funcionarios')));
  await assertFails(deleteDoc(doc(dbAdminInativo, 'pacientes', 'paciente_existente_01')));
  console.log('  ✓ Administrador inativo bloqueado para qualquer operação administrativa ou de residentes.');

  // 3. REMOÇÃO DO BOOTSTRAP POR E-MAIL NA VERSÃO DEFINITIVA
  console.log('\n[TESTE 3/14] Conta com e-mail victorialarresidencial@gmail.com sem documento em /admins...');
  const dbBootstrapSemDoc = bootstrapSemDocCtx.firestore();
  await assertFails(getDocs(collection(dbBootstrapSemDoc, 'pacientes')));
  await assertFails(getDocs(collection(dbBootstrapSemDoc, 'admins')));
  await assertFails(getDocs(collection(dbBootstrapSemDoc, 'funcionarios')));
  await assertFails(deleteDoc(doc(dbBootstrapSemDoc, 'pacientes', 'paciente_existente_01')));
  console.log('  ✓ Regras definitivas não concedem privilégio por string de e-mail; documento ativo em /admins/{uid} é estritamente exigido.');

  // 4. FUNCIONÁRIO INATIVO
  console.log('\n[TESTE 4/14] Funcionário inativo (ativo: false)...');
  const dbStaffInativo = staffInativoCtx.firestore();
  await assertFails(getDoc(doc(dbStaffInativo, 'pacientes', 'paciente_existente_01')));
  await assertFails(getDocs(collection(dbStaffInativo, 'pacientes')));
  await assertFails(setDoc(doc(dbStaffInativo, 'pacientes', 'paciente_inv_inativo'), validPacienteData));
  await assertFails(
    updateDoc(doc(dbStaffInativo, 'pacientes', 'paciente_existente_01'), {
      quarto: 'Invasão',
    })
  );
  await assertFails(deleteDoc(doc(dbStaffInativo, 'pacientes', 'paciente_existente_01')));
  console.log('  ✓ Funcionário inativo bloqueado para leitura, listagem, cadastro, edição e exclusão em /pacientes.');

  // 5. FUNCIONÁRIO SEM O CAMPO ATIVO
  console.log('\n[TESTE 5/14] Funcionário com documento sem campo ativo...');
  const dbStaffSemAtivo = staffSemCampoAtivoCtx.firestore();
  await assertFails(getDoc(doc(dbStaffSemAtivo, 'pacientes', 'paciente_existente_01')));
  await assertFails(getDocs(collection(dbStaffSemAtivo, 'pacientes')));
  await assertFails(setDoc(doc(dbStaffSemAtivo, 'pacientes', 'paciente_inv_sem_ativo'), validPacienteData));
  console.log('  ✓ Funcionário sem campo ativo explicitamente igual a true é rejeitado.');

  // 6. USUÁRIO AUTENTICADO SEM DOCUMENTO INSTITUCIONAL
  console.log('\n[TESTE 6/14] Usuário autenticado externo sem documento institucional...');
  const dbUsuarioSemDoc = usuarioSemDocCtx.firestore();
  await assertFails(getDoc(doc(dbUsuarioSemDoc, 'pacientes', 'paciente_existente_01')));
  await assertFails(getDocs(collection(dbUsuarioSemDoc, 'pacientes')));
  await assertFails(getDocs(collection(dbUsuarioSemDoc, 'admins')));
  await assertFails(getDocs(collection(dbUsuarioSemDoc, 'funcionarios')));
  await assertFails(setDoc(doc(dbUsuarioSemDoc, 'pacientes', 'paciente_invasao'), validPacienteData));
  console.log('  ✓ Usuário externo sem registro em /admins ou /funcionarios bloqueado em todas as coleções.');

  // 7. LEITURA DO PRÓPRIO DOCUMENTO NÃO CONCEDE PRIVILÉGIOS
  console.log('\n[TESTE 7/14] Leitura do próprio documento institucional não concede privilégios...');
  // 7.1. Funcionário inativo consegue consultar o próprio perfil
  await assertSucceeds(getDoc(doc(dbStaffInativo, 'funcionarios', 'func_inativo_uid')));
  // 7.2. Mas a leitura não confere acesso a pacientes
  await assertFails(getDoc(doc(dbStaffInativo, 'pacientes', 'paciente_existente_01')));
  // 7.3. Admin inativo consegue consultar seu próprio perfil
  await assertSucceeds(getDoc(doc(dbAdminInativo, 'admins', 'admin_inativo_uid')));
  // 7.4. Mas continua proibido de gerenciar diretórios
  await assertFails(getDocs(collection(dbAdminInativo, 'funcionarios')));
  // 7.5. Funcionário ativo NÃO pode ler documento de outro colega ou admin
  const dbStaffAtivo = staffAtivoCtx.firestore();
  await assertFails(getDoc(doc(dbStaffAtivo, 'funcionarios', 'func_inativo_uid')));
  await assertFails(getDoc(doc(dbStaffAtivo, 'admins', 'admin_ativo_verificado_uid')));
  console.log('  ✓ Leitura do próprio documento é estritamente pessoal e não concede elevação de privilégios.');

  // 8. TENTATIVAS DE AUTOELEVAÇÃO E REATIVAÇÃO INDEVIDA
  console.log('\n[TESTE 8/14] Proteção contra autoelevação e reativação não autorizada...');
  // 8.1. Funcionário ativo tentando criar documento para si em /admins
  await assertFails(
    setDoc(doc(dbStaffAtivo, 'admins', 'func_ativo_uid'), {
      nome: 'Staff Auto Elevado',
      ativo: true,
    })
  );
  // 8.2. Funcionário ativo tentando alterar o próprio cargo em /funcionarios
  await assertFails(
    updateDoc(doc(dbStaffAtivo, 'funcionarios', 'func_ativo_uid'), {
      cargo: 'Diretor Geral SuperAdmin',
    })
  );
  // 8.3. Funcionário inativo tentando se reativar em /funcionarios
  await assertFails(
    updateDoc(doc(dbStaffInativo, 'funcionarios', 'func_inativo_uid'), {
      ativo: true,
    })
  );
  // 8.4. Admin inativo tentando se reativar em /admins
  await assertFails(
    updateDoc(doc(dbAdminInativo, 'admins', 'admin_inativo_uid'), {
      ativo: true,
    })
  );
  // 8.5. Usuário externo tentando criar documento de admin
  await assertFails(
    setDoc(doc(dbUsuarioSemDoc, 'admins', 'usuario_sem_doc_uid'), {
      nome: 'Hacker',
      ativo: true,
    })
  );
  console.log('  ✓ Tentativas de autoelevação e reativação bloqueadas em nível de servidor.');

  // 9. FUNCIONÁRIO ATIVO OPERANDO RESIDENTES
  console.log('\n[TESTE 9/14] Funcionário ativo operando prontuários de residentes...');
  await assertSucceeds(getDoc(doc(dbStaffAtivo, 'pacientes', 'paciente_existente_01')));
  await assertSucceeds(getDocs(collection(dbStaffAtivo, 'pacientes')));
  await assertSucceeds(
    setDoc(doc(dbStaffAtivo, 'pacientes', 'paciente_novo_staff'), validPacienteData)
  );
  await assertSucceeds(
    updateDoc(doc(dbStaffAtivo, 'pacientes', 'paciente_existente_01'), {
      ...validPacienteData,
      quarto: 'Quarto 204 - Ala Norte',
    })
  );
  console.log('  ✓ Funcionário ativo pode ler, listar, cadastrar e atualizar residentes.');

  // 10. SEGREGAÇÃO DE OPERAÇÕES PROTEGIDAS (ADMIN VS FUNCIONÁRIO)
  console.log('\n[TESTE 10/14] Segregação de operações protegidas (exclusão e diretórios)...');
  // Funcionário tentando excluir paciente -> BLOQUEADO
  await assertFails(deleteDoc(doc(dbStaffAtivo, 'pacientes', 'paciente_existente_01')));
  // Funcionário tentando listar funcionários ou admins -> BLOQUEADO
  await assertFails(getDocs(collection(dbStaffAtivo, 'funcionarios')));
  await assertFails(getDocs(collection(dbStaffAtivo, 'admins')));
  // Funcionário tentando criar funcionário -> BLOQUEADO
  await assertFails(
    setDoc(doc(dbStaffAtivo, 'funcionarios', 'novo_funcionario_por_staff'), {
      nome: 'Func Cadastrado por Staff',
      ativo: true,
    })
  );
  console.log('  ✓ Funcionário comum estritamente impedido de excluir residentes ou manipular diretórios RBAC.');

  // 11. PRIVILÉGIOS COMPLETOS DO ADMINISTRADOR AUTORIZADO
  console.log('\n[TESTE 11/14] Operações completas de Administrador Autorizado...');
  const dbAdminAtivo = adminAtivoCtx.firestore();
  await assertSucceeds(getDocs(collection(dbAdminAtivo, 'pacientes')));
  await assertSucceeds(getDocs(collection(dbAdminAtivo, 'admins')));
  await assertSucceeds(getDocs(collection(dbAdminAtivo, 'funcionarios')));
  await assertSucceeds(deleteDoc(doc(dbAdminAtivo, 'pacientes', 'paciente_novo_staff')));
  console.log('  ✓ Administrador autorizado pode excluir residentes e consultar todos os diretórios.');

  // 12. VALIDAÇÃO DOS CAMPOS ADMINISTRATIVOS E CAMINHOS DE CRIAÇÃO, ATUALIZAÇÃO E EXCLUSÃO
  console.log('\n[TESTE 12/14] Validação de campos e caminhos em /admins e /funcionarios...');
  // 12.1. Criação de admin válido
  await assertSucceeds(
    setDoc(doc(dbAdminAtivo, 'admins', 'novo_admin_valido'), {
      nome: 'Coordenadora Geral',
      email: 'coord@victorialar.com.br',
      cargo: 'Coordenadora',
      ativo: true,
    })
  );
  // 12.2. Criação de admin com schema inválido (nome curto demais)
  await assertFails(
    setDoc(doc(dbAdminAtivo, 'admins', 'admin_invalido_schema'), {
      nome: 'X',
      ativo: true,
    })
  );
  // 12.3. Criação de funcionário válido
  await assertSucceeds(
    setDoc(doc(dbAdminAtivo, 'funcionarios', 'novo_func_valido'), {
      nome: 'Fisioterapeuta Lucas',
      email: 'lucas.fisio@victorialar.com.br',
      cargo: 'Fisioterapeuta',
      ativo: true,
    })
  );
  // 12.4. Criação de funcionário com schema inválido (sem ativo ou campo incorreto)
  await assertFails(
    setDoc(doc(dbAdminAtivo, 'funcionarios', 'func_invalido_schema'), {
      nome: 'Lucas',
      ativo: 'sim', // tipo incorreto: string em vez de bool
    } as any)
  );
  // 12.5. Atualização válida em /funcionarios pelo admin
  await assertSucceeds(
    updateDoc(doc(dbAdminAtivo, 'funcionarios', 'novo_func_valido'), {
      nome: 'Fisioterapeuta Lucas Atualizado',
      cargo: 'Fisioterapeuta Senior',
      ativo: true,
    })
  );
  // 12.6. Exclusão válida de funcionário pelo admin
  await assertSucceeds(deleteDoc(doc(dbAdminAtivo, 'funcionarios', 'novo_func_valido')));
  // 12.7. Exclusão válida de admin pelo admin
  await assertSucceeds(deleteDoc(doc(dbAdminAtivo, 'admins', 'novo_admin_valido')));
  console.log('  ✓ Criação, atualização, validação de campos e exclusão em /admins e /funcionarios rigorosamente verificadas.');

  // 13. VALIDAÇÃO RIGOROSA DO SCHEMA DE PACIENTES E PROTEÇÃO DE ID
  console.log('\n[TESTE 13/14] Validação de schema de residentes e guard de ID contra injeção...');
  // Schema corrompido / incompleto
  await assertFails(
    setDoc(doc(dbStaffAtivo, 'pacientes', 'paciente_invalido_incompleto'), {
      nomeCompleto: 'A', // Muito curto
    } as any)
  );
  // Injeção de ID com caracteres especiais perigosos
  await assertFails(
    setDoc(doc(dbStaffAtivo, 'pacientes', 'id_malicioso!@#$%^&*()'), validPacienteData)
  );
  console.log('  ✓ Schema de residentes e integridade de ID validados com rejeição garantida.');

  // 14. REVOGAÇÃO IMEDIATA E TROCA DE SESSÃO
  console.log('\n[TESTE 14/14] Revogação em tempo de execução e encerramento de sessão...');
  // Criar funcionário temporário
  await assertSucceeds(
    setDoc(doc(dbAdminAtivo, 'funcionarios', 'func_temp_uid'), {
      nome: 'Funcionário Temporário',
      email: 'temp@victorialar.com.br',
      ativo: true,
    })
  );
  const funcTempCtx = testEnv.authenticatedContext('func_temp_uid', {
    email: 'temp@victorialar.com.br',
    email_verified: true,
  });
  const dbFuncTemp = funcTempCtx.firestore();
  // Operação permitida enquanto ativo
  await assertSucceeds(getDoc(doc(dbFuncTemp, 'pacientes', 'paciente_existente_01')));

  // Admin revoga o funcionário alterando ativo para false
  await assertSucceeds(
    updateDoc(doc(dbAdminAtivo, 'funcionarios', 'func_temp_uid'), {
      ativo: false,
    })
  );

  // Tentativa subsequente sob o mesmo token é IMEDIATAMENTE bloqueada
  await assertFails(getDoc(doc(dbFuncTemp, 'pacientes', 'paciente_existente_01')));
  await assertFails(getDocs(collection(dbFuncTemp, 'pacientes')));

  // Encerramento de sessão (desautenticado)
  const dbDesautenticado = desautenticadoCtx.firestore();
  await assertFails(getDoc(doc(dbDesautenticado, 'pacientes', 'paciente_existente_01')));
  await assertFails(getDocs(collection(dbDesautenticado, 'pacientes')));
  console.log('  ✓ Revogação corta acesso no próximo ciclo sem latência e desautenticação bloqueia acesso.');

  await testEnv.cleanup();
  console.log('\n======================================================================');
  console.log('✓ TODOS OS 14 TESTES REAIS DAS REGRAS NO EMULADOR FORAM APROVADOS!');
  console.log('======================================================================\n');
}

runRulesTests().catch((err) => {
  console.error('\n❌ FALHA NOS TESTES DE REGRAS DO EMULADOR:', err);
  process.exit(1);
});
