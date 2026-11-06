// Actual Expo Router/DOM integration; all backend modules replaced at build time.
// Uses an isolated browser with a private Playwright pipe (no debug TCP port).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.HOMEWISE_PLAYWRIGHT_PATH || path.join(os.tmpdir(), 'homewise-browser-check/node_modules/playwright'));
const base = process.env.HOMEWISE_REVIEW_URL || 'http://127.0.0.1:8097';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local mock review URL required');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Notification', { configurable: true, value: { requestPermission: async () => 'granted' } });
  });
  const errors = [], blocked = [], passed = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const target = new URL(route.request().url());
    if (target.origin !== new URL(base).origin) { blocked.push(target.origin); return route.abort(); }
    return route.continue();
  });
  page.on('dialog', dialog => dialog.accept());
  const text = () => page.locator('body').innerText();
  const click = label => page.getByText(label, { exact: true }).filter({ visible: true }).last().click();
  const pathIs = async pathname => page.waitForURL(url => url.pathname === pathname);
  const check = async (label, action) => { await action(); passed.push(label); console.log('PASS ' + label); };
  try {
    await page.goto(base);
    await page.getByText('REVISÃO LOCAL — MOCKS', { exact: false }).waitFor();
    await page.getByText('Olá, Pessoa de teste!', { exact: true }).waitFor();
    await check('restoration opens normal routes only with confirmed synthetic profile', async () => {
      assert.equal(new URL(page.url()).pathname, '/');
      assert.ok(await page.evaluate(() => !!window.__HOMEWISE_REVIEW__));
    });
    await check('Metas real route renders SVG without invalid transform-origin', async () => {
      await click('Sensores sintéticos'); await click('Perfil'); await pathIs('/perfil');
      await click('Metas de Consumo'); await pathIs('/metas');
      await page.locator('svg circle[transform]').first().waitFor();
      assert.equal(await page.locator('svg [transform-origin]').count(), 0);
    });
    await check('Alertas preferences toggle and filter interaction survive navigation', async () => {
      await click('Alertas'); await pathIs('/alertas');
      await page.getByRole('switch').first().click();
      await page.getByText('ATIVADAS', { exact: true }).filter({ visible: true }).last().waitFor();
      await page.waitForTimeout(500);
      const water = page.getByRole('switch', { name: /Vazamentos de água/ });
      const before = await water.getAttribute('style');
      await water.click();
      assert.notEqual(await water.getAttribute('style'), before);
      await page.waitForTimeout(500);
      await click('Perfil'); await click('Configurações de alerta'); await pathIs('/alertas');
      await page.getByText('ATIVADAS', { exact: true }).filter({ visible: true }).last().waitFor();
    });
    await check('subscription offline is pending, timeout does not cancel, reconnect confirms once and preserves receipt against old snapshot', async () => {
      await click('Perfil'); await click('Plano e assinatura'); await pathIs('/gerenciar-assinatura');
      await click('Anual'); await page.getByRole('button', { name: 'Escolher plano Premium', exact: true }).click();
      await page.evaluate(() => window.__HOMEWISE_REVIEW__.offline(true));
      await click('Simular pagamento PIX e ativar');
      await page.getByText(/Este prazo não cancela a operação/).waitFor({ timeout: 15000 });
      assert.doesNotMatch(await text(), /Simulação concluída/);
      await page.getByRole('button', { name: 'Fechar pagamento', exact: true }).click();
      await page.evaluate(() => window.__HOMEWISE_REVIEW__.offline(false));
      await page.getByText('Simulação concluída: plano HomeWise Premium anual ativado.', { exact: true }).waitFor();
      await page.evaluate(() => window.__HOMEWISE_REVIEW__.staleSubscription());
      assert.match(await text(), /HomeWise Premium \(Anual\)/);
      await page.waitForTimeout(5100);
      assert.doesNotMatch(await text(), /Simulação concluída/);
      assert.match(await text(), /HomeWise Premium \(Anual\)/);
    });
    await check('legacy merge becomes explicit inconsistency; server read cannot legitimate it; trusted newer correction plus explicit query resolves', async () => {
      await page.evaluate(() => window.__HOMEWISE_REVIEW__.legacyConflict());
      await page.getByText('Assinatura em verificação', { exact: true }).filter({ visible: true }).last().waitFor();
      await page.getByText(/O servidor ainda apresenta assinatura inconsistente/).filter({ visible: true }).last().waitFor();
      assert.doesNotMatch(await text(), /Simulação concluída/);
      await page.evaluate(() => window.__HOMEWISE_REVIEW__.trustedCorrection());
      await page.getByRole('button', { name: 'Consultar assinatura no servidor', exact: true }).click();
      await page.getByText(/Consulta ao servidor reconciliou/).filter({ visible: true }).last().waitFor();
      assert.match(await text(), /HomeWise Premium \(Anual\)/);
    });
    await check('profile partial save stays in editor, preserves draft, retry saves', async () => {
      await click('Perfil'); await click('Editar Perfil'); await pathIs('/editar-perfil');
      await page.getByLabel('Nome Completo', { exact: true }).fill('Nome de revisão');
      await click('Falhar próximo perfil'); await click('Salvar Alterações');
      await page.getByText('Alterações incompletas', { exact: true }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/editar-perfil');
      assert.equal(await page.getByLabel('Nome Completo', { exact: true }).inputValue(), 'Nome de revisão');
      await click('Salvar Alterações'); await pathIs('/perfil');
    });
    await check('explicit Perfil logout returns Welcome using real guard', async () => {
      await click('Sair da conta'); await page.getByRole('button', { name: 'Sair', exact: true }).click();
      await pathIs('/boas-vindas');
    });
    await check('signup partial keeps registration and recovers same Auth account', async () => {
      // Enter via real welcome CTA; only synthetic email may reach the mock SDK.
      await page.getByText('Criar conta', { exact: true }).click(); await pathIs('/cadastro');
      await page.getByPlaceholder('Seu nome', { exact: true }).fill('Cadastro sintético');
      await page.getByLabel('E-mail', { exact: true }).fill('signup@example.invalid');
      await page.getByLabel('Senha', { exact: true }).fill('synthetic-password');
      await page.getByLabel('Confirmar senha', { exact: true }).fill('synthetic-password');
      await click('Falhar próximo perfil'); await click('Criar minha conta');
      await page.getByText(/Sua conta foi criada/).waitFor();
      assert.equal(new URL(page.url()).pathname, '/cadastro');
      await click('Concluir meu perfil'); await pathIs('/');
      assert.match(await text(), /Cadastro sintético/);
    });
    await check('restored missing profile can recover; explicit incomplete logout returns Welcome', async () => {
      await click('Perfil incompleto'); await pathIs('/cadastro');
      await page.getByPlaceholder('Seu nome', { exact: true }).fill('Perfil recuperado');
      await click('Concluir meu perfil'); await pathIs('/');
      await click('Perfil incompleto'); await pathIs('/cadastro');
      await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
      await pathIs('/boas-vindas');
    });
    await check('reload restores confirmed mock session and normal guards', async () => {
      await page.reload(); await page.getByText('Olá, Pessoa de teste!', { exact: true }).waitFor();
      await pathIs('/');
    });
    await check('duplicate-account signup fails without leaving form; a fresh complete signup opens normal routes', async () => {
      await click('Perfil'); await click('Sair da conta');
      await page.getByRole('button', { name: 'Sair', exact: true }).click(); await pathIs('/boas-vindas');
      await click('Criar conta'); await pathIs('/cadastro');
      await page.getByPlaceholder('Seu nome', { exact: true }).fill('Cadastro completo');
      await page.getByLabel('E-mail', { exact: true }).fill('review@example.invalid');
      await page.getByLabel('Senha', { exact: true }).fill('synthetic-password');
      await page.getByLabel('Confirmar senha', { exact: true }).fill('synthetic-password');
      await click('Criar minha conta');
      await page.getByText('Este e-mail já possui uma conta. Entre com sua senha.', { exact: true }).filter({ visible: true }).last().waitFor();
      assert.equal(new URL(page.url()).pathname, '/cadastro');
      assert.equal(await page.getByPlaceholder('Seu nome', { exact: true }).inputValue(), 'Cadastro completo');
      await page.getByLabel('E-mail', { exact: true }).fill('signup-complete@example.invalid');
      await click('Criar minha conta'); await pathIs('/');
      assert.match(await text(), /Cadastro completo/);
    });
    assert.deepEqual(errors, []); assert.deepEqual(blocked, []);
    const report = { passed, pageErrors: errors, blockedExternalRequests: blocked, viewport: '390x844', mocks: true, realExpoRouter: true };
    fs.writeFileSync(path.join(os.tmpdir(), 'homewise-integration-browser-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error('URL', page.url(), '\nBODY', (await text()).slice(-6000));
    await page.screenshot({ path: path.join(os.tmpdir(), 'homewise-integration-failure.png'), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
