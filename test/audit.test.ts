import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import {
  validateFirebaseEnvironment,
  formatFirestoreError,
  TARGET_FIREBASE_PROJECT_ID,
} from '../src/lib/firebase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- INICIANDO SUÍTE DE TESTES E AUDITORIA ESTRUTURAL ---');

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

// 2. AUDITORIA DO PROJETO ALVO
console.log('\n[TESTE 2] Validação do projeto oficial Firebase...');
assert.strictEqual(TARGET_FIREBASE_PROJECT_ID, 'victoria-lar-residencial');
console.log(`✓ PASSOU: Projeto configurado é "${TARGET_FIREBASE_PROJECT_ID}"`);

// 3. AUDITORIA DE REGRAS DE SEGURANÇA
console.log('\n[TESTE 3] Auditoria das Regras de Segurança do Firestore (firestore.rules)...');
const rulesPath = path.resolve(__dirname, '../firestore.rules');
assert(fs.existsSync(rulesPath), 'firestore.rules deve existir.');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

assert(
  !rulesContent.includes('allow read, write: if true;'),
  'Regras NUNCA devem conter "allow read, write: if true;"'
);
assert(
  rulesContent.includes('match /{document=**} {\n      allow read, write: if false;\n    }') ||
  rulesContent.includes('allow read, write: if false;'),
  'Regras devem conter catch-all default deny.'
);
assert(
  rulesContent.includes('isAuthorizedStaff()') || rulesContent.includes('isAdmin()'),
  'Regras devem verificar autorização explícita para acesso a residentes.'
);
console.log('✓ PASSOU: Regras de segurança auditadas. Sem brechas públicas.');

// 4. TRATAMENTO DE ERROS SEM VAZAMENTO DE CREDENCIAIS
console.log('\n[TESTE 4] Teste do formatador centralizado de erros do Firestore...');
const permissionError = formatFirestoreError(
  { code: 'permission-denied', message: 'Missing or insufficient permissions' },
  'consultar residentes'
);
assert(permissionError.message.includes('Permissão negada'), 'Deve retornar mensagem descritiva em português');
assert(!permissionError.message.includes('AIza'), 'Nunca deve vazar tokens ou chaves');

const offlineError = formatFirestoreError(
  { code: 'unavailable', message: 'The client is offline' },
  'gravar residente'
);
assert(offlineError.message.includes('indisponível'), 'Deve identificar erro de conexão');
console.log('✓ PASSOU: Tratamento de erros seguro e sem vazamento de segredos.');

// 5. TESTE DE VALIDAÇÃO DE AMBIENTE
console.log('\n[TESTE 5] Teste de validação das variáveis de ambiente...');
const validation = validateFirebaseEnvironment();
console.log(`Validação das variáveis de ambiente em tempo de execução: isValid = ${validation.isValid}`);
if (!validation.isValid) {
  console.log(`Variáveis pendentes nos Secrets: ${validation.missingVars.join(', ')}`);
  assert(validation.missingVars.length > 0);
} else {
  assert(validation.config !== null);
  assert.strictEqual(validation.config?.projectId, TARGET_FIREBASE_PROJECT_ID);
  console.log(`Configuração ativa para o projeto: ${validation.config?.projectId}`);
}
console.log('✓ PASSOU: Validação de variáveis obrigatórias operacional.');

console.log('\n======================================================');
console.log('✓ TODOS OS 5 TESTES DE AUDITORIA FORAM APROVADOS COM SUCESSO!');
console.log('======================================================\n');
