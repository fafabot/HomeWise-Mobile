// Real Expo Router/guards and UI, exclusively synthetic SDK and loopback endpoints.
const { chromium } = require(process.env.HOMEWISE_PLAYWRIGHT_PATH || require('node:path').join(require('node:os').tmpdir(), 'homewise-browser-check/node_modules/playwright'));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../dist-validation');
const js = fs.readdirSync(path.join(root, '_expo/static/js/web')).filter(n => n.endsWith('.js')).map(n => fs.readFileSync(path.join(root, '_expo/static/js/web', n), 'utf8')).join('\n');
if (js.includes('homewise-65bb1') || !js.includes('Local-only validation blocks network')) throw new Error('Mock build required');
const server = http.createServer((request, response) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  response.setHeader('Content-Security-Policy', "connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'");
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.css': 'text/css' };
  response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(response);
});
(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8098, '127.0.0.1', resolve); });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => Object.defineProperty(window, 'Notification', { configurable: true, value: { requestPermission: async () => 'granted' } }));
  const errors = [], external = [], passed = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.route('**/*', route => { if (new URL(route.request().url()).origin !== 'http://127.0.0.1:8098') { external.push(route.request().url()); return route.abort(); } return route.continue(); });
  const click = label => page.getByText(label, { exact: true }).filter({ visible: true }).last().click();
  const waitRoute = route => page.waitForURL(url => url.pathname === route);
  const check = async (name, action) => { await action(); passed.push(name); console.log('PASS ' + name); };
  try {
    await page.goto('http://127.0.0.1:8098');
    await check('restoration and approved financial rows', async () => {
      await page.getByText('Olá, Pessoa sintética!', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__HOMEWISE_MINIMAL_VALIDATION__.mock), true);
      for (const label of ['Gasto no dia (hoje)', 'Média aprendida:']) await page.getByText(label, { exact: true }).waitFor();
      assert.ok(await page.getByText(/^Água R\$/).count()); assert.ok(await page.getByText(/^Energia R\$/).count());
    });
    await check('approved Energy kWh charts in all periods and tooltip', async () => {
      await click('Energia'); await waitRoute('/energia');
      for (const period of ['Dia', 'Semana', 'Mês', 'Ano']) {
        await page.getByRole('tab', { name: period, exact: true }).click();
        await page.getByText('Consumo por período (kWh)', { exact: true }).waitFor();
        await page.getByRole('button', { name: /kWh/ }).last().click();
        await page.getByText('Consumo no período', { exact: true }).filter({ visible: true }).last().waitFor();
        await page.getByRole('button', { name: 'Fechar detalhes', exact: true }).click();
      }
    });
    await check('SVG Metas and alert preferences', async () => {
      await click('Perfil'); await click('Metas de Consumo'); await waitRoute('/metas');
      await page.locator('svg circle[transform]').first().waitFor(); assert.equal(await page.locator('svg [transform-origin]').count(), 0);
      await click('Alertas'); await page.getByRole('switch').first().click();
      await page.getByText('ATIVADAS', { exact: true }).filter({ visible: true }).last().waitFor();
    });
    await check('minimal subscription closes checkout, keeps plan/cancel and confirms five seconds', async () => {
      await click('Perfil'); await click('Plano e assinatura'); await waitRoute('/gerenciar-assinatura');
      await click('Anual'); await page.getByRole('button', { name: 'Escolher plano Premium', exact: true }).click();
      await click('Simular pagamento PIX e ativar');
      await page.getByText('Simulação concluída: plano HomeWise Premium anual ativado.', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Fechar pagamento', exact: true }).count(), 0);
      await page.getByText('HomeWise Premium (Anual)', { exact: true }).waitFor();
      assert.ok(await page.getByText('Cancelar', { exact: true }).count());
      await page.waitForTimeout(5100); assert.equal(await page.getByText('Simulação concluída', { exact: true }).count(), 0);
    });
    await check('profile partial edit preserves draft, then retries', async () => {
      await click('Perfil'); await click('Editar Perfil'); await waitRoute('/editar-perfil');
      await page.getByLabel('Nome Completo', { exact: true }).fill('Nome editado');
      await page.evaluate(() => window.__HOMEWISE_MINIMAL_VALIDATION__.failNextProfile()); await click('Salvar Alterações');
      await page.getByText('Alterações incompletas', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Nome Completo', { exact: true }).inputValue(), 'Nome editado');
      await click('Salvar Alterações'); await waitRoute('/perfil');
    });
    await check('explicit logout and partial signup same-account recovery', async () => {
      await click('Sair da conta'); await page.getByRole('button', { name: 'Sair', exact: true }).click(); await waitRoute('/boas-vindas');
      await click('Criar conta'); await waitRoute('/cadastro');
      await page.getByPlaceholder('Seu nome', { exact: true }).fill('Nova pessoa');
      await page.getByLabel('E-mail', { exact: true }).fill('signup@example.invalid');
      await page.getByLabel('Senha', { exact: true }).fill('synthetic-password');
      await page.getByLabel('Confirmar senha', { exact: true }).fill('synthetic-password');
      await page.evaluate(() => window.__HOMEWISE_MINIMAL_VALIDATION__.failNextProfile()); await click('Criar minha conta');
      await page.getByText(/Sua conta foi criada/).waitFor(); await waitRoute('/cadastro');
      await click('Concluir meu perfil'); await waitRoute('/');
    });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    fs.writeFileSync(path.join(require('node:os').tmpdir(), 'homewise-approved-minimal-browser.json'), JSON.stringify({ passed, errors, external, mock: true, realExpoRouter: true }, null, 2));
    console.log(`${passed.length} real-browser scenarios passed`);
  } catch (error) { console.error('URL', page.url(), '\nBODY', (await page.locator('body').innerText()).slice(-5000)); throw error; }
  finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
