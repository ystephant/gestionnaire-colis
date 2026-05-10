/**
 * PAGE BRADERIES
 *
 * SQL Supabase :
 *
 * create table braderies (
 *   id uuid default gen_random_uuid() primary key,
 *   ville text not null,
 *   quartier text,
 *   note text not null check (note in ('a_fuir', 'passable', 'tres_bien')),
 *   commentaire text,
 *   created_at timestamp with time zone default now()
 * );
 * alter table braderies enable row level security;
 * create policy "Allow all" on braderies for all using (true) with check (true);
 *
 * Si la table existe deja, ajouter la colonne quartier :
 * ALTER TABLE braderies ADD COLUMN quartier text;
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, Check, X, MapPin, MessageSquare, Navigation } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NOTES = {
  a_fuir:   { label: 'A fuir',    emoji: '🚫', bg: 'bg-red-100',   border: 'border-red-300',    text: 'text-red-700',    badgeBg: 'bg-red-200',    badgeText: 'text-red-800'    },
  passable:  { label: 'Passable',  emoji: '😐', bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', badgeBg: 'bg-yellow-200', badgeText: 'text-yellow-800' },
  tres_bien: { label: 'Tres bien', emoji: '✅', bg: 'bg-green-100', border: 'border-green-300',  text: 'text-green-700',  badgeBg: 'bg-green-200',  badgeText: 'text-green-800'  },
};

const NOTES_DARK = {
  a_fuir:   { bg: 'bg-red-950',    border: 'border-red-800',    text: 'text-red-300',    badgeBg: 'bg-red-900',    badgeText: 'text-red-200'    },
  passable:  { bg: 'bg-yellow-950', border: 'border-yellow-800', text: 'text-yellow-300', badgeBg: 'bg-yellow-900', badgeText: 'text-yellow-200' },
  tres_bien: { bg: 'bg-green-950',  border: 'border-green-800',  text: 'text-green-300',  badgeBg: 'bg-green-900',  badgeText: 'text-green-200'  },
};

const FILTRE_OPTIONS = [
  { value: 'all',       label: 'Toutes',    emoji: '🗺️' },
  { value: 'tres_bien', label: 'Tres bien', emoji: '✅' },
  { value: 'passable',  label: 'Passable',  emoji: '😐' },
  { value: 'a_fuir',    label: 'A fuir',    emoji: '🚫' },
];

function buildMapsQuery(ville, quartier) {
  return quartier ? ('braderie ' + quartier + ' ' + ville + ', France') : ('braderie ' + ville + ', France');
}

function openGoogleMaps(ville, quartier) {
  var q = encodeURIComponent(buildMapsQuery(ville, quartier));
  window.open('https://www.google.com/maps/search/?api=1&query=' + q, '_blank');
}

function openItineraire(ville, quartier) {
  var dest = encodeURIComponent((quartier ? quartier + ', ' : '') + ville + ', France');
  window.open('https://www.google.com/maps/dir/?api=1&destination=' + dest, '_blank');
}

function haversine(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km) {
  if (km < 1) return Math.round(km * 1000) + ' m';
  return km.toFixed(1) + ' km';
}

// Champ avec autocompletion
function VilleField({ value, onChange, darkMode, inputCls, placeholder, autoFocus }) {
  var [suggestions, setSuggestions]   = useState([]);
  var [showDrop, setShowDrop]         = useState(false);
  var [loading, setLoading]           = useState(false);
  var debounce                        = useRef(null);
  var wrapRef                         = useRef(null);

  useEffect(function() {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false);
    }
    document.addEventListener('mousedown', handler);
    return function() { document.removeEventListener('mousedown', handler); };
  }, []);

  function handleInput(val) {
    onChange(val);
    clearTimeout(debounce.current);
    if (!val || val.length < 2) { setSuggestions([]); setShowDrop(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async function() {
      try {
        var res  = await fetch('https://geo.api.gouv.fr/communes?nom=' + encodeURIComponent(val) + '&fields=nom,codesPostaux,departement&limit=8&boost=population');
        var data = await res.json();
        var list = data.map(function(c) {
          return { nom: c.nom, cp: (c.codesPostaux || [''])[0], dept: (c.departement || {}).nom || '' };
        });
        setSuggestions(list);
        setShowDrop(list.length > 0);
      } catch(e) { setSuggestions([]); }
      finally { setLoading(false); }
    }, 250);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        value={value}
        onChange={function(e) { handleInput(e.target.value); }}
        onFocus={function() { if (suggestions.length > 0) setShowDrop(true); }}
        placeholder={placeholder || 'Ville...'}
        autoFocus={autoFocus || false}
        className={'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ' + inputCls}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {showDrop && suggestions.length > 0 && (
        <ul className={'absolute z-50 w-full mt-1 rounded-xl border shadow-xl overflow-hidden ' + (darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200')}>
          {suggestions.map(function(s, i) {
            return (
              <li key={i}>
                <button
                  onMouseDown={function(e) { e.preventDefault(); onChange(s.nom); setShowDrop(false); setSuggestions([]); }}
                  className={'w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition ' + (darkMode ? 'hover:bg-gray-700 text-gray-100' : 'hover:bg-blue-50 text-gray-800')}>
                  <span className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400 shrink-0" />
                    <span className="font-medium">{s.nom}</span>
                  </span>
                  <span className={'text-xs shrink-0 ' + (darkMode ? 'text-gray-400' : 'text-gray-400')}>
                    {s.cp}{s.dept ? ' - ' + s.dept : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Formulaire note (boutons)
function NoteSelector({ value, onChange, darkMode }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Object.entries(NOTES).map(function(entry) {
        var key = entry[0]; var n = entry[1];
        var active = value === key;
        return (
          <button key={key} onClick={function() { onChange(key); }}
            className={'px-3 py-2 rounded-xl text-sm font-medium border-2 transition ' +
              (active
                ? n.badgeBg + ' ' + n.badgeText + ' border-current scale-105 shadow'
                : (darkMode ? 'bg-gray-700 text-gray-300 border-gray-600 hover:border-gray-400' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'))}>
            {n.emoji} {n.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Braderies() {
  var [darkMode, setDarkMode]         = useState(false);
  var [braderies, setBraderies]       = useState([]);
  var [loading, setLoading]           = useState(true);
  var [searchQuery, setSearchQuery]   = useState('');
  var [filtreNote, setFiltreNote]     = useState('all');

  // Formulaire ajout
  var [showForm, setShowForm]             = useState(false);
  var [formVille, setFormVille]           = useState('');
  var [formQuartier, setFormQuartier]     = useState('');
  var [formNote, setFormNote]             = useState('');
  var [formComment, setFormComment]       = useState('');
  var [formLoading, setFormLoading]       = useState(false);

  // Edition inline
  var [editingId, setEditingId]           = useState(null);
  var [editVille, setEditVille]           = useState('');
  var [editQuartier, setEditQuartier]     = useState('');
  var [editNote, setEditNote]             = useState('');
  var [editComment, setEditComment]       = useState('');

  // Suppression
  var [deletingId, setDeletingId]         = useState(null);

  // Modal villes proches
  var [showNearby, setShowNearby]         = useState(false);
  var [nearbyLoading, setNearbyLoading]   = useState(false);
  var [nearbyError, setNearbyError]       = useState('');
  var [nearbyCities, setNearbyCities]     = useState([]);
  var [nearbyRadius, setNearbyRadius]     = useState(20);

  // Formulaire rapide (villes proches)
  var [quickCity, setQuickCity]           = useState(null);
  var [quickQuartier, setQuickQuartier]   = useState('');
  var [quickNote, setQuickNote]           = useState('');
  var [quickComment, setQuickComment]     = useState('');
  var [quickLoading, setQuickLoading]     = useState(false);

  var [toast, setToast]   = useState(null);
  var toastTimer          = useRef(null);

  useEffect(function() {
    var saved = localStorage.getItem('darkMode');
    if (saved !== null) setDarkMode(saved === 'true');
  }, []);

  function toggleDarkMode() {
    setDarkMode(function(prev) { localStorage.setItem('darkMode', String(!prev)); return !prev; });
  }

  function showToast(msg, type) {
    if (!type) type = 'success';
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message: msg, type: type });
    toastTimer.current = setTimeout(function() { setToast(null); }, 3000);
  }

  var loadBraderies = useCallback(async function() {
    setLoading(true);
    try {
      var r = await supabase.from('braderies').select('*').order('created_at', { ascending: false });
      if (r.error) throw r.error;
      setBraderies(r.data || []);
    } catch(e) { showToast('Erreur de chargement', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(function() { loadBraderies(); }, [loadBraderies]);

  useEffect(function() {
    var ch = supabase.channel('braderies-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'braderies' }, function() { loadBraderies(); })
      .subscribe();
    return function() { supabase.removeChannel(ch); };
  }, [loadBraderies]);

  function resetForm() { setFormVille(''); setFormQuartier(''); setFormNote(''); setFormComment(''); }

  async function handleAdd() {
    if (!formVille.trim() || !formNote) { showToast('Remplis la ville et la note', 'error'); return; }
    setFormLoading(true);
    try {
      var r = await supabase.from('braderies').insert({
        ville: formVille.trim(),
        quartier: formQuartier.trim() || null,
        note: formNote,
        commentaire: formComment.trim() || null,
      });
      if (r.error) throw r.error;
      resetForm(); setShowForm(false);
      showToast((formQuartier ? formQuartier + ' (' + formVille + ')' : formVille) + ' ajoutee ! 🎉');
    } catch(e) { showToast("Erreur lors de l'ajout", 'error'); }
    finally { setFormLoading(false); }
  }

  function startEdit(b) {
    setEditingId(b.id);
    setEditVille(b.ville);
    setEditQuartier(b.quartier || '');
    setEditNote(b.note);
    setEditComment(b.commentaire || '');
  }

  async function handleSaveEdit(id) {
    if (!editVille.trim() || !editNote) return;
    try {
      var r = await supabase.from('braderies').update({
        ville: editVille.trim(),
        quartier: editQuartier.trim() || null,
        note: editNote,
        commentaire: editComment.trim() || null,
      }).eq('id', id);
      if (r.error) throw r.error;
      setEditingId(null); showToast('Modifie ✅');
    } catch(e) { showToast('Erreur modification', 'error'); }
  }

  async function handleDelete(id) {
    try {
      var r = await supabase.from('braderies').delete().eq('id', id);
      if (r.error) throw r.error;
      setDeletingId(null); showToast('Supprime 🗑️');
    } catch(e) { showToast('Erreur suppression', 'error'); }
  }

  function openNearby() {
    setShowNearby(true); setNearbyError(''); setNearbyCities([]); setQuickCity(null);
    loadNearbyCities(nearbyRadius);
  }

  function loadNearbyCities(radius) {
    setNearbyLoading(true); setNearbyError(''); setNearbyCities([]);
    if (!navigator.geolocation) {
      setNearbyError('Geolocalisation non disponible.');
      setNearbyLoading(false); return;
    }
    navigator.geolocation.getCurrentPosition(
      async function(pos) {
        var lat = pos.coords.latitude; var lon = pos.coords.longitude;
        try {
          var res  = await fetch('https://geo.api.gouv.fr/communes?lat=' + lat + '&lon=' + lon + '&fields=nom,codesPostaux,centre,departement&limit=50');
          var data = await res.json();
          var list = data.map(function(c) {
            var clat = c.centre && c.centre.coordinates ? c.centre.coordinates[1] : null;
            var clon = c.centre && c.centre.coordinates ? c.centre.coordinates[0] : null;
            var dist = (clat && clon) ? haversine(lat, lon, clat, clon) : 999;
            return { nom: c.nom, cp: (c.codesPostaux || [''])[0], dist: dist };
          }).filter(function(c) { return c.dist <= radius; }).sort(function(a, b) { return a.dist - b.dist; });
          setNearbyCities(list);
          if (list.length === 0) setNearbyError('Aucune commune dans un rayon de ' + radius + ' km.');
        } catch(e) { setNearbyError('Erreur lors du chargement.'); }
        finally { setNearbyLoading(false); }
      },
      function(err) {
        setNearbyLoading(false);
        setNearbyError(err.code === 1 ? 'Acces a la localisation refuse.' : 'Impossible de te localiser.');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function handleQuickSave() {
    if (!quickCity || !quickNote) { showToast('Choisis une note', 'error'); return; }
    setQuickLoading(true);
    try {
      var existing = braderies.find(function(b) {
        return b.ville.toLowerCase() === quickCity.nom.toLowerCase() &&
          (b.quartier || '').toLowerCase() === quickQuartier.trim().toLowerCase();
      });
      var payload = {
        ville: quickCity.nom,
        quartier: quickQuartier.trim() || null,
        note: quickNote,
        commentaire: quickComment.trim() || null,
      };
      if (existing) {
        var r1 = await supabase.from('braderies').update({ note: quickNote, quartier: quickQuartier.trim() || null, commentaire: quickComment.trim() || null }).eq('id', existing.id);
        if (r1.error) throw r1.error;
        showToast(quickCity.nom + ' mis a jour ✅');
      } else {
        var r2 = await supabase.from('braderies').insert(payload);
        if (r2.error) throw r2.error;
        showToast(quickCity.nom + ' ajoutee ! 🎉');
      }
      setQuickCity(null); setQuickQuartier(''); setQuickNote(''); setQuickComment('');
    } catch(e) { showToast('Erreur sauvegarde', 'error'); }
    finally { setQuickLoading(false); }
  }

  var filtered = braderies.filter(function(b) {
    var matchNote   = filtreNote === 'all' || b.note === filtreNote;
    var search      = searchQuery.toLowerCase();
    var matchSearch = b.ville.toLowerCase().indexOf(search) !== -1 ||
                      (b.quartier || '').toLowerCase().indexOf(search) !== -1;
    return matchNote && matchSearch;
  });

  var stats = {
    total:     braderies.length,
    tres_bien: braderies.filter(function(b) { return b.note === 'tres_bien'; }).length,
    passable:  braderies.filter(function(b) { return b.note === 'passable';  }).length,
    a_fuir:    braderies.filter(function(b) { return b.note === 'a_fuir';    }).length,
  };

  var dm       = darkMode;
  var pageBg   = dm ? 'bg-gray-900' : 'bg-gray-50';
  var textMain = dm ? 'text-gray-100' : 'text-gray-800';
  var textSub  = dm ? 'text-gray-400' : 'text-gray-500';
  var cardBase = dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  var inputCls = dm
    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-400'
    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-blue-500';

  function renderCard(b) {
    var note     = NOTES[b.note]      || NOTES.passable;
    var noteDark = NOTES_DARK[b.note] || NOTES_DARK.passable;
    var isEdit   = editingId  === b.id;
    var isDel    = deletingId === b.id;
    var clr      = dm ? (noteDark.bg + ' ' + noteDark.border) : (note.bg + ' ' + note.border);
    var ns       = dm ? noteDark : note;

    if (isEdit) {
      return (
        <div key={b.id} className={'rounded-2xl border-2 p-4 ' + clr}>
          <div className="space-y-2 mb-3">
            <VilleField value={editVille} onChange={setEditVille} darkMode={dm} inputCls={inputCls} placeholder="Ville..." />
            <input
              value={editQuartier}
              onChange={function(e) { setEditQuartier(e.target.value); }}
              placeholder="Quartier / secteur (optionnel)"
              className={'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ' + inputCls}
            />
          </div>
          <div className="mb-3">
            <NoteSelector value={editNote} onChange={setEditNote} darkMode={dm} />
          </div>
          <textarea value={editComment} onChange={function(e) { setEditComment(e.target.value); }}
            placeholder="Commentaire (optionnel)" rows={2}
            className={'w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3 ' + inputCls} />
          <div className="flex gap-2 justify-end">
            <button onClick={function() { setEditingId(null); }}
              className={'flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition min-h-[40px] ' + (dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
              <X size={14} /> Annuler
            </button>
            <button onClick={function() { handleSaveEdit(b.id); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white min-h-[40px]">
              <Check size={14} /> Enregistrer
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={b.id} className={'rounded-2xl border-2 p-4 ' + clr + ' transition-all'}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Titre : ville + badge */}
            <div className="flex items-start gap-2 flex-wrap">
              <button onClick={function() { openGoogleMaps(b.ville, b.quartier); }}
                className={'font-bold text-base hover:underline flex items-center gap-1 text-left leading-snug ' + ns.text}>
                <MapPin size={15} className="shrink-0 mt-0.5" />
                <span>{b.ville}</span>
              </button>
              <span className={'px-2.5 py-0.5 rounded-full text-xs font-semibold self-center ' + ns.badgeBg + ' ' + ns.badgeText}>
                {note.emoji} {note.label}
              </span>
            </div>

            {/* Quartier */}
            {b.quartier && (
              <p className={'text-sm font-medium mt-0.5 ml-5 ' + ns.text}>
                {b.quartier}
              </p>
            )}

            {/* Commentaire */}
            {b.commentaire && (
              <p className={'mt-1.5 text-sm flex items-start gap-1 ml-5 ' + (dm ? 'text-gray-300' : 'text-gray-600')}>
                <MessageSquare size={12} className="mt-0.5 shrink-0 opacity-60" />
                {b.commentaire}
              </p>
            )}

            {/* Lien itineraire */}
            <button onClick={function() { openItineraire(b.ville, b.quartier); }}
              className={'mt-2 ml-5 text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100 ' + ns.text}>
              🗺️ Itineraire
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            {isDel ? (
              <div className="flex gap-1">
                <button onClick={function() { handleDelete(b.id); }}
                  className="px-2 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold min-h-[36px]">
                  Oui
                </button>
                <button onClick={function() { setDeletingId(null); }}
                  className={'p-1.5 rounded-lg min-h-[36px] ' + (dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500')}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex gap-1">
                <button onClick={function() { startEdit(b); }}
                  className={'p-2 rounded-lg min-h-[36px] min-w-[36px] transition ' + (dm ? 'bg-gray-700 text-gray-300' : 'bg-white border border-gray-200 text-gray-500')}>
                  <Edit2 size={14} />
                </button>
                <button onClick={function() { setDeletingId(b.id); }}
                  className={'p-2 rounded-lg min-h-[36px] min-w-[36px] transition ' + (dm ? 'bg-gray-700 text-red-400' : 'bg-white border border-gray-200 text-red-400')}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={'min-h-screen ' + pageBg + ' ' + textMain + ' font-sans'}>

      {/* Toast */}
      {toast && (
        <div className={'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl font-medium text-sm whitespace-nowrap ' + (toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white')}>
          {toast.message}
        </div>
      )}

      {/* ── Modal Villes proches ── */}
      {showNearby && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div className={'mt-auto w-full rounded-t-3xl flex flex-col ' + (dm ? 'bg-gray-900' : 'bg-white')} style={{ maxHeight: '92vh' }}>

            {/* Header */}
            <div className={'flex items-center justify-between px-4 pt-5 pb-3 border-b ' + (dm ? 'border-gray-700' : 'border-gray-200')}>
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Navigation size={18} className="text-blue-500" /> Villes a proximite
                </h2>
                <p className={'text-xs mt-0.5 ' + textSub}>Selectionne une ville pour lui donner une note</p>
              </div>
              <button onClick={function() { setShowNearby(false); setQuickCity(null); }}
                className={'p-2.5 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center ' + (dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500')}>
                <X size={20} />
              </button>
            </div>

            {/* Rayon */}
            <div className={'px-4 py-3 border-b ' + (dm ? 'border-gray-700' : 'border-gray-100')}>
              <p className={'text-xs font-semibold mb-2 ' + textSub}>Rayon de recherche</p>
              <div className="flex gap-2">
                {[5, 10, 20, 40].map(function(r) {
                  return (
                    <button key={r} onClick={function() { setNearbyRadius(r); loadNearbyCities(r); }}
                      className={'flex-1 py-2 rounded-full text-sm font-semibold border transition min-h-[40px] ' +
                        (nearbyRadius === r ? 'bg-blue-600 text-white border-blue-600' : (dm ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-gray-600 border-gray-300'))}>
                      {r} km
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Liste villes */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {nearbyLoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className={'text-sm ' + textSub}>Localisation...</p>
                </div>
              )}
              {!nearbyLoading && nearbyError && (
                <div className={'rounded-2xl p-4 text-center text-sm ' + (dm ? 'bg-red-950 text-red-300' : 'bg-red-50 text-red-600')}>
                  {nearbyError}
                </div>
              )}
              {!nearbyLoading && nearbyCities.map(function(city) {
                var existing   = braderies.filter(function(b) { return b.ville.toLowerCase() === city.nom.toLowerCase(); });
                var isSelected = quickCity && quickCity.nom === city.nom;
                var hasMult    = existing.length > 1;
                var cardCls    = isSelected
                  ? ('border-blue-500 ' + (dm ? 'bg-blue-950' : 'bg-blue-50'))
                  : (dm ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200');

                return (
                  <button key={city.nom + city.cp}
                    onClick={function() {
                      if (isSelected) { setQuickCity(null); setQuickQuartier(''); setQuickNote(''); setQuickComment(''); }
                      else {
                        setQuickCity(city);
                        setQuickQuartier('');
                        if (existing.length === 1) { setQuickNote(existing[0].note); setQuickComment(existing[0].commentaire || ''); }
                        else { setQuickNote(''); setQuickComment(''); }
                      }
                    }}
                    className={'w-full text-left rounded-2xl border-2 p-3 transition ' + cardCls}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={14} className={'shrink-0 ' + textSub} />
                        <div className="min-w-0">
                          <span className="font-semibold text-sm">{city.nom}</span>
                          <span className={'ml-1.5 text-xs ' + textSub}>{city.cp}</span>
                          {hasMult && (
                            <span className={'ml-1.5 text-xs px-1.5 py-0.5 rounded-full ' + (dm ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                              {existing.length} zones
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {existing.length === 1 && (
                          <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' +
                            (dm ? (NOTES_DARK[existing[0].note].badgeBg + ' ' + NOTES_DARK[existing[0].note].badgeText) : (NOTES[existing[0].note].badgeBg + ' ' + NOTES[existing[0].note].badgeText))}>
                            {NOTES[existing[0].note].emoji}
                          </span>
                        )}
                        <span className={'text-xs font-medium ' + textSub}>{formatDist(city.dist)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Formulaire rapide */}
            {quickCity && (
              <div className={'border-t px-4 py-4 ' + (dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50')}>
                <p className="font-semibold text-sm mb-3 flex items-center gap-1">
                  <MapPin size={14} className="text-blue-500 shrink-0" />
                  {quickCity.nom}
                  <span className={'text-xs font-normal ml-1 ' + textSub}>{quickCity.cp}</span>
                </p>

                {/* Champ quartier */}
                <input
                  value={quickQuartier}
                  onChange={function(e) { setQuickQuartier(e.target.value); }}
                  placeholder="Quartier / secteur (optionnel)"
                  className={'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-3 ' + inputCls}
                />

                <div className="mb-3">
                  <NoteSelector value={quickNote} onChange={setQuickNote} darkMode={dm} />
                </div>

                <textarea value={quickComment} onChange={function(e) { setQuickComment(e.target.value); }}
                  placeholder="Commentaire (optionnel)" rows={2}
                  className={'w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3 ' + inputCls} />

                <div className="flex gap-2">
                  <button onClick={function() { setQuickCity(null); setQuickQuartier(''); setQuickNote(''); setQuickComment(''); }}
                    className={'flex-1 py-3 rounded-xl text-sm font-medium min-h-[48px] ' + (dm ? 'bg-gray-700 text-gray-300' : 'bg-white border border-gray-300 text-gray-600')}>
                    Annuler
                  </button>
                  <button onClick={handleQuickSave} disabled={!quickNote || quickLoading}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold bg-blue-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]">
                    {quickLoading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Check size={15} />}
                    Enregistrer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className={'sticky top-0 z-30 border-b shadow-sm ' + (dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center justify-between gap-2">
          {/* Titre */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">🏪</span>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">Mes Braderies</h1>
              <p className={'text-xs ' + textSub}>{stats.total} enregistree{stats.total > 1 ? 's' : ''}</p>
            </div>
          </div>
          {/* Boutons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={toggleDarkMode}
              className={'p-2.5 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center ' + (dm ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-600')}>
              {dm ? '☀️' : '🌙'}
            </button>
            <button onClick={openNearby}
              className={'flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold min-h-[40px] transition ' + (dm ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700')}>
              <Navigation size={15} />
              <span className="hidden xs:inline">Proches</span>
            </button>
            <button onClick={function() { setShowForm(function(v) { return !v; }); resetForm(); }}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white min-h-[40px]">
              <Plus size={15} />
              <span className="hidden xs:inline">Ajouter</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-3 py-4 space-y-4">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'tres_bien', count: stats.tres_bien, note: NOTES.tres_bien, dark: NOTES_DARK.tres_bien },
            { key: 'passable',  count: stats.passable,  note: NOTES.passable,  dark: NOTES_DARK.passable  },
            { key: 'a_fuir',    count: stats.a_fuir,    note: NOTES.a_fuir,    dark: NOTES_DARK.a_fuir    },
          ].map(function(item) {
            var n = dm ? item.dark : item.note;
            return (
              <button key={item.key}
                onClick={function() { setFiltreNote(filtreNote === item.key ? 'all' : item.key); }}
                className={'rounded-2xl border-2 p-3 text-center transition active:scale-95 ' + n.bg + ' ' + n.border + (filtreNote === item.key ? ' ring-2 ring-offset-1 ring-blue-500' : '')}>
                <div className={'text-2xl font-bold ' + n.text}>{item.count}</div>
                <div className={'text-xs font-medium mt-0.5 ' + n.text}>{item.note.emoji} {item.note.label}</div>
              </button>
            );
          })}
        </div>

        {/* Formulaire ajout */}
        {showForm && (
          <div className={'rounded-2xl border-2 p-4 ' + (dm ? 'bg-gray-800 border-gray-600' : 'bg-blue-50 border-blue-200')}>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Plus size={16} className="text-blue-500" /> Nouvelle braderie
            </h2>
            <div className="space-y-2 mb-3">
              <VilleField value={formVille} onChange={setFormVille} darkMode={dm} inputCls={inputCls} placeholder="Ville..." autoFocus={true} />
              <input
                value={formQuartier}
                onChange={function(e) { setFormQuartier(e.target.value); }}
                placeholder="Quartier / secteur (optionnel ex: Sainte-Therese)"
                className={'w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ' + inputCls}
              />
            </div>
            <div className="mb-3">
              <NoteSelector value={formNote} onChange={setFormNote} darkMode={dm} />
            </div>
            <textarea value={formComment} onChange={function(e) { setFormComment(e.target.value); }}
              placeholder="Commentaire (parking, horaires, bons coins...)" rows={2}
              className={'w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3 ' + inputCls} />
            <div className="flex gap-2 justify-end">
              <button onClick={function() { setShowForm(false); resetForm(); }}
                className={'px-4 py-2.5 rounded-xl text-sm font-medium min-h-[44px] ' + (dm ? 'bg-gray-700 text-gray-300' : 'bg-white border border-gray-300 text-gray-600')}>
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
          <Search size={16} className={'absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ' + textSub} />
          <input value={searchQuery} onChange={function(e) { setSearchQuery(e.target.value); }}
            placeholder="Ville, quartier..."
            className={'w-full border rounded-2xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ' + inputCls} />
          {searchQuery && (
            <button onClick={function() { setSearchQuery(''); }}
              className={'absolute right-3 top-1/2 -translate-y-1/2 p-1 ' + textSub}>
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filtres */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTRE_OPTIONS.map(function(f) {
            return (
              <button key={f.value} onClick={function() { setFiltreNote(f.value); }}
                className={'shrink-0 px-3 py-2 rounded-full text-xs font-semibold border transition min-h-[36px] ' +
                  (filtreNote === f.value ? 'bg-blue-600 text-white border-blue-600' : (dm ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-gray-600 border-gray-300'))}>
                {f.emoji} {f.label}
              </button>
            );
          })}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(function(i) {
              return <div key={i} className={'rounded-2xl border-2 h-24 animate-pulse ' + (dm ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200')} />;
            })}
          </div>
        ) : filtered.length === 0 ? (
          <div className={'text-center py-16 ' + textSub}>
            <span className="text-5xl block mb-3">🏪</span>
            <p className="font-medium text-base">
              {braderies.length === 0 ? 'Aucune braderie enregistree' : 'Aucun resultat'}
            </p>
            {braderies.length === 0 && <p className={'text-sm mt-1 ' + textSub}>Clique sur Ajouter ou Proches !</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(function(b) { return renderCard(b); })}
          </div>
        )}

        {filtered.length > 0 && (
          <p className={'text-center text-xs py-2 ' + textSub}>
            {filtered.length} braderie{filtered.length > 1 ? 's' : ''}
            {filtreNote !== 'all' || searchQuery ? ' sur ' + braderies.length : ''}
          </p>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
