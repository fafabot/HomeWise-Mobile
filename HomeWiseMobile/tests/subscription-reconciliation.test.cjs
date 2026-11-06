const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load() {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/subscription-consistency.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  new Function('module', 'exports', js)(module, module.exports);
  return module.exports;
}
const timestamp = value => ({ toMillis: () => value });
const expected = { plano: 'plus', plano_nome: 'Plus', ciclo_assinatura: 'anual', status_assinatura: 'ativa' };
const operation = () => ({ id: 'op-confirmed', base: {}, patch: { ...expected }, confirmada: true, revisao: 100 });
const document = patch => ({ uid: 'synthetic', nome: 'Pessoa', email: 'synthetic@example.invalid', dispositivo_id: '',
  ...expected, assinatura_operacao_id: 'op-confirmed', assinatura_atualizada_em: timestamp(100), ...patch });

test('regression: legacy merge reuses metadata with different plan; neither version is silently confirmed', () => {
  const { conciliarAssinatura } = load(); const op = operation();
  const result = conciliarAssinatura(document({ plano: 'basico' }), op);
  assert.equal(op.inconsistente, true);
  assert.equal(result.plano, undefined);
  assert.equal(result.nome, 'Pessoa');
  assert.equal(op.patch.plano, 'plus', 'receipt is preserved as evidence, not shown as current truth');
});

for (const patch of [{ ciclo_assinatura: 'mensal' }, { status_assinatura: 'cancelada' }, { plano_nome: 'Different' }]) {
  test('same metadata with incompatible business content is unknown: ' + JSON.stringify(patch), () => {
    const { conciliarAssinatura } = load(); const op = operation();
    assert.equal(conciliarAssinatura(document(patch), op).plano, undefined); assert.equal(op.inconsistente, true);
    assert.equal(conciliarAssinatura(document({}), op).plano, undefined, 'ordinary listener cannot silently clear conflict');
  });
}
test('matching operation and full content remains confirmed', () => {
  const op = operation(); assert.equal(load().conciliarAssinatura(document({}), op).plano, 'plus');
  assert.notEqual(op.inconsistente, true);
});
test('explicit server query resolves only matching receipt or strictly newer valid operation', () => {
  const { conciliarAssinatura, resolverConsultaServidor } = load(); const op = operation();
  conciliarAssinatura(document({ plano: 'basico' }), op);
  assert.equal(resolverConsultaServidor(document({ plano: 'basico' }), op), false);
  assert.equal(op.inconsistente, true);
  assert.equal(resolverConsultaServidor(document({}), op), true); assert.equal(op.inconsistente, false);
  op.inconsistente = true;
  assert.equal(resolverConsultaServidor(document({ assinatura_operacao_id: 'newer', assinatura_atualizada_em: timestamp(200), plano: null, plano_nome: null, status_assinatura: 'cancelada' }), op), true);
  assert.equal(op.patch.plano, null);
});
for (const patch of [{ assinatura_operacao_id: 'other', assinatura_atualizada_em: timestamp(100) },
  { assinatura_operacao_id: 'other', assinatura_atualizada_em: timestamp(99) },
  { assinatura_operacao_id: 'other', assinatura_atualizada_em: timestamp(200), ciclo_assinatura: 'invalid' },
  { assinatura_operacao_id: 'other', assinatura_atualizada_em: timestamp(200), plano_nome: 'Wrong' },
  { assinatura_operacao_id: 'op-confirmed', assinatura_atualizada_em: timestamp(200) },
  { assinatura_atualizada_em: null }]) {
  test('ambiguous, reused, invalid or old server revision cannot resolve conflict ' + JSON.stringify(patch), () => {
    const op = operation(); op.inconsistente = true;
    assert.equal(load().resolverConsultaServidor(document(patch), op), false); assert.equal(op.inconsistente, true);
  });
}
test('legacy documents without metadata are readable when there is no prior receipt', () => {
  const legacy = { uid: 'old', nome: 'Old', plano: 'basico' };
  assert.equal(load().conciliarAssinatura(legacy, null), legacy);
});
test('explicit server confirmation after finished failed SDK acknowledgement releases the local pending lock', () => {
  const op = operation(); op.confirmada = false; op.finalizada = true; op.inconsistente = true;
  assert.equal(load().resolverConsultaServidor(document({}), op), true);
  assert.equal(op.confirmada, true); assert.equal(op.inconsistente, false);
});
