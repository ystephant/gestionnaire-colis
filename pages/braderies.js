/**
 * PAGE BRADERIES
 *
 * SQL Supabase (création) :
 *   create table braderies (
 *     id uuid default gen_random_uuid() primary key,
 *     ville text not null,
 *     quartier text,
 *     note text not null check (note in ('a_fuir', 'passable', 'tres_bien')),
 *     commentaire text,
 *     created_at timestamp with time zone default now()
 *   );
 *   alter table braderies enable row level security;
 *   create policy "Allow all" on braderies for all using (true) with check (true);
 *
 * Si la table existe déjà, ajouter la colonne quartier :
 *   ALTER TABLE braderies ADD COLUMN quartier text;
 *
 * ⚠️  TEMPS RÉEL : dans le dashboard Supabase → Database → Replication,
 *     activer la table "braderies" pour que le realtime fonctionne.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Search, Plus, Edit2, Trash2, Check, X, MapPin, MessageSquare, Map, ArrowLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Constantes ────────────────────────────────────────────────────────────────

const NOTES = {
  a_fuir:   { label: 'À fuir',    emoji: '🚫', bg: 'bg-red-100',   border: 'border-red-300',    text: 'text-red-700',    badgeBg: 'bg-red-200',    badgeText: 'text-red-800',    mapColor: '#dc2626' },
  passable:  { label: 'Passable',  emoji: '😐', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', badgeBg: 'bg-yellow-200', badgeText: 'text-yellow-800', mapColor: '#ca8a04' },
  tres_bien: { label: 'Très bien', emoji: '✅', bg: 'bg-green-100', border: 'border-green-300',  text: 'text-green-700',  badgeBg: 'bg-green-200',  badgeText: 'text-green-800',  mapColor: '#16a34a' },
};
const NOTES_DARK = {
  a_fuir:   { bg: 'bg-red-950',    border: 'border-red-800',    text: 'text-red-300',    badgeBg: 'bg-red-900',    badgeText: 'text-red-200'    },
  passable:  { bg: 'bg-yellow-950', border: 'border-yellow-800', text: 'text-yellow-300', badgeBg: 'bg-yellow-900', badgeText: 'text-yellow-200' },
  tres_bien: { bg: 'bg-green-950',  border: 'border-green-800',  text: 'text-green-300',  badgeBg: 'bg-green-900',  badgeText: 'text-green-200'  },
};
const FILTRE_OPTIONS = [
  { value: 'all',       label: 'Toutes',    emoji: '🗺️' },
  { value: 'tres_bien', label: 'Très bien', emoji: '✅' },
  { value: 'passable',  label: 'Passable',  emoji: '😐' },
  { value: 'a_fuir',    label: 'À fuir',    emoji: '🚫' },
];

// ── Utilitaires ───────────────────────────────────────────────────────────────

/** Ouvre Google Maps dans un nouvel onglet — compatible PC et mobile */
function openUrl(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openGoogleMaps(ville, quartier) {
  const q = encodeURIComponent((quartier ? quartier + ' ' : '') + ville + ', France');
  openUrl('https://www.google.com/maps/search/?api=1&query=' + q);
}

function openItineraire(ville, quartier) {
  const dest = encodeURIComponent((quartier ? quartier + ', ' : '') + ville + ', France');
  openUrl('https://www.google.com/maps/dir/?api=1&destination=' + dest);
}

/** Charge Leaflet depuis le CDN (idempotent) */
function loadLeaflet(cb) {
  if (typeof window === 'undefined') return;
  if (window.L) { cb(window.L); return; }

  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  if (!document.getElementById('leaflet-js')) {
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => cb(window.L);
    document.body.appendChild(script);
  } else {
    // Script en cours de chargement → attendre
    const t = setInterval(() => { if (window.L) { clearInterval(t); cb(window.L); } }, 80);
  }
}

// ── Composant VilleField (autocomplétion) ─────────────────────────────────────

function VilleField({ value, onChange, darkMode, inputCls, placeholder, autoFocus }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleInput = (val) => {
    onChange(val);
    clearTimeout(debounce.current);
    if (!val || val.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(val)}&fields=nom,codesPostaux,departement&limit=8&boost=population`);
        const data = await res.json();
        const list = data.map(c => ({ nom: c.nom, cp: (c.codesPostaux || [''])[0], dept: (c.departement?.nom || '') }));
        setSuggestions(list);
        setShowDrop(list.length > 0);
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    }, 250);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <input value={value} onChange={e => handleInput(e.target.value)} onFocus={() => suggestions.length > 0 && setShowDrop(true)}
        placeholder={placeholder || 'Ville...'} autoFocus={autoFocus || false}
        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${inputCls}`} />
      {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>}
      {showDrop && suggestions.length > 0 && (
        <ul className={`absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
          {suggestions.map((s, i) => (
            <li key={i}>
              <button onMouseDown={e => { e.preventDefault(); onChange(s.nom); setShowDrop(false); setSuggestions([]); }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition ${darkMode ? 'hover:bg-gray-700 text-gray-100' : 'hover:bg-blue-50 text-gray-800'}`}>
                <span className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-400 shrink-0" /><span className="font-medium">{s.nom}</span></span>
                <span className={`text-xs shrink-0 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>{s.cp}{s.dept ? ` — ${s.dept}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Sélecteur de note ─────────────────────────────────────────────────────────

function NoteSelector({ value, onChange, darkMode }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Object.entries(NOTES).map(([key, n]) => (
        <button key={key} onClick={() => onChange(key)}
          className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition ${value === key
            ? `${n.badgeBg} ${n.badgeText} border-current scale-105 shadow`
            : darkMode ? 'bg-gray-700 text-gray-300 border-gray-600 hover:border-gray-400' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
          {n.emoji} {n.label}
        </button>
      ))}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function Braderies() {
  const router = useRouter();

  const [darkMode, setDarkMode] = useState(false);
  const [braderies, setBraderies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtreNote, setFiltreNote] = useState('all');

  // Formulaire ajout manuel
  const [showForm, setShowForm] = useState(false);
  const [formVille, setFormVille] = useState('');
  const [formQuartier, setFormQuartier] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formComment, setFormComment] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Édition inline
  const [editingId, setEditingId] = useState(null);
  const [editVille, setEditVille] = useState('');
  const [editQuartier, setEditQuartier] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editComment, setEditComment] = useState('');

  // Suppression
  const [deletingId, setDeletingId] = useState(null);

  // ── Modal carte Leaflet ──
  const [showMap, setShowMap] = useState(false);
  const [mapError, setMapError] = useState('');
  const [mapLoading, setMapLoading] = useState(false);
  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userPosRef = useRef(null);

  // Formulaire rapide (depuis la carte)
  const [quickCity, setQuickCity] = useState(null);
  const [quickQuartier, setQuickQuartier] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [quickComment, setQuickComment] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Ref pour le callback realtime (évite les closures périmées)
  const loadRef = useRef(null);

  // ── Dark mode ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const s = localStorage.getItem('darkMode');
    if (s !== null) setDarkMode(s === 'true');
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(p => { localStorage.setItem('darkMode', String(!p)); return !p; });
  };

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showToast = (msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Chargement Supabase ───────────────────────────────────────────────────

  const loadBraderies = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('braderies').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setBraderies(data || []);
    } catch { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); }
  }, []);

  // Garder la ref à jour
  useEffect(() => { loadRef.current = loadBraderies; }, [loadBraderies]);

  useEffect(() => { loadBraderies(); }, [loadBraderies]);

  // ── Realtime (subscription unique, utilise toujours le dernier loadBraderies) ──
  useEffect(() => {
    const ch = supabase.channel('braderies-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'braderies' }, () => {
        if (loadRef.current) loadRef.current();
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []); // intentionnellement vide — subscription créée une seule fois

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const resetForm = () => { setFormVille(''); setFormQuartier(''); setFormNote(''); setFormComment(''); };

  const handleAdd = async () => {
    if (!formVille.trim() || !formNote) { showToast('Remplis la ville et la note', 'error'); return; }
    setFormLoading(true);
    try {
      const { error } = await supabase.from('braderies').insert({
        ville: formVille.trim(), quartier: formQuartier.trim() || null,
        note: formNote, commentaire: formComment.trim() || null,
      });
      if (error) throw error;
      resetForm(); setShowForm(false);
      showToast((formQuartier ? `${formQuartier} (${formVille})` : formVille) + ' ajoutée ! 🎉');
    } catch { showToast("Erreur lors de l'ajout", 'error'); }
    finally { setFormLoading(false); }
  };

  const startEdit = (b) => {
    setEditingId(b.id); setEditVille(b.ville); setEditQuartier(b.quartier || '');
    setEditNote(b.note); setEditComment(b.commentaire || '');
  };

  const handleSaveEdit = async (id) => {
    if (!editVille.trim() || !editNote) return;
    try {
      const { error } = await supabase.from('braderies').update({
        ville: editVille.trim(), quartier: editQuartier.trim() || null,
        note: editNote, commentaire: editComment.trim() || null,
      }).eq('id', id);
      if (error) throw error;
      setEditingId(null); showToast('Modifié ✅');
    } catch { showToast('Erreur modification', 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('braderies').delete().eq('id', id);
      if (error) throw error;
      setDeletingId(null); showToast('Supprimé 🗑️');
    } catch { showToast('Erreur suppression', 'error'); }
  };

  // ── Formulaire rapide (depuis carte) ─────────────────────────────────────

  const handleQuickSave = async () => {
    if (!quickCity || !quickNote) { showToast('Choisis une note', 'error'); return; }
    setQuickLoading(true);
    try {
      const existing = braderies.find(b =>
        b.ville.toLowerCase() === quickCity.nom.toLowerCase() &&
        (b.quartier || '').toLowerCase() === quickQuartier.trim().toLowerCase()
      );
      const payload = { ville: quickCity.nom, quartier: quickQuartier.trim() || null, note: quickNote, commentaire: quickComment.trim() || null };
      if (existing) {
        const { error } = await supabase.from('braderies').update({ note: quickNote, quartier: quickQuartier.trim() || null, commentaire: quickComment.trim() || null }).eq('id', existing.id);
        if (error) throw error;
        showToast(`${quickCity.nom} mis à jour ✅`);
      } else {
        const { error } = await supabase.from('braderies').insert(payload);
        if (error) throw error;
        showToast(`${quickCity.nom} ajoutée ! 🎉`);
      }
      setQuickCity(null); setQuickQuartier(''); setQuickNote(''); setQuickComment('');
    } catch { showToast('Erreur sauvegarde', 'error'); }
    finally { setQuickLoading(false); }
  };

  // ── Carte Leaflet ─────────────────────────────────────────────────────────

  /** Dessine (ou re-dessine) les marqueurs de communes sur la carte */
  const drawMarkers = useCallback((L, map, communes, currentBraderies) => {
    // Supprimer anciens marqueurs
    if (markersLayerRef.current) {
      markersLayerRef.current.forEach(m => m.remove());
    }
    markersLayerRef.current = [];

    communes.forEach(commune => {
      const clat = commune.centre?.coordinates?.[1];
      const clon = commune.centre?.coordinates?.[0];
      if (!clat || !clon) return;

      const existing = currentBraderies.find(b => b.ville.toLowerCase() === commune.nom.toLowerCase());
      const color = existing ? NOTES[existing.note].mapColor : '#6b7280';
      const radius = existing ? 10 : 7;

      const marker = L.circleMarker([clat, clon], {
        radius, color, fillColor: color, fillOpacity: 0.75, weight: 2,
      }).addTo(map);

      const noteHtml = existing
        ? `<span style="color:${color};font-weight:600">${NOTES[existing.note].emoji} ${NOTES[existing.note].label}</span>`
        : '<span style="color:#6b7280">Non noté</span>';

      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:130px">
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">${commune.nom}</div>
          <div style="font-size:12px;margin-bottom:8px">${noteHtml}</div>
          <button id="btn-${commune.nom.replace(/\s/g, '_')}"
            style="background:#2563eb;color:white;border:none;border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;width:100%">
            📝 Noter cette ville
          </button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-${commune.nom.replace(/\s/g, '_')}`);
        if (btn) btn.addEventListener('click', () => {
          setQuickCity({ nom: commune.nom, cp: (commune.codesPostaux || [''])[0] });
          setQuickNote(existing?.note || '');
          setQuickComment(existing?.commentaire || '');
          setQuickQuartier('');
          marker.closePopup();
        });
      });

      markersLayerRef.current.push(marker);
    });
  }, []);

  /** Ouvre la modal carte et initialise Leaflet */
  const openMap = useCallback(() => {
    setShowMap(true);
    setMapError('');
    setQuickCity(null);
    setMapLoading(true);
  }, []);

  // Initialisation de la carte quand la modal est visible
  useEffect(() => {
    if (!showMap) {
      // Nettoyage
      if (leafletMapRef.current) { leafletMapRef.current.remove(); leafletMapRef.current = null; }
      markersLayerRef.current = [];
      userPosRef.current = null;
      return;
    }

    let cancelled = false;
    let storedCommunes = [];

    const init = () => {
      if (cancelled || !mapContainerRef.current) return;

      loadLeaflet(L => {
        if (cancelled || !mapContainerRef.current) return;
        if (leafletMapRef.current) return;

        if (!navigator.geolocation) {
          setMapError("La géolocalisation n'est pas disponible."); setMapLoading(false); return;
        }

        navigator.geolocation.getCurrentPosition(async pos => {
          if (cancelled || !mapContainerRef.current) return;
          const { latitude: lat, longitude: lon } = pos.coords;
          userPosRef.current = { lat, lon };

          // Fix icône par défaut Leaflet (cassée en Next.js)
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });

          const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([lat, lon], 12);
          leafletMapRef.current = map;

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 18,
          }).addTo(map);

          // Marqueur position utilisateur
          L.circleMarker([lat, lon], {
            radius: 10, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 3,
          }).addTo(map).bindPopup('<b>📍 Vous êtes ici</b>');

          // Légende
          const legend = L.control({ position: 'bottomleft' });
          legend.onAdd = () => {
            const div = L.DomUtil.create('div');
            div.innerHTML = `
              <div style="background:white;padding:8px 10px;border-radius:10px;font-size:11px;line-height:1.7;box-shadow:0 2px 8px rgba(0,0,0,.15)">
                <div><span style="color:#16a34a">●</span> Très bien</div>
                <div><span style="color:#ca8a04">●</span> Passable</div>
                <div><span style="color:#dc2626">●</span> À fuir</div>
                <div><span style="color:#6b7280">●</span> Non noté</div>
              </div>`;
            return div;
          };
          legend.addTo(map);

          // Chargement des communes proches
          try {
            const res = await fetch(`https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom,codesPostaux,centre&limit=60`);
            const data = await res.json();
            storedCommunes = data;
            if (!cancelled) drawMarkers(L, map, data, braderies);
          } catch { /* silencieux */ }

          setMapLoading(false);
        }, () => {
          setMapError('Accès à la localisation refusé. Autorise-le dans les réglages du navigateur.');
          setMapLoading(false);
        }, { enableHighAccuracy: false, timeout: 12000 });
      });
    };

    // Délai pour s'assurer que le DOM est rendu
    const t = setTimeout(init, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [showMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-dessiner les marqueurs quand braderies change (et que la carte est ouverte)
  useEffect(() => {
    if (!showMap || !leafletMapRef.current || !markersLayerRef.current) return;
    if (typeof window === 'undefined' || !window.L) return;
    // Récupérer les communes stockées dans le layer
    // On les re-fetch légèrement depuis les marqueurs existants via la carte
    if (!userPosRef.current) return;
    const { lat, lon } = userPosRef.current;
    fetch(`https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lon}&fields=nom,codesPostaux,centre&limit=60`)
      .then(r => r.json())
      .then(data => {
        if (leafletMapRef.current && window.L) drawMarkers(window.L, leafletMapRef.current, data, braderies);
      }).catch(() => {});
  }, [braderies, showMap, drawMarkers]);

  // ── Filtrage ──────────────────────────────────────────────────────────────

  const filtered = braderies.filter(b => {
    const matchNote = filtreNote === 'all' || b.note === filtreNote;
    const s = searchQuery.toLowerCase();
    const matchSearch = b.ville.toLowerCase().includes(s) || (b.quartier || '').toLowerCase().includes(s);
    return matchNote && matchSearch;
  });

  const stats = {
    total:     braderies.length,
    tres_bien: braderies.filter(b => b.note === 'tres_bien').length,
    passable:  braderies.filter(b => b.note === 'passable').length,
    a_fuir:    braderies.filter(b => b.note === 'a_fuir').length,
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const dm = darkMode;
  const pageBg = dm ? 'bg-gray-900' : 'bg-gray-50';
  const textMain = dm ? 'text-gray-100' : 'text-gray-800';
  const textSub = dm ? 'text-gray-400' : 'text-gray-500';
  const inputCls = dm
    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-400'
    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-blue-500';

  // ── Rendu carte braderie ──────────────────────────────────────────────────

  const renderCard = (b) => {
    const note = NOTES[b.note] || NOTES.passable;
    const noteDark = NOTES_DARK[b.note] || NOTES_DARK.passable;
    const isEdit = editingId === b.id;
    const isDel  = deletingId === b.id;
    const clr = dm ? `${noteDark.bg} ${noteDark.border}` : `${note.bg} ${note.border}`;
    const ns  = dm ? noteDark : note;

    if (isEdit) {
      return (
        <div key={b.id} className={`rounded-2xl border-2 p-4 ${clr}`}>
          <div className="space-y-2 mb-3">
            <VilleField value={editVille} onChange={setEditVille} darkMode={dm} inputCls={inputCls} placeholder="Ville..." />
            <input value={editQuartier} onChange={e => setEditQuartier(e.target.value)}
              placeholder="Quartier / secteur (optionnel)"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${inputCls}`} />
          </div>
          <div className="mb-3"><NoteSelector value={editNote} onChange={setEditNote} darkMode={dm} /></div>
          <textarea value={editComment} onChange={e => setEditComment(e.target.value)}
            placeholder="Commentaire (optionnel)" rows={2}
            className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3 ${inputCls}`} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditingId(null)}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <X size={14} /> Annuler
            </button>
            <button onClick={() => handleSaveEdit(b.id)}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white">
              <Check size={14} /> Enregistrer
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={b.id} className={`rounded-2xl border-2 p-4 ${clr} transition-all`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <button onClick={() => openGoogleMaps(b.ville, b.quartier)}
                className={`font-bold text-base hover:underline flex items-center gap-1 text-left leading-snug ${ns.text}`}>
                <MapPin size={15} className="shrink-0 mt-0.5" />
                <span>{b.ville}</span>
              </button>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold self-center ${ns.badgeBg} ${ns.badgeText}`}>
                {note.emoji} {note.label}
              </span>
            </div>
            {b.quartier && <p className={`text-sm font-medium mt-0.5 ml-5 ${ns.text}`}>{b.quartier}</p>}
            {b.commentaire && (
              <p className={`mt-1.5 text-sm flex items-start gap-1 ml-5 ${dm ? 'text-gray-300' : 'text-gray-600'}`}>
                <MessageSquare size={12} className="mt-0.5 shrink-0 opacity-60" />
                {b.commentaire}
              </p>
            )}
            <button onClick={() => openItineraire(b.ville, b.quartier)}
              className={`mt-2 ml-5 text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100 ${ns.text}`}>
              🗺️ Itinéraire
            </button>
          </div>
          <div className="flex gap-1 shrink-0">
            {isDel ? (
              <div className="flex gap-1">
                <button onClick={() => handleDelete(b.id)} className="px-2 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold">Oui</button>
                <button onClick={() => setDeletingId(null)} className={`p-1.5 rounded-lg ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}><X size={14} /></button>
              </div>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => startEdit(b)} className={`p-2 rounded-lg min-w-[36px] min-h-[36px] ${dm ? 'bg-gray-700 text-gray-300' : 'bg-white border border-gray-200 text-gray-500'}`}><Edit2 size={14} /></button>
                <button onClick={() => setDeletingId(b.id)} className={`p-2 rounded-lg min-w-[36px] min-h-[36px] ${dm ? 'bg-gray-700 text-red-400' : 'bg-white border border-gray-200 text-red-400'}`}><Trash2 size={14} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen ${pageBg} ${textMain} font-sans`}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl font-medium text-sm whitespace-nowrap ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* ── Modal Carte ── */}
      {showMap && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black">

          {/* Header de la modal */}
          <div className={`flex items-center justify-between px-4 py-3 shrink-0 ${dm ? 'bg-gray-900' : 'bg-white'} border-b ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
            <div>
              <h2 className={`text-base font-bold flex items-center gap-2 ${textMain}`}>
                <Map size={18} className="text-blue-500" /> Carte des braderies
              </h2>
              <p className={`text-xs ${textSub}`}>Clique sur une ville pour la noter</p>
            </div>
            <button onClick={() => { setShowMap(false); setQuickCity(null); }}
              className={`p-2.5 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
              <X size={20} />
            </button>
          </div>

          {/* Carte */}
          <div className="flex-1 relative min-h-0">
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            {mapLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/90 gap-3">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-600 font-medium">Localisation en cours…</p>
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center max-w-sm">
                  <p className="text-red-600 text-sm font-medium">{mapError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Panneau formulaire rapide (glisse depuis le bas) */}
          {quickCity && (
            <div className={`shrink-0 border-t px-4 py-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
              <p className={`font-semibold text-sm mb-3 flex items-center gap-1.5 ${textMain}`}>
                <MapPin size={14} className="text-blue-500 shrink-0" />
                {quickCity.nom}
                <span className={`text-xs font-normal ${textSub}`}>{quickCity.cp}</span>
              </p>
              <input value={quickQuartier} onChange={e => setQuickQuartier(e.target.value)}
                placeholder="Quartier / secteur (optionnel)"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3 ${inputCls}`} />
              <div className="mb-3"><NoteSelector value={quickNote} onChange={setQuickNote} darkMode={dm} /></div>
              <textarea value={quickComment} onChange={e => setQuickComment(e.target.value)}
                placeholder="Commentaire (optionnel)" rows={2}
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3 ${inputCls}`} />
              <div className="flex gap-2">
                <button onClick={() => { setQuickCity(null); setQuickNote(''); setQuickComment(''); setQuickQuartier(''); }}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium min-h-[48px] ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                  Annuler
                </button>
                <button onClick={handleQuickSave} disabled={!quickNote || quickLoading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]">
                  {quickLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={15} />}
                  Enregistrer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div className={`sticky top-0 z-30 border-b shadow-sm ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center gap-2">

          {/* Bouton retour accueil — icône flèche grise uniquement */}
          <button onClick={() => router.push('/')}
            className={`p-2.5 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0 transition ${dm ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-transparent text-gray-400 hover:bg-gray-100'}`}
            title="Retour à l'accueil">
            <ArrowLeft size={20} />
          </button>

          {/* Titre */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-xl shrink-0">🏪</span>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">Mes Braderies</h1>
              <p className={`text-xs ${textSub} leading-none`}>{stats.total} enregistrée{stats.total > 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={toggleDarkMode}
              className={`p-2.5 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center ${dm ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600'}`}>
              {dm ? '☀️' : '🌙'}
            </button>
            <button onClick={openMap}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold min-h-[40px] transition ${dm ? 'bg-indigo-700 text-white hover:bg-indigo-600' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}>
              <Map size={15} />
              Carte
            </button>
            <button onClick={() => { setShowForm(v => !v); resetForm(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white min-h-[40px] hover:bg-blue-700 transition">
              <Plus size={15} />
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 py-4 space-y-4">

        {/* Statistiques */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'tres_bien', count: stats.tres_bien, note: NOTES.tres_bien, dark: NOTES_DARK.tres_bien },
            { key: 'passable',  count: stats.passable,  note: NOTES.passable,  dark: NOTES_DARK.passable  },
            { key: 'a_fuir',    count: stats.a_fuir,    note: NOTES.a_fuir,    dark: NOTES_DARK.a_fuir    },
          ].map(({ key, count, note, dark }) => {
            const n = dm ? dark : note;
            return (
              <button key={key} onClick={() => setFiltreNote(filtreNote === key ? 'all' : key)}
                className={`rounded-2xl border-2 p-3 text-center transition active:scale-95 ${n.bg} ${n.border} ${filtreNote === key ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}>
                <div className={`text-2xl font-bold ${n.text}`}>{count}</div>
                <div className={`text-xs font-medium mt-0.5 ${n.text}`}>{note.emoji} {note.label}</div>
              </button>
            );
          })}
        </div>

        {/* Formulaire ajout */}
        {showForm && (
          <div className={`rounded-2xl border-2 p-4 ${dm ? 'bg-gray-800 border-gray-600' : 'bg-blue-50 border-blue-200'}`}>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Plus size={16} className="text-blue-500" /> Nouvelle braderie
            </h2>
            <div className="space-y-2 mb-3">
              <VilleField value={formVille} onChange={setFormVille} darkMode={dm} inputCls={inputCls} placeholder="Ville..." autoFocus />
              <input value={formQuartier} onChange={e => setFormQuartier(e.target.value)}
                placeholder="Quartier / secteur (ex: Sainte-Thérèse)"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${inputCls}`} />
            </div>
            <div className="mb-3"><NoteSelector value={formNote} onChange={setFormNote} darkMode={dm} /></div>
            <textarea value={formComment} onChange={e => setFormComment(e.target.value)}
              placeholder="Commentaire (parking, horaires, bons coins…)" rows={2}
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3 ${inputCls}`} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ${dm ? 'bg-gray-700 text-gray-300' : 'bg-white border border-gray-300 text-gray-600'}`}>
                Annuler
              </button>
              <button onClick={handleAdd} disabled={formLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white flex items-center gap-2 disabled:opacity-60 min-h-[44px]">
                {formLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={15} />}
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {/* Recherche */}
        <div className="relative">
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${textSub}`} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Ville, quartier…"
            className={`w-full border rounded-2xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${inputCls}`} />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 ${textSub}`}><X size={16} /></button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTRE_OPTIONS.map(f => (
            <button key={f.value} onClick={() => setFiltreNote(f.value)}
              className={`shrink-0 px-3 py-2 rounded-full text-xs font-semibold border transition min-h-[36px] ${filtreNote === f.value ? 'bg-blue-600 text-white border-blue-600' : dm ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-gray-600 border-gray-300'}`}>
              {f.emoji} {f.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className={`rounded-2xl border-2 h-24 animate-pulse ${dm ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`text-center py-16 ${textSub}`}>
            <span className="text-5xl block mb-3">🏪</span>
            <p className="font-medium text-base">{braderies.length === 0 ? 'Aucune braderie enregistrée' : 'Aucun résultat'}</p>
            {braderies.length === 0 && <p className={`text-sm mt-1 ${textSub}`}>Clique sur Ajouter ou Carte !</p>}
          </div>
        ) : (
          <div className="space-y-3">{filtered.map(b => renderCard(b))}</div>
        )}

        {filtered.length > 0 && (
          <p className={`text-center text-xs py-2 ${textSub}`}>
            {filtered.length} braderie{filtered.length > 1 ? 's' : ''}
            {filtreNote !== 'all' || searchQuery ? ` sur ${braderies.length}` : ''}
          </p>
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
