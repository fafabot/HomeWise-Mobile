const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function carregarModuloTs(caminhoRelativo, mocks = {}) {
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
  const requireCustom = (id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith('.')) {
      const resolvido = path.resolve(dir, id);
      if (fs.existsSync(resolvido + '.ts')) {
        const rel = path.relative(path.join(__dirname, '..'), resolvido + '.ts');
        return carregarModuloTs(rel, mocks);
      }
    }
    return require(id);
  };

  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', codigoJs);
  fn(modulo.exports, requireCustom, modulo, caminhoArquivo, dir);
  return modulo.exports;
}

const {
  detectarFluxoContinuoAgua,
  LIMIAR_VAZAO_CONTINUA_L_MIN,
  MIN_LEITURAS_FLUXO_CONTINUO,
} = carregarModuloTs('src/utils/vazamento.ts');

const { gerarCsvHistoricoConsumo } = carregarModuloTs('src/utils/exportar-relatorio.ts', {
  'react-native': {
    Platform: { OS: 'ios' },
    Share: { share: async () => ({}) },
  },
});

function criarLeitura(vazaoLMin, offsetSegundos = 0, consumoAguaLitros = 10) {
  return {
    id: `l-${offsetSegundos}`,
    dispositivo_id: 'central-01',
    consumo_agua_litros: consumoAguaLitros,
    vazao_l_min: vazaoLMin,
    potencia_w: 200,
    energia_kwh: 1.5,
    tensao_v: 220,
    criado_em: new Date(Date.now() - offsetSegundos * 1000).toISOString(),
  };
}

test('RF19 - não sinaliza fluxo contínuo quando vazão atual está zerada ou abaixo do limiar', () => {
  const atual = criarLeitura(0.4, 0);
  const historico = [criarLeitura(3.0, 10), criarLeitura(3.2, 20), criarLeitura(2.8, 30)];
  assert.equal(detectarFluxoContinuoAgua(atual, historico), false);
});

test('RF19 - não sinaliza fluxo contínuo em abertura rápida normal (apenas 1 ou 2 leituras)', () => {
  const atual = criarLeitura(LIMIAR_VAZAO_CONTINUA_L_MIN + 0.5, 0);
  const historicoCurto = [
    atual,
    criarLeitura(LIMIAR_VAZAO_CONTINUA_L_MIN + 0.2, 10),
    criarLeitura(0, 20),
  ];
  assert.equal(detectarFluxoContinuoAgua(atual, historicoCurto), false);
});

test('RF19 - sinaliza fluxo contínuo quando há sequência prolongada acima do limiar', () => {
  const leituras = [];
  for (let i = 0; i < MIN_LEITURAS_FLUXO_CONTINUO; i++) {
    leituras.push(criarLeitura(LIMIAR_VAZAO_CONTINUA_L_MIN + 0.3, i * 10));
  }
  assert.equal(detectarFluxoContinuoAgua(leituras[0], leituras), true);
});

test('RF24 - gera CSV estruturado de histórico de água e energia elétrica com cabeçalho e dados consolidados', () => {
  const historicoDiario = [
    {
      id: 'central-01_2026-11-05',
      dispositivo_id: 'central-01',
      data: '2026-11-05',
      consumo_agua_litros: 120.5,
      energia_kwh: 4.5,
      pico_potencia_w: 1850,
      pico_vazao_l_min: 6.25,
      media_tensao_v: 220.0,
      leituras_computadas: 42,
    },
  ];

  const csvAgua = gerarCsvHistoricoConsumo('agua', 'central-01', historicoDiario, []);
  assert.match(csvAgua, /"Data";"Dispositivo";"Consumo de Agua \(L\)";"Pico de Vazao \(L\/min\)";"Leituras Computadas"/);
  assert.match(csvAgua, /"2026-11-05";"central-01";"120,5";"6,25";"42"/);

  const csvEnergia = gerarCsvHistoricoConsumo('energia', 'central-01', historicoDiario, []);
  assert.match(csvEnergia, /"Data";"Dispositivo";"Consumo de Energia \(kWh\)";"Pico de Potencia \(W\)";"Tensao Media \(V\)";"Leituras Computadas"/);
  assert.match(csvEnergia, /"2026-11-05";"central-01";"4,50";"1850";"220,0";"42"/);
});
