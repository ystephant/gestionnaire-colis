// Sauvegarde des parties et des groupes de joueurs : cache local (hors ligne) + Supabase (tous les appareils)
const MAX_PARTIES = 500;

const KINDS = {
  history: { local: 'sgt7_saved', table: 'score_history', date: (g) => g.savedAt || '' },
  groups:  { local: 'sgt7_groups', table: 'score_groups', date: (g) => g.updatedAt || '' },
};

const lire = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage plein */ } };
const user = () => { try { return localStorage.getItem('username'); } catch { return null; } };

const TOMBES = 'sgt7_deleted'; // suppressions à répercuter sur le serveur : ["history:id", ...]

export const readLocal = (kind) => lire(KINDS[kind].local, []);

const writeLocal = (kind, items) => {
  const tri = [...items].sort((a, b) => KINDS[kind].date(b).localeCompare(KINDS[kind].date(a)));
  ecrire(KINDS[kind].local, tri.slice(0, MAX_PARTIES));
};

const ligne = (kind, item, u) =>
  kind === 'history'
    ? { user_id: u, id: item.id, data: item, updated_at: item.savedAt || new Date().toISOString() }
    : { user_id: u, id: item.id, name: item.name, players: item.players, updated_at: item.updatedAt };

const depuisLigne = (kind, r) =>
  kind === 'history' ? r.data : { id: r.id, name: r.name, players: r.players, updatedAt: r.updated_at };

export async function pushItem(supabase, kind, item) {
  const u = user();
  if (!supabase || !u) return;
  const { error } = await supabase.from(KINDS[kind].table).upsert(ligne(kind, item, u), { onConflict: 'user_id,id' });
  if (error) console.warn('Synchronisation scores :', error.message);
}

export function saveItem(kind, item) {
  const items = readLocal(kind).filter((x) => x.id !== item.id);
  writeLocal(kind, [item, ...items]);
}

export async function deleteItem(supabase, kind, id) {
  writeLocal(kind, readLocal(kind).filter((x) => x.id !== id));
  const tombe = `${kind}:${id}`;
  ecrire(TOMBES, [...new Set([...lire(TOMBES, []), tombe])]);
  const u = user();
  if (!supabase || !u) return;
  const { error } = await supabase.from(KINDS[kind].table).delete().eq('user_id', u).eq('id', id);
  if (!error) ecrire(TOMBES, lire(TOMBES, []).filter((t) => t !== tombe));
}

// Fusionne le serveur et l'appareil : la version la plus récente de chaque élément gagne
export async function syncAll(supabase, kind) {
  const u = user();
  if (!supabase || !u) return false;
  for (const t of lire(TOMBES, []).filter((x) => x.startsWith(`${kind}:`))) {
    await deleteItem(supabase, kind, t.slice(kind.length + 1));
  }
  const distants = [];
  for (let from = 0; from < MAX_PARTIES; from += 100) {
    const { data, error } = await supabase.from(KINDS[kind].table).select('*')
      .eq('user_id', u).order('updated_at', { ascending: false }).range(from, from + 99);
    if (error) { console.warn('Synchronisation scores :', error.message); return false; }
    distants.push(...(data || []).map((r) => depuisLigne(kind, r)));
    if (!data || data.length < 100) break;
  }
  const supprimes = new Set(lire(TOMBES, []));
  const parId = new Map(distants.filter((x) => !supprimes.has(`${kind}:${x.id}`)).map((x) => [x.id, x]));
  const aEnvoyer = [];
  // Les parties vides créées par les anciennes versions ne sont pas reprises
  readLocal(kind).filter((x) => kind !== 'history' || x.players?.length).forEach((x) => {
    const d = parId.get(x.id);
    if (!d || Date.parse(KINDS[kind].date(x)) > Date.parse(KINDS[kind].date(d))) {
      parId.set(x.id, x);
      aEnvoyer.push(x);
    }
  });
  writeLocal(kind, [...parId.values()]);
  for (const x of aEnvoyer) await pushItem(supabase, kind, x);
  return true;
}
