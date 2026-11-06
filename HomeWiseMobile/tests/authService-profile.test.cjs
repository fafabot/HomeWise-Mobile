const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// No Firebase SDK/config is loaded. Missing imports and destructive operations fail.
function harness() {
  const documents = new Map();
  const calls = { create: 0, update: 0, writes: 0, transactions: 0, deleted: 0 };
  const faults = { create: null, update: null, write: null, read: null, retry: false, afterUpdate: null };
  const user = { uid: 'synthetic-user', email: 'synthetic@example.invalid', displayName: null };
  const auth = { currentUser: null };
  function deepMerge(base, patch) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      merged[key] = value && typeof value === 'object' && !(value instanceof Date) &&
        Object.getPrototypeOf(value)?.constructor?.name === 'Object'
        ? deepMerge(base?.[key] || {}, value) : value;
    }
    return merged;
  }
  const snapshot = ref => {
    if (faults.read) throw faults.read;
    return { exists: () => documents.has(ref.uid), data: () => documents.get(ref.uid) };
  };
  const write = (ref, data, options) => {
    if (faults.write) throw faults.write;
    assert.equal(options.merge, true);
    calls.writes++;
    documents.set(ref.uid, deepMerge(documents.get(ref.uid) || {}, data));
  };
  const dependencies = {
    './firebase': { auth, db: { synthetic: true } },
    'firebase/auth': {
      createUserWithEmailAndPassword: async () => {
        calls.create++;
        if (faults.create) throw faults.create;
        auth.currentUser = user;
        return { user };
      },
      updateProfile: async (target, patch) => {
        calls.update++;
        if (faults.update) throw faults.update;
        Object.assign(target, patch);
        faults.afterUpdate?.();
      },
      deleteUser: () => { calls.deleted++; assert.fail('No account deletion permitted'); },
    },
    'firebase/firestore': {
      doc: (_db, collection, uid) => { assert.equal(collection, 'usuarios'); return { uid }; },
      getDoc: async ref => snapshot(ref),
      setDoc: async (ref, data, options) => write(ref, data, options),
      deleteDoc: () => { calls.deleted++; assert.fail('No document deletion permitted'); },
      runTransaction: async (_db, callback) => {
        calls.transactions++;
        const invoke = async (commit) => {
          const pending = [];
          const result = await callback({
            get: async ref => snapshot(ref),
            set: (ref, data, options) => pending.push([ref, data, options]),
          });
          if (commit) for (const args of pending) write(...args);
          return result;
        };
        if (faults.retry) await invoke(false);
        return invoke(true);
      },
    },
  };
  const filename = path.join(__dirname, '../src/services/authService.ts');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, Date, console: { warn() {} },
    require: name => { assert.ok(Object.hasOwn(dependencies, name), `Blocked import: ${name}`); return dependencies[name]; },
  }, { filename });
  return { service: module.exports, auth, user, documents, calls, faults };
}

const failure = code => Object.assign(new Error('synthetic persistence error'), { code });

test('cadastro: falha no Firestore nunca é sucesso completo e preserva causa/UID', async () => {
  const h = harness();
  h.faults.write = failure('permission-denied');
  const result = await h.service.cadastrarUsuario(h.user.email, 'synthetic-password', 'Pessoa Teste');
  assert.equal(result.sucesso, false);
  assert.equal(result.estado, 'parcial');
  assert.equal(result.causa, h.faults.write);
  assert.equal(result.codigo, 'permission-denied');
  assert.equal(result.usuario.uid, h.user.uid);
  assert.equal(h.calls.create, 1);
});

test('edição: falha no Firestore nunca informa que todas as alterações foram salvas', async () => {
  const h = harness(); h.auth.currentUser = h.user;
  h.faults.write = failure('unavailable');
  const result = await h.service.atualizarPerfilUsuario('Novo Nome', { telefone: '1100000000' });
  assert.equal(result.sucesso, false);
  assert.equal(result.estado, 'parcial');
  assert.equal(result.causa, h.faults.write);
  assert.equal(h.user.displayName, 'Novo Nome');
});

test('cadastro completo confirma conta, Auth e Firestore', async () => {
  const h = harness();
  const result = await h.service.cadastrarUsuario(' Synthetic@Example.Invalid ', 'synthetic-password', ' Pessoa Teste ', ' central-sintetica ');
  assert.equal(result.sucesso, true);
  assert.equal(result.estado, 'completo');
  assert.equal(result.etapas.conta, 'criada');
  assert.equal(result.etapas.auth, 'confirmado');
  assert.equal(result.etapas.firestore, 'confirmado');
  assert.equal(h.documents.get(h.user.uid).nome, 'Pessoa Teste');
  assert.equal(h.documents.get(h.user.uid).email, 'synthetic@example.invalid');
  assert.equal(h.documents.get(h.user.uid).dispositivo_id, 'central-sintetica');
  assert.equal(h.calls.create, 1);
  assert.equal(h.calls.writes, 1);
  assert.equal(h.calls.deleted, 0);
});

test('falha ao criar conta não executa updateProfile nem gravação de perfil', async () => {
  const h = harness(); h.faults.create = failure('auth/weak-password');
  const result = await h.service.cadastrarUsuario(h.user.email, 'synthetic-password');
  assert.equal(result.estado, 'falha');
  assert.equal(result.sucesso, false);
  assert.equal(result.etapas.conta, 'nao-confirmada');
  assert.equal(result.causa, h.faults.create);
  assert.equal(h.calls.update, 0);
  assert.equal(h.calls.writes, 0);
});

test('conta criada com falha no Auth é parcial e recuperável, sem exclusão automática', async () => {
  const h = harness(); h.faults.update = failure('auth/network-request-failed');
  const result = await h.service.cadastrarUsuario(h.user.email, 'synthetic-password', 'Pessoa');
  assert.equal(result.sucesso, false);
  assert.equal(result.estado, 'parcial');
  assert.equal(result.etapas.conta, 'criada');
  assert.equal(result.etapas.auth, 'nao-confirmado');
  assert.equal(result.etapas.firestore, 'nao-executado');
  assert.equal(result.causa, h.faults.update);
  assert.equal(result.recuperavel, true);
  assert.equal(h.calls.writes, 0);
  assert.equal(h.auth.currentUser.uid, h.user.uid);
  assert.equal(h.calls.deleted, 0);
});

test('edição: falha no Auth não persiste campos nem promete rollback', async () => {
  const h = harness(); h.auth.currentUser = h.user;
  h.faults.update = failure('auth/requires-recent-login');
  const result = await h.service.atualizarPerfilUsuario('Pessoa');
  assert.equal(result.estado, 'falha');
  assert.equal(result.etapas.firestore, 'nao-executado');
  assert.equal(result.causa, h.faults.update);
  assert.equal(h.calls.writes, 0);
});

test('retorno detalhado preserva objeto/código e wrapper booleano permanece compatível', async () => {
  const h = harness(); h.faults.write = failure('permission-denied');
  const detailed = await h.service.salvarPerfilFirestoreDetalhado(h.user.uid, { telefone: '1100000000' });
  assert.equal(detailed.sucesso, false);
  assert.equal(detailed.causa, h.faults.write);
  assert.equal(detailed.codigo, 'permission-denied');
  assert.equal(await h.service.salvarPerfilFirestore(h.user.uid, {}), false);
  h.faults.write = null;
  assert.equal(await h.service.salvarPerfilFirestore(h.user.uid, {}), true);
});

test('recuperação após falha do cadastro usa o mesmo UID e nunca cria outra conta', async () => {
  const h = harness(); h.faults.write = failure('unavailable');
  await h.service.cadastrarUsuario(h.user.email, 'synthetic-password', 'Pessoa Teste');
  h.faults.write = null;
  const result = await h.service.recuperarPerfilIncompleto();
  assert.equal(result.sucesso, true);
  assert.equal(result.estado, 'completo');
  assert.equal(result.etapas.conta, 'existente');
  assert.equal(h.documents.get(h.user.uid).nome, 'Pessoa Teste');
  assert.equal(h.documents.size, 1);
  assert.equal(h.calls.create, 1);
  assert.equal(h.calls.deleted, 0);
});

test('repetir recuperação preserva timestamps e não regrava documento completo', async () => {
  const h = harness(); h.auth.currentUser = h.user;
  await h.service.recuperarPerfilIncompleto({ nome: 'Pessoa Teste', dispositivo_id: 'central-a' });
  const first = h.documents.get(h.user.uid);
  const writes = h.calls.writes;
  const result = await h.service.recuperarPerfilIncompleto({ nome: 'Outro Nome', dispositivo_id: 'central-b' });
  assert.equal(result.sucesso, true);
  assert.equal(h.documents.size, 1);
  assert.equal(h.documents.get(h.user.uid), first);
  assert.equal(h.calls.writes, writes);
  assert.equal(h.calls.create, 0);
  assert.equal(h.user.displayName, 'Pessoa Teste');
  assert.equal(first.dispositivo_id, 'central-a');
});

test('recuperação preenche somente campos ausentes e preserva plano, foto, metas e endereço', async () => {
  const h = harness(); h.auth.currentUser = h.user;
  const existing = { nome: 'Nome Salvo', plano: 'plus', foto_perfil: 'synthetic-photo',
    metas_consumo: { agua: 100, energia: 20 }, endereco_detalhado: { rua: 'Rua Sintética', bairro: 'Teste' } };
  h.documents.set(h.user.uid, existing);
  const result = await h.service.recuperarPerfilIncompleto({ nome: 'Novo Nome' });
  assert.equal(result.sucesso, true);
  const saved = h.documents.get(h.user.uid);
  assert.equal(saved.nome, 'Nome Salvo');
  assert.equal(saved.plano, existing.plano);
  assert.equal(saved.foto_perfil, existing.foto_perfil);
  assert.deepEqual(saved.metas_consumo, existing.metas_consumo);
  assert.deepEqual(saved.endereco_detalhado, existing.endereco_detalhado);
  assert.equal(saved.uid, h.user.uid);
});

test('falha de leitura transacional não é confundida com perfil ausente', async () => {
  const h = harness(); h.auth.currentUser = h.user; h.faults.read = failure('permission-denied');
  const result = await h.service.recuperarPerfilIncompleto();
  assert.equal(result.sucesso, false);
  assert.equal(result.causa, h.faults.read);
  assert.equal(result.etapas.firestore, 'nao-confirmado');
  assert.equal(h.calls.writes, 0);
  assert.equal(h.calls.update, 0);
});

test('recuperação com gravação não confirmada preserva conta e causa', async () => {
  const h = harness(); h.auth.currentUser = h.user; h.faults.write = failure('unavailable');
  const result = await h.service.recuperarPerfilIncompleto({ nome: 'Pessoa' });
  assert.equal(result.sucesso, false);
  assert.equal(result.causa, h.faults.write);
  assert.equal(h.calls.create, 0);
  assert.equal(h.calls.deleted, 0);
  assert.equal(h.calls.update, 0);
});

test('recuperação com Firestore confirmado e falha no Auth é parcial; repetir conclui sem nova gravação', async () => {
  const h = harness(); h.auth.currentUser = h.user; h.faults.update = failure('auth/network-request-failed');
  const partial = await h.service.recuperarPerfilIncompleto({ nome: 'Pessoa' });
  assert.equal(partial.estado, 'parcial');
  assert.equal(partial.etapas.firestore, 'confirmado');
  assert.equal(partial.causa, h.faults.update);
  const writes = h.calls.writes;
  h.faults.update = null;
  assert.equal((await h.service.recuperarPerfilIncompleto()).sucesso, true);
  assert.equal(h.calls.writes, writes);
  assert.equal(h.calls.create, 0);
});

test('retry de transação não repete efeitos de Auth ou cria documentos extras', async () => {
  const h = harness(); h.auth.currentUser = h.user; h.faults.retry = true;
  assert.equal((await h.service.recuperarPerfilIncompleto({ nome: 'Pessoa' })).sucesso, true);
  assert.equal(h.calls.update, 1);
  assert.equal(h.calls.writes, 1);
  assert.equal(h.documents.size, 1);
  assert.equal(h.calls.create, 0);
});

test('edição preserva campos alheios e subcampos de endereço que não foram editados', async () => {
  const h = harness(); h.auth.currentUser = h.user;
  h.documents.set(h.user.uid, { nome: 'Antigo', uid: h.user.uid, plano: 'plus',
    foto_perfil: 'synthetic-photo', metas_consumo: { agua: 20 }, criado_em: 'original-date',
    endereco_detalhado: { rua: 'Original', bairro: 'Preservado', numero: '10' } });
  const result = await h.service.atualizarPerfilUsuario(' Novo Nome ', {
    telefone: ' 1100000000 ', endereco_detalhado: { rua: ' Rua Editada ' } });
  assert.equal(result.sucesso, true);
  const saved = h.documents.get(h.user.uid);
  assert.equal(saved.nome, 'Novo Nome');
  assert.equal(saved.telefone, '1100000000');
  assert.equal(saved.plano, 'plus');
  assert.equal(saved.foto_perfil, 'synthetic-photo');
  assert.equal(saved.criado_em, 'original-date');
  assert.equal(saved.metas_consumo.agua, 20);
  assert.equal(saved.endereco_detalhado.rua, 'Rua Editada');
  assert.equal(saved.endereco_detalhado.bairro, 'Preservado');
  assert.equal(saved.endereco_detalhado.numero, '10');
});

test('mapa vazio/undefined não limpa endereço ou campos existentes', async () => {
  const h = harness(); h.auth.currentUser = h.user;
  h.documents.set(h.user.uid, { telefone: 'original', endereco_detalhado: { rua: 'Preservada' } });
  assert.equal((await h.service.atualizarPerfilUsuario('Pessoa', { telefone: undefined, endereco_detalhado: {} })).sucesso, true);
  assert.equal(h.documents.get(h.user.uid).telefone, 'original');
  assert.equal(h.documents.get(h.user.uid).endereco_detalhado.rua, 'Preservada');
});

for (const field of ['uid', 'email', 'nome', 'plano', 'status_assinatura', 'foto_perfil', 'metas_consumo', 'perfil_acesso']) {
  test(`edição recusa campo fora do formulário: ${field}`, async () => {
    const h = harness(); h.auth.currentUser = h.user;
    const result = await h.service.atualizarPerfilUsuario('Pessoa', { [field]: 'unexpected' });
    assert.equal(result.sucesso, false);
    assert.equal(result.codigo, 'perfil/campo-nao-editavel');
    assert.equal(h.calls.update, 0);
    assert.equal(h.calls.writes, 0);
  });
}

test('recuperação/edição sem sessão não criam contas ou gravam dados', async () => {
  const h = harness();
  assert.equal((await h.service.recuperarPerfilIncompleto()).sucesso, false);
  assert.equal((await h.service.atualizarPerfilUsuario('Pessoa')).sucesso, false);
  assert.equal(h.calls.create, 0);
  assert.equal(h.calls.writes, 0);
});

test('troca de sessão após Auth interrompe edição sem escrever no UID de outra pessoa', async () => {
  const h = harness(); h.auth.currentUser = h.user;
  h.faults.afterUpdate = () => { h.auth.currentUser = { uid: 'different-user' }; };
  const result = await h.service.atualizarPerfilUsuario('Pessoa');
  assert.equal(result.sucesso, false);
  assert.equal(result.estado, 'parcial');
  assert.equal(result.codigo, 'perfil/sessao-alterada');
  assert.equal(h.calls.writes, 0);
});

test('recuperação não sobrescreve perfil com identidade incompatível', async () => {
  const h = harness(); h.auth.currentUser = h.user;
  const existing = { uid: 'different-user', plano: 'plus' };
  h.documents.set(h.user.uid, existing);
  const result = await h.service.recuperarPerfilIncompleto();
  assert.equal(result.sucesso, false);
  assert.equal(result.codigo, 'perfil/uid-incompativel');
  assert.equal(h.documents.get(h.user.uid), existing);
  assert.equal(h.calls.update, 0);
  assert.equal(h.calls.writes, 0);
});
