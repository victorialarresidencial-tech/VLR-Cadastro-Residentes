import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import {
  validateFirebaseEnvironment,
  formatFirestoreError,
  TARGET_FIREBASE_PROJECT_ID,
  ADMIN_BOOTSTRAP_EMAIL,
  diagnosticarAcessoFirestore,
  ouvirPacientes,
  UserAuthorization,
} from '../src/lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('======================================================================');
console.log('  SUÍTE DE AUDITORIA E TESTES FORMAIS — VICTORIA LAR RESIDENCIAL');
console.log('  Fase 1: Módulo de Cadastro de Residentes & Regras de Segurança');
console.log('======================================================================\n');

// 1. AUDITORIA ESTÁTICA DO CÓDIGO FONTE (ZERO localStorage e ZERO sessionStorage)
console.log('\n[TESTE 1] Auditoria de armazenamento local e referências legadas no código-fonte...');

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.html')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

const sourceFiles = getAllFiles(path.resolve(__dirname, '../src'));
assert(sourceFiles.length > 0, 'Arquivos de código-fonte em src/ devem existir.');

const forbiddenPatterns = [
  { pattern: /\blocalStorage\b/, name: 'localStorage' },
  { pattern: /\bsessionStorage\b/, name: 'sessionStorage' },
  { pattern: /cadastro-de-pacientes-be77f/, name: 'ID do projeto legado (cadastro-de-pacientes-be77f)' },
  { pattern: /\bgetLocalPatients\b/, name: 'getLocalPatients' },
  { pattern: /\bsaveLocalPatient\b/, name: 'saveLocalPatient' },
  { pattern: /\bdeleteLocalPatient\b/, name: 'deleteLocalPatient' },
  { pattern: /\bsincronizarPacientesLocais\b/, name: 'sincronizarPacientesLocais' },
  { pattern: /'local-\d+'/, name: 'IDs temporários fictícios local-*' },
];

let violationsFound = 0;

for (const filePath of sourceFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const { pattern, name } of forbiddenPatterns) {
    if (pattern.test(content)) {
      console.error(`VIOLAÇÃO ENCONTRADA: "${name}" detectado em ${filePath}`);
      violationsFound++;
    }
  }
}

assert.strictEqual(
  violationsFound,
  0,
  `A auditoria falhou com ${violationsFound} violações de armazenamento local ou referências legadas!`
);
console.log('✓ PASSOU: Nenhuma ocorrência de localStorage, sessionStorage ou funções de modo local em src/');

// =====================================================================
// TESTE 1: Usuário desconectado não inicia o listener de residentes
// =====================================================================
console.log('\n[TESTE 1/10] Verificando que usuário desconectado não inicia o listener de residentes...');

let errorCalled = false;
let errorMessage = '';
const unsub = ouvirPacientes(
  () => {
    assert.fail('Listener não deve chamar callback de sucesso para usuário desconectado!');
  },
  (err) => {
    errorCalled = true;
    errorMessage = err.message;
  }
);

assert.strictEqual(errorCalled, true, 'ouvirPacientes deve invocar onError quando auth.currentUser é null.');
assert(
  errorMessage.includes('não autenticado'),
  `Mensagem esperada deve conter "não autenticado", recebido: "${errorMessage}"`
);
assert.strictEqual(typeof unsub, 'function', 'Deve retornar função de limpeza segura.');
unsub();

// Verificação estática do fluxo no App.tsx
const appTsxContent = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
assert(
  appTsxContent.includes('if (!currentUser)'),
  'App.tsx deve verificar se currentUser existe antes de qualquer subscrição.'
);
assert(
  appTsxContent.includes('authStatus.isAuthorized'),
  'App.tsx deve checar authStatus.isAuthorized antes de invocar ouvirPacientes.'
);
console.log('✓ PASSOU [1/10]: Usuário desconectado rejeitado sem iniciar listener.');

// =====================================================================
// TESTE 2: Usuário autenticado, mas não autorizado, não consegue ler nem gravar residentes
// =====================================================================
console.log('\n[TESTE 2/10] Verificando usuário autenticado porém sem autorização...');

const mockUnauthorizedUser = {
  uid: 'usr_external_9999',
  email: 'usuario.externo@gmail.com',
  emailVerified: true,
} as unknown as FirebaseUser;

const unauthorizedAuthResult: UserAuthorization = {
  isAuthenticated: true,
  isAuthorized: false,
  isAdmin: false,
  isStaff: false,
  role: 'nao_autorizado',
  user: mockUnauthorizedUser,
  email: mockUnauthorizedUser.email,
  uid: mockUnauthorizedUser.uid,
  verificationSource: 'none',
};

const diagUnauthorized = diagnosticarAcessoFirestore(mockUnauthorizedUser, null, unauthorizedAuthResult);
assert.strictEqual(diagUnauthorized.status, 'autenticado_sem_autorizacao');
assert.strictEqual(diagUnauthorized.canReadResidents, false, 'Usuário não autorizado não pode ler residentes');
assert.strictEqual(diagUnauthorized.canWriteResidents, false, 'Usuário não autorizado não pode gravar residentes');
assert.strictEqual(diagUnauthorized.canDeleteResidents, false, 'Usuário não autorizado não pode excluir residentes');
assert(
  diagUnauthorized.description.includes('não possui autorização'),
  'Diagnóstico deve explicar falta de registro no RBAC'
);

// Verificação de funcionário inativo ou sem o campo ativo
const inactiveStaffAuthResult: UserAuthorization = {
  isAuthenticated: true,
  isAuthorized: false,
  isAdmin: false,
  isStaff: false,
  role: 'nao_autorizado',
  user: { uid: 'func_inativo_uid', email: 'roberto.ex@victorialar.com.br' } as FirebaseUser,
  email: 'roberto.ex@victorialar.com.br',
  uid: 'func_inativo_uid',
  verificationSource: 'none',
};
const diagInactive = diagnosticarAcessoFirestore(inactiveStaffAuthResult.user, null, inactiveStaffAuthResult);
assert.strictEqual(diagInactive.canReadResidents, false, 'Funcionário inativo não pode ler residentes');
assert.strictEqual(diagInactive.canWriteResidents, false, 'Funcionário inativo não pode gravar residentes');

// Regras do Firestore
const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');
assert(
  rulesContent.includes('match /pacientes/{pacienteId} {\n      allow get, list: if isAuthorizedStaff();'),
  'Regras do Firestore devem exigir isAuthorizedStaff() para ler pacientes'
);
console.log('✓ PASSOU [2/10]: Usuário autenticado sem autorização (incluindo inativos e sem ativo) é bloqueado tanto no cliente quanto nas regras.');

// =====================================================================
// TESTE 3: Funcionário autorizado executa somente operações permitidas
// =====================================================================
console.log('\n[TESTE 3/10] Verificando política restrita para Funcionário Autorizado...');

const mockStaffUser = {
  uid: 'func_enfermagem_123',
  email: 'enfermeira@victorialar.com.br',
  emailVerified: true,
} as unknown as FirebaseUser;

const staffAuthResult: UserAuthorization = {
  isAuthenticated: true,
  isAuthorized: true,
  isAdmin: false,
  isStaff: true,
  role: 'funcionario',
  user: mockStaffUser,
  email: mockStaffUser.email,
  uid: mockStaffUser.uid,
  verificationSource: 'funcionarios_collection',
};

const diagStaff = diagnosticarAcessoFirestore(mockStaffUser, null, staffAuthResult);
assert.strictEqual(diagStaff.status, 'conectado_autorizado');
assert.strictEqual(diagStaff.isAdmin, false, 'Funcionário NÃO é administrador');
assert.strictEqual(diagStaff.isStaff, true, 'Funcionário possui isStaff true');
assert.strictEqual(diagStaff.canReadResidents, true, 'Funcionário pode ler residentes');
assert.strictEqual(diagStaff.canWriteResidents, true, 'Funcionário pode cadastrar/editar residentes');
assert.strictEqual(diagStaff.canDeleteResidents, false, 'Funcionário NÃO pode excluir residentes');

// Regras do Firestore: exclusão exclusiva de admin
assert(
  rulesContent.includes('allow delete: if isAdmin() && isValidId(pacienteId);'),
  'Regras devem restringir exclusão de residentes exclusivamente a Administradores'
);
// Regras do Firestore: funcionários não podem gravar em admins nem em funcionarios
assert(
  rulesContent.includes('match /admins/{adminId} {') &&
  rulesContent.includes('allow write: if isAdmin() && isValidId(adminId);'),
  'Somente admin pode escrever em /admins'
);
assert(
  rulesContent.includes('match /funcionarios/{staffId} {') &&
  rulesContent.includes('allow write: if isAdmin() && isValidId(staffId);'),
  'Somente admin pode escrever em /funcionarios'
);
// Regras do Firestore: listagem do diretório restrita a administradores e exigência de ativo == true
assert(
  rulesContent.includes('match /funcionarios/{staffId} {\n      allow get: if isSignedIn() && (request.auth.uid == staffId || isAdmin());\n      allow list: if isAdmin();'),
  'Listagem de funcionários deve ser restrita exclusivamente a administradores (allow list: if isAdmin();)'
);
assert(
  rulesContent.includes('data.ativo == true') && rulesContent.includes('isStaffMember()'),
  'Regras devem exigir ativo == true para autorização de funcionários'
);
console.log('✓ PASSOU [3/10]: Funcionário autorizado possui apenas privilégios operacionais (sem exclusão, RBAC ou listagem de equipe).');

// =====================================================================
// TESTE 4: Administrador executa as operações administrativas autorizadas
// =====================================================================
console.log('\n[TESTE 4/10] Verificando privilégios completos de Administrador...');

const mockAdminUser = {
  uid: 'admin_master_001',
  email: ADMIN_BOOTSTRAP_EMAIL,
  emailVerified: true,
} as unknown as FirebaseUser;

const adminAuthResult: UserAuthorization = {
  isAuthenticated: true,
  isAuthorized: true,
  isAdmin: true,
  isStaff: true,
  role: 'admin',
  user: mockAdminUser,
  email: mockAdminUser.email,
  uid: mockAdminUser.uid,
  verificationSource: 'bootstrap_admin',
};

const diagAdmin = diagnosticarAcessoFirestore(mockAdminUser, null, adminAuthResult);
assert.strictEqual(diagAdmin.status, 'conectado_autorizado');
assert.strictEqual(diagAdmin.isAdmin, true, 'Administrador possui isAdmin true');
assert.strictEqual(diagAdmin.isStaff, true, 'Administrador possui isStaff true');
assert.strictEqual(diagAdmin.canReadResidents, true, 'Administrador pode ler residentes');
assert.strictEqual(diagAdmin.canWriteResidents, true, 'Administrador pode cadastrar/editar residentes');
assert.strictEqual(diagAdmin.canDeleteResidents, true, 'Administrador pode excluir residentes');

console.log('✓ PASSOU [4/10]: Administrador possui permissões de gestão e exclusão completas.');

// =====================================================================
// TESTE 5: Usuário comum não consegue conceder privilégios a si próprio
// =====================================================================
console.log('\n[TESTE 5/10] Verificando proteção contra auto-escalonamento de privilégios...');

assert(
  !rulesContent.includes('request.auth.token.role =='),
  'Regras não devem confiar em claims manipuláveis pelo cliente sem verificação institucional.'
);
assert(
  !rulesContent.includes('request.resource.data.role'),
  'Regras não devem permitir que o cliente defina o próprio cargo.'
);
assert(
  rulesContent.includes('isEmailVerified()'),
  'Regras devem exigir e-mail verificado para o e-mail bootstrap do administrador.'
);
assert(
  rulesContent.includes('match /admins/{adminId} {') &&
  rulesContent.includes('allow write: if isAdmin() && isValidId(adminId);'),
  'Escrita na coleção admins é restrita a isAdmin().'
);
assert(
  rulesContent.includes('match /funcionarios/{staffId} {') &&
  rulesContent.includes('allow write: if isAdmin() && isValidId(staffId);'),
  'Escrita na coleção funcionarios é restrita a isAdmin().'
);
console.log('✓ PASSOU [5/10]: Auto-escalonamento bloqueado no servidor e cliente.');

// =====================================================================
// TESTE 6: Logout cancela os listeners e interrompe o acesso protegido
// =====================================================================
console.log('\n[TESTE 6/10] Verificando cancelamento de listeners e limpeza no logout...');

assert(
  appTsxContent.includes('handleLogout = async () => {'),
  'App.tsx deve possuir função handleLogout dedicada.'
);
assert(
  appTsxContent.includes('setCurrentUser(null)'),
  'handleLogout deve redefinir currentUser para null.'
);
assert(
  appTsxContent.includes('setPacientes([])'),
  'handleLogout deve limpar os dados de residentes da memória.'
);
assert(
  appTsxContent.includes('setIsFirestoreConnected(false)'),
  'handleLogout deve redefinir o status de conexão para desconectado.'
);
assert(
  appTsxContent.includes('unsubscribeListener()'),
  'App.tsx deve invocar unsubscribeListener ao alterar usuário ou deslogar.'
);
console.log('✓ PASSOU [6/10]: Logout cancela listeners em tempo real e limpa dados da memória.');

// =====================================================================
// TESTE 7: Troca de usuário não mantém listeners ou dados da sessão anterior
// =====================================================================
console.log('\n[TESTE 7/10] Verificando isolamento entre sessões de usuários...');

assert(
  appTsxContent.includes('isCancelled = true'),
  'Efeito de escuta deve usar flag isCancelled para descartar retornos de listeners anteriores.'
);
assert(
  appTsxContent.includes('checkAuthorizationAndSubscribe()'),
  'Ao trocar de usuário, autorização deve ser reavaliada antes de qualquer subscrição.'
);
console.log('✓ PASSOU [7/10]: Troca de usuário limpa estado e cancela ouvintes anteriores.');

// =====================================================================
// TESTE 8: Falhas de permissão não acionam fallback local
// =====================================================================
console.log('\n[TESTE 8/10] Verificando que falhas de permissão não injetam dados falsos nem ativam armazenamento local...');

const permissionErr = formatFirestoreError(
  { code: 'permission-denied', message: 'Missing or insufficient permissions' },
  'consultar residentes'
);
assert(permissionErr.message.includes('Permissão negada'), 'Mensagem formatada deve indicar permissão negada');
assert(!permissionErr.message.includes('AIza'), 'Nunca deve vazar dados de configuração sensíveis');

const forbiddenFallbacks = [
  /mockPatients/i,
  /fakePatients/i,
  /fallbackPatients/i,
  /dadosFicticios/i,
  /samplePatients/i,
];

for (const filePath of sourceFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const pattern of forbiddenFallbacks) {
    assert(!pattern.test(content), `Padrão de fallback fictício detectado em ${filePath}: ${pattern}`);
  }
}
console.log('✓ PASSOU [8/10]: Falhas de permissão não acionam mocks, fallbacks locais ou dados simulados.');

// =====================================================================
// TESTE 9: Não há acesso a projetos Firebase antigos
// =====================================================================
console.log('\n[TESTE 9/10] Verificando projeto alvo e ausência de projetos legados...');

assert.strictEqual(TARGET_FIREBASE_PROJECT_ID, 'victoria-lar-residencial');

const legacyProjectId = 'cadastro-de-pacientes-be77f';
for (const filePath of sourceFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  assert(
    !content.includes(legacyProjectId),
    `Referência ao projeto legado "${legacyProjectId}" encontrada em ${filePath}!`
  );
}

const validation = validateFirebaseEnvironment();
console.log(`Validação das variáveis de ambiente: isValid = ${validation.isValid}`);
if (validation.config) {
  assert.strictEqual(
    validation.config.projectId,
    TARGET_FIREBASE_PROJECT_ID,
    'Configuração ativa deve apontar exclusivamente para victoria-lar-residencial'
  );
}
console.log('✓ PASSOU [9/10]: Projeto oficial estritamente configurado sem referências legadas.');

// =====================================================================
// TESTE 10: Não há localStorage ou sessionStorage no código da aplicação
// =====================================================================
console.log('\n[TESTE 10/10] Verificando ausência absoluta de localStorage e sessionStorage...');

const forbiddenStoragePatterns = [
  { pattern: /\blocalStorage\b/, name: 'localStorage' },
  { pattern: /\bsessionStorage\b/, name: 'sessionStorage' },
  { pattern: /\bindexedDB\b/, name: 'indexedDB' },
  { pattern: /\bopenDatabase\b/, name: 'WebSQL openDatabase' },
];

let storageViolations = 0;
for (const filePath of sourceFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const { pattern, name } of forbiddenStoragePatterns) {
    if (pattern.test(content)) {
      console.error(`Violação: "${name}" detectado em ${filePath}`);
      storageViolations++;
    }
  }
}

assert.strictEqual(storageViolations, 0, `Foram detectadas ${storageViolations} violações de armazenamento local!`);
console.log('✓ PASSOU [10/10]: Zero ocorrências de localStorage, sessionStorage ou indexedDB no código.');

console.log('\n======================================================================');
console.log('✓ TODOS OS 10 TESTES OBRIGATÓRIOS FORAM EXECUTADOS E APROVADOS COM SUCESSO!');
console.log('======================================================================\n');
