// Test-only SDK boundary. No real SDK/config imports, no new subscription schema.
type Data = Record<string, any>;
type Ref = { collection: string; id?: string; constraints?: any[] };
const records = new Map<string, Data>();
const listeners = new Set<{ ref: Ref; callback: (value: any) => void }>();
const authListeners = new Set<(value: any) => void>();
let fail = false;
export const auth: { currentUser: any } = { currentUser: null };
export const db = { mock: true, projectId: 'demo-homewise' };
export default db;
export const doc = (_db: any, collection: string, id: string): Ref => ({ collection, id });
export const collection = (_db: any, name: string): Ref => ({ collection: name });
export const query = (ref: Ref, ...constraints: any[]): Ref => ({ ...ref, constraints });
export const where = (...value: any[]) => ({ where: value });
export const orderBy = (...value: any[]) => ({ orderBy: value });
export const limit = (value: number) => ({ limit: value });
const key = (ref: Ref) => `${ref.collection}/${ref.id}`;
function snapshot(ref: Ref, pending = false) {
  const value = records.get(key(ref));
  let rows = [...records.entries()].filter(([name]) => name.startsWith(ref.collection + '/')).map(([name, data]) => ({ id: name.split('/')[1], data: () => data }));
  for (const condition of ref.constraints || []) {
    if (condition.where) { const [field, op, expected] = condition.where; if (op === '==') rows = rows.filter(row => row.data()[field] === expected); }
    if (condition.orderBy) { const [field, order] = condition.orderBy; const metric = (data: Data) => data[field]?.toMillis?.() ?? data[field]; rows.sort((a, b) => (metric(a.data()) > metric(b.data()) ? 1 : -1) * (order === 'desc' ? -1 : 1)); }
    if (condition.limit) rows = rows.slice(0, condition.limit);
  }
  return { id: ref.id, exists: () => !!value, data: () => value, metadata: { fromCache: false, hasPendingWrites: pending },
    docs: rows, empty: !rows.length, size: rows.length, forEach: (fn: any) => rows.forEach(fn) };
}
function publish(name: string, pending = false) { listeners.forEach(item => { if (item.ref.collection === name) item.callback(snapshot(item.ref, pending)); }); }
export function onSnapshot(ref: Ref, options: any, next?: any) {
  const item = { ref, callback: typeof options === 'function' ? options : next }; listeners.add(item);
  queueMicrotask(() => { if (listeners.has(item)) item.callback(snapshot(ref)); });
  return () => { listeners.delete(item); };
}
export const getDoc = async (ref: Ref) => snapshot(ref);
export async function setDoc(ref: Ref, data: Data, options?: { merge?: boolean }) {
  if (Object.keys(data).some(field => field.startsWith('assinatura_'))) throw new Error('Advanced subscription fields forbidden in minimal validation');
  if (fail && ref.collection === 'usuarios') { fail = false; throw Object.assign(new Error('Synthetic failure'), { code: 'unavailable' }); }
  const previous = records.get(key(ref));
  const updated = { ...(options?.merge ? previous : {}), ...data };
  records.set(key(ref), updated); publish(ref.collection, true);
  if (previous) records.set(key(ref), previous); else records.delete(key(ref));
  await new Promise(resolve => setTimeout(resolve, 100));
  records.set(key(ref), updated); publish(ref.collection);
}
export async function runTransaction(_db: any, callback: any) {
  const writes: (() => Promise<void>)[] = [];
  const result = await callback({ get: getDoc, set: (ref: Ref, data: Data, options: any) => writes.push(() => setDoc(ref, data, options)) });
  for (const write of writes) await write(); return result;
}
function emit() { authListeners.forEach(callback => callback(auth.currentUser)); }
export function onAuthStateChanged(_auth: any, callback: any) { authListeners.add(callback); queueMicrotask(() => { if (authListeners.has(callback)) callback(auth.currentUser); }); return () => { authListeners.delete(callback); }; }
export const reload = async () => {};
export const signOut = async () => { auth.currentUser = null; emit(); };
export const updateProfile = async (user: any, data: Data) => { Object.assign(user, data); };
export const updatePassword = async () => {};
export const reauthenticateWithCredential = async () => {};
export const sendPasswordResetEmail = async () => {};
export const EmailAuthProvider = { credential: () => ({ synthetic: true }) };
function account(email: string, name: string | null) {
  if (!email.endsWith('@example.invalid')) throw Object.assign(new Error('Synthetic email required'), { code: 'auth/invalid-email' });
  return { uid: 'test-' + email.split('@')[0], email, displayName: name, emailVerified: false };
}
export async function createUserWithEmailAndPassword(_auth: any, email: string) {
  if (records.has('usuarios/test-' + email.split('@')[0])) throw Object.assign(new Error('Exists'), { code: 'auth/email-already-in-use' });
  auth.currentUser = account(email, null); emit(); return { user: auth.currentUser };
}
export async function signInWithEmailAndPassword(_auth: any, email: string) { auth.currentUser = account(email, records.get('usuarios/test-' + email.split('@')[0])?.nome || null); emit(); return { user: auth.currentUser }; }
const control = {
  mock: true,
  failNextProfile() { fail = true; },
  seed() {
    auth.currentUser = account('local@example.invalid', 'Pessoa sintética');
    records.set('usuarios/' + auth.currentUser.uid, { uid: auth.currentUser.uid, email: auth.currentUser.email, nome: auth.currentUser.displayName,
      dispositivo_id: 'test-central', plano: 'plus', plano_nome: 'Plus', status_assinatura: 'ativa', ciclo_assinatura: 'mensal',
      metas_consumo: { agua: 1000, energia: 200 }, telefone: '(11) 98888-7777', cpf: '52998224725', cep: '01001-000',
      endereco_detalhado: { rua: 'Rua Sintética', numero: '10', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' } });
    for (let day = 0; day < 30; day++) {
      const date = new Date(); date.setDate(date.getDate() - day); const ms = date.getTime();
      records.set('leituras/day-' + day, { dispositivo_id: 'test-central', criado_em: { toDate: () => date, toMillis: () => ms },
        consumo_agua_litros: 42 + day, energia_kwh: 3 + day / 10, vazao_l_min: 1.2, potencia_w: 120, tensao_v: 127 });
    }
    emit(); publish('usuarios'); publish('leituras');
  }
};
if (typeof window !== 'undefined') {
  (window as any).__HOMEWISE_MINIMAL_VALIDATION__ = control;
  const original = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return Promise.reject(new Error('Local-only validation blocks network'));
    return original(input, options);
  };
  control.seed();
}
