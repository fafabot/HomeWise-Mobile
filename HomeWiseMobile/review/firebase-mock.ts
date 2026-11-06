// LOCAL REVIEW ONLY. Selected by Metro instead of every Firebase SDK/config module.
// No production SDK is imported and all data lives in memory.
type RecordData = Record<string, any>;
type Reference = { collection: string; id?: string; constraints?: any[] };
const docs = new Map<string, RecordData>();
const listeners = new Set<{ ref: Reference; next: (snapshot: any) => void }>();
const accounts = new Set<(user: any) => void>();
let offline = false;
let failProfile = false;
const pending: (() => void)[] = [];
let clock = Date.now();
const stamp = () => { const ms = ++clock; return { toMillis: () => ms, toDate: () => new Date(ms), seconds: Math.floor(ms / 1000), nanoseconds: ms % 1000 * 1000000 }; };
export const auth: { currentUser: any } = { currentUser: null };
export const db = { projectId: 'demo-homewise', mock: true };
export default db;
export const serverTimestamp = () => ({ __serverTimestamp: true });
export const doc = (_db: any, collection: string, id: string): Reference => ({ collection, id });
export const collection = (_db: any, name: string): Reference => ({ collection: name });
export const query = (ref: Reference, ...constraints: any[]): Reference => ({ ...ref, constraints });
export const where = (...values: any[]) => ({ where: values });
export const orderBy = (...values: any[]) => ({ orderBy: values });
export const limit = (value: number) => ({ limit: value });
const key = (ref: Reference) => `${ref.collection}/${ref.id}`;
function snapshot(ref: Reference, local = false) {
  const data = docs.get(key(ref));
  let rows = [...docs.entries()].filter(([name]) => name.startsWith(ref.collection + '/')).map(([name, value]) => ({ id: name.split('/')[1], data: () => value }));
  for (const constraint of ref.constraints || []) {
    if (constraint.where) { const [field, op, value] = constraint.where; if (op === '==') rows = rows.filter(row => row.data()[field] === value); }
    if (constraint.orderBy) { const [field, direction] = constraint.orderBy; rows.sort((a, b) => ((a.data()[field]?.toMillis?.() ?? a.data()[field]) > (b.data()[field]?.toMillis?.() ?? b.data()[field]) ? 1 : -1) * (direction === 'desc' ? -1 : 1)); }
    if (constraint.limit) rows = rows.slice(0, constraint.limit);
  }
  return { id: ref.id, exists: () => !!data, data: () => data,
    metadata: { fromCache: false, hasPendingWrites: local }, docs: rows, empty: !rows.length, size: rows.length,
    forEach: (callback: any) => rows.forEach(callback) };
}
const publish = (local = false, collectionName?: string) => listeners.forEach(l => { if (!collectionName || l.ref.collection === collectionName) l.next(snapshot(l.ref, local)); });
const emitAccount = () => accounts.forEach(next => next(auth.currentUser));
export function onSnapshot(ref: Reference, options: any, next?: any) {
  const listener = { ref, next: typeof options === 'function' ? options : next };
  listeners.add(listener); queueMicrotask(() => { if (listeners.has(listener)) listener.next(snapshot(ref)); });
  return () => { listeners.delete(listener); };
}
export const getDoc = async (ref: Reference) => snapshot(ref);
export const getDocFromServer = async (ref: Reference) => {
  if (offline) throw new Error('Synthetic server unavailable');
  return snapshot(ref);
};
export async function setDoc(ref: Reference, patch: RecordData, options?: { merge?: boolean }) {
  if (failProfile && ref.collection === 'usuarios') { failProfile = false; throw Object.assign(new Error('Synthetic persistence failure'), { code: 'unavailable' }); }
  const materialized = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v?.__serverTimestamp ? stamp() : v]));
  const apply = () => docs.set(key(ref), { ...(options?.merge ? docs.get(key(ref)) : {}), ...materialized });
  // Local echo is visible to SDK listeners, but not an authoritative confirmation.
  const previous = docs.get(key(ref)); apply(); publish(true, ref.collection);
  if (previous) docs.set(key(ref), previous); else docs.delete(key(ref));
  await new Promise<void>(resolve => {
    const finish = () => { apply(); publish(false, ref.collection); resolve(); };
    if (offline) pending.push(finish); else setTimeout(finish, 200);
  });
}
export async function runTransaction(_db: any, callback: any) {
  if (offline) throw Object.assign(new Error('Synthetic offline transaction'), { code: 'unavailable' });
  const writes: (() => Promise<void>)[] = [];
  const result = await callback({ get: getDoc, set: (ref: Reference, patch: RecordData, options: any) => writes.push(() => setDoc(ref, patch, options)) });
  for (const write of writes) await write();
  return result;
}
export function onAuthStateChanged(_auth: any, next: any) {
  accounts.add(next); queueMicrotask(() => { if (accounts.has(next)) next(auth.currentUser); });
  return () => { accounts.delete(next); };
}
function syntheticUser(email = 'review@example.invalid', displayName: string | null = 'Pessoa de teste') {
  if (!email.endsWith('@example.invalid')) throw Object.assign(new Error('Use synthetic @example.invalid email only'), { code: 'auth/invalid-email' });
  return { uid: 'review-' + email.split('@')[0], email, displayName, emailVerified: false };
}
export const reload = async () => {};
export const signOut = async () => { auth.currentUser = null; emitAccount(); };
export const updateProfile = async (user: any, patch: any) => { Object.assign(user, patch); };
export const updatePassword = async () => {};
export const sendPasswordResetEmail = async () => {};
export const reauthenticateWithCredential = async () => {};
export const EmailAuthProvider = { credential: () => ({ synthetic: true }) };
export async function createUserWithEmailAndPassword(_auth: any, email: string) {
  if (docs.has('usuarios/review-' + email.split('@')[0])) throw Object.assign(new Error('Exists'), { code: 'auth/email-already-in-use' });
  auth.currentUser = syntheticUser(email, null); emitAccount(); return { user: auth.currentUser };
}
export async function signInWithEmailAndPassword(_auth: any, email: string) {
  const uid = 'review-' + email.split('@')[0];
  auth.currentUser = syntheticUser(email, docs.get('usuarios/' + uid)?.nome || null);
  emitAccount(); return { user: auth.currentUser };
}
export const review = {
  offline(value: boolean) { offline = value; if (!offline) while (pending.length) pending.shift()!(); },
  failNextProfile() { failProfile = true; },
  legacyConflict() {
    const ref = doc(db, 'usuarios', auth.currentUser.uid);
    docs.set(key(ref), { ...docs.get(key(ref)), plano: 'basico', plano_nome: 'Básico' });
    publish(false, 'usuarios');
  },
  async trustedCorrection() {
    await setDoc(doc(db, 'usuarios', auth.currentUser.uid), { plano: 'premium', plano_nome: 'Premium',
      ciclo_assinatura: 'anual', status_assinatura: 'ativa', assinatura_operacao_id: 'trusted-review-' + (++clock),
      assinatura_atualizada_em: serverTimestamp() }, { merge: true });
  },
  staleSubscription() {
    const ref = doc(db, 'usuarios', auth.currentUser.uid);
    const current = docs.get(key(ref));
    docs.set(key(ref), { ...current, plano: 'basico', status_assinatura: 'ativa', assinatura_operacao_id: 'old-synthetic', assinatura_atualizada_em: { toMillis: () => 1 } });
    publish(false, 'usuarios');
    if (current) docs.set(key(ref), current);
  },
  sensors() {
    review.seed();
    const uid = auth.currentUser.uid;
    docs.set('usuarios/' + uid, { ...docs.get('usuarios/' + uid), dispositivo_id: 'synthetic-central' });
    for (let i = 0; i < 30; i++) {
      const date = new Date(); date.setDate(date.getDate() - i);
      const ms = date.getTime();
      docs.set('leituras/synthetic-' + i, { dispositivo_id: 'synthetic-central', consumo_agua_litros: 42 + i,
        energia_kwh: 3 + i / 10, vazao_l_min: 1.2, potencia_w: 120, tensao_v: 127,
        criado_em: { toDate: () => date, toMillis: () => ms } });
    }
    publish();
  },
  seed() {
    auth.currentUser = syntheticUser();
    docs.set('usuarios/' + auth.currentUser.uid, { uid: auth.currentUser.uid, nome: auth.currentUser.displayName,
      email: auth.currentUser.email, dispositivo_id: '', plano: 'plus', status_assinatura: 'ativa', ciclo_assinatura: 'mensal',
      telefone: '(11) 98888-7777', cpf: '529.982.247-25', cep: '01001-000',
      metas_consumo: { agua: 1000, energia: 200 },
      endereco_detalhado: { rua: 'Rua Sintética', numero: '10', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' } });
    emitAccount(); publish();
  },
  incomplete() {
    auth.currentUser = syntheticUser('incomplete@example.invalid', null);
    docs.delete('usuarios/' + auth.currentUser.uid); emitAccount(); publish();
  }
};
if (typeof window !== 'undefined') {
  (window as any).__HOMEWISE_REVIEW__ = review;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return Promise.reject(new Error('Local review blocks external requests'));
    return originalFetch(input, options);
  };
  review.seed();
}
