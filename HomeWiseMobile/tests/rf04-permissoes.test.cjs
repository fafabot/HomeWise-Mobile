const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function carregarModuloTs(caminhoRelativo) {
  const caminhoArquivo = path.join(__dirname, '..', caminhoRelativo);
  const codigoTs = fs.readFileSync(caminhoArquivo, 'utf8');
  const codigoJs = ts.transpileModule(codigoTs, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const modulo = { exports: {} };
  const dir = path.dirname(caminhoArquivo);
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', codigoJs);
  fn(modulo.exports, require, modulo, caminhoArquivo, dir);
  return modulo.exports;
}

const {
  obterPerfilAcesso,
  temPermissaoAdmin,
  rotuloPerfilAcesso,
  obterParametrosCalibracaoHardware,
} = carregarModuloTs('src/utils/permissoes.ts');

test('RF04 - distingue perfis de Morador, Administrador e Suporte Técnico com padrão seguro', () => {
  assert.equal(obterPerfilAcesso(null), 'morador');
  assert.equal(obterPerfilAcesso({}), 'morador');
  assert.equal(obterPerfilAcesso({ perfil_acesso: 'morador' }), 'morador');
  assert.equal(obterPerfilAcesso({ perfil_acesso: 'admin' }), 'admin');
  assert.equal(obterPerfilAcesso({ perfil_acesso: 'suporte' }), 'suporte');

  assert.equal(rotuloPerfilAcesso({ perfil_acesso: 'morador' }), 'Morador');
  assert.equal(rotuloPerfilAcesso({ perfil_acesso: 'admin' }), 'Administrador');
  assert.equal(rotuloPerfilAcesso({ perfil_acesso: 'suporte' }), 'Suporte Técnico');
});

test('RF04 - restringe permissão administrativa apenas aos perfis Admin e Suporte Técnico', () => {
  assert.equal(temPermissaoAdmin(null), false);
  assert.equal(temPermissaoAdmin({ perfil_acesso: 'morador' }), false);
  assert.equal(temPermissaoAdmin({ perfil_acesso: 'admin' }), true);
  assert.equal(temPermissaoAdmin({ perfil_acesso: 'suporte' }), true);
});

test('RF04 - fornece parâmetros técnicos de calibração do hardware da Central HomeWise', () => {
  const parametros = obterParametrosCalibracaoHardware();
  assert.ok(Array.isArray(parametros) && parametros.length >= 4);
  assert.ok(parametros.some((p) => p.valor.includes('402,5 pulsos/L')));
  assert.ok(parametros.some((p) => p.valor.includes('UART 9600 bps')));
});
