/**
 * 🏪 PAGE BRADERIES — Suivi des braderies visitées
 *
 * ── TABLE SUPABASE À CRÉER ──────────────────────────────────────────────────
 *
 * create table braderies (
 *   id uuid default gen_random_uuid() primary key,
 *   ville text not null,
 *   note text not null check (note in ('a_fuir', 'passable', 'tres_bien')),
 *   commentaire text,
 *   created_at timestamp with time zone default now()
 * );
 *
 * -- RLS (optionnel mais recommandé)
 * alter table braderies enable row level security;
 * create policy "Allow all" on braderies for all using (true) with check (true);
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, Check, X, MapPin, MessageSquare, ChevronDown, Star } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Constantes ───────────────────────────────────────────────────────────────

const NOTES = {
  a_fuir:   { label: 'À fuir',    emoji: '🚫', bg: 'bg-red-100',    border: 'border-red-300',    text: 'text-red-700',    badgeBg: 'bg-red-200',    badgeText: 'text-red-800'    },
  passable:  { label: 'Passable',  emoji: '😐', bg: 'bg-yellow-50',  border: 'border-yellow-300', text: 'text-yellow-700', badgeBg: 'bg-yellow-200', badgeText: 'text-yellow-800' },
  tres_bien: { label: 'Très bien', emoji: '✅', bg: 'bg-green-100',  border: 'border-green-300',  text: 'text-green-700',  badgeBg: 'bg-green-200',  badgeText: 'text-green-800'  },
};

const NOTES_DARK = {
  a_fuir:   { bg: 'bg-red-950',    border: 'border-red-800',    text: 'text-red-300',    badgeBg: 'bg-red-900',    badgeText: 'text-red-200'    },
  passable:  { bg: 'bg-yellow-950', border: 'border-yellow-800', text: 'text-yellow-300', badgeBg: 'bg-yellow-900', badgeText: 'text-yellow-200' },
  tres_bien: { bg: 'bg-green-950',  border: 'border-green-800',  text: 'text-green-300',  badgeBg: 'bg-green-900',  badgeText: 'text-green-200'  },
};

const FILTRE_OPTIONS = [
  { value: 'all',       label: 'Toutes',     emoji: '🗺️' },
  { value: 'tres_bien', label: 'Très bien',  emoji: '✅' },
  { value: 'passable',  label: 'Passable',   emoji: '😐' },
  { value: 'a_fuir',    label: 'À fuir',     emoji: '🚫' },
];

// ── Utilitaires ──────────────────────────────────────────────────────────────

function openGoogleMaps(ville) {
  const query = encodeURIComponent(`braderie ${ville}, France`);
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
}

function openItineraire(ville) {
  const dest = encodeURIComponent(`${ville}, France`);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
}

// ── Composant principal ──────────────────────────────────────────────────────

export default function Braderies() {
  const [darkMode, setDarkMode]           = useState(false);
  const [braderies, setBraderies]         = useState([]);
  const [loading, setLoading]             = useState(true);

  // Recherche / filtre
  const [searchQuery, setSearchQuery]     = useState('');
  const [filtreNote, setFiltreNote]       = useState('all');

  // Formulaire d'ajout
  const [showForm, setShowForm]           = useState(false);
  const [formVille, setFormVille]         = useState('');
  const [formNote, setFormNote]           = useState('');
  const [formCommentaire, setFormCommentaire] = useState('');
  const [formLoading, setFormLoading]     = useState(false);

  // Autocomplétion ville
  const [villeSuggestions, setVilleSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions]   = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const suggestionRef = useRef(null);
  const villeInputRef = useRef(null);
  const debounceRef   = useRef(null);

  // Édition inline
  const [editingId, setEditingId]           = useState(null);
  const [editVille, setEditVille]           = useState('');
  const [editNote, setEditNote]             = useState('');
  const [editCommentaire, setEditCommentaire] = useState('');
  const [editSuggestions, setEditSuggestions] = useState([]);
  const [showEditSuggestions, setShowEditSuggestions] = useState(false);
  const editDebounceRef = useRef(null);

  // Suppression
  const [deletingId, setDeletingId]         = useState(null);

  // Toast
  const [toast, setToast]                   = useState(null);
  const toastTimer                          = useRef(null);

  // ── Chargement dark mode ─────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) setDarkMode(saved === 'true');
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      localStorage.setItem('darkMode', String(!prev));
      return !prev;
    });
  };

  // ── Toast ────────────────────────────────────────────────────────────────

  const showToast = (message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Supabase : chargement ────────────────────────────────────────────────

  const loadBraderies = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('braderies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBraderies(data || []);
    } catch (err) {
      console.error(err);
      showToast('Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBraderies(); }, [loadBraderies]);

  // ── Realtime ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('braderies-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'braderies' }, () => {
        loadBraderies();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadBraderies]);

  // ── Autocomplétion villes (API gouvernementale) ──────────────────────────

  const fetchVilleSuggestions = async (query, setter) => {
    if (!query || query.length < 2) { setter([]); return; }
    setSuggestionLoading(true);
    try {
      const url = `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,codesPostaux,departement&limit=8&boost=population`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setter(data.map(c => ({
        nom: c.nom,
        cp: c.codesPostaux?.[0] || '',
        dept: c.departement?.nom || '',
      })));
    } catch {
      setter([]);
    } finally {
      setSuggestionLoading(false);
    }
  };

  const handleVilleInput = (val, isEdit = false) => {
    if (isEdit) {
      setEditVille(val);
      clearTimeout(editDebounceRef.current);
      editDebounceRef.current = setTimeout(() => fetchVilleSuggestions(val, setEditSuggestions), 250);
      setShowEditSuggestions(true);
    } else {
      setFormVille(val);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchVilleSuggestions(val, setVilleSuggestions), 250);
      setShowSuggestions(true);
    }
  };

  // Fermer suggestions au clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
        setShowEditSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!formVille.trim() || !formNote) {
      showToast('Remplis le nom de la ville et la note', 'error');
      return;
    }
    setFormLoading(true);
    try {
      const { error } = await supabase.from('braderies').insert({
        ville: formVille.trim(),
        note: formNote,
        commentaire: formCommentaire.trim() || null,
      });
      if (error) throw error;
      setFormVille(''); setFormNote(''); setFormCommentaire('');
      setShowForm(false);
      showToast(`${formVille} ajoutée ! 🎉`);
    } catch (err) {
      console.error(err);
      showToast('Erreur lors de l\'ajout', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const startEdit = (b) => {
    setEditingId(b.id);
    setEditVille(b.ville);
    setEditNote(b.note);
    setEditCommentaire(b.commentaire || '');
    setEditSuggestions([]);
    setShowEditSuggestions(false);
  };

  const handleSaveEdit = async (id) => {
    if (!editVille.trim() || !editNote) return;
    try {
      const { error } = await supabase.from('braderies').update({
        ville: editVille.trim(),
        note: editNote,
        commentaire: editCommentaire.trim() || null,
      }).eq('id', id);
      if (error) throw error;
      setEditingId(null);
      showToast('Modifié ✅');
    } catch (err) {
      console.error(err);
      showToast('Erreur modification', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('braderies').delete().eq('id', id);
      if (error) throw error;
      setDeletingId(null);
      showToast('Supprimé 🗑️');
    } catch (err) {
      console.error(err);
      showToast('Erreur suppression', 'error');
    }
  };

  // ── Filtrage ──────────────────────────────────────────────────────────────

  const filtered = braderies.filter(b => {
    const matchNote = filtreNote === 'all' || b.note === filtreNote;
    const matchSearch = b.ville.toLowerCase().includes(searchQuery.toLowerCase());
    return matchNote && matchSearch;
  });

  // ── Statistiques ──────────────────────────────────────────────────────────

  const stats = {
    total:     braderies.length,
    tres_bien: braderies.filter(b => b.note === 'tres_bien').length,
    passable:  braderies.filter(b => b.note === 'passable').length,
    a_fuir:    braderies.filter(b => b.note === 'a_fuir').length,
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const dm = darkMode;
  const cardBg    = dm ? 'bg-gray-800' : 'bg-white';
  const pageBg    = dm ? 'bg-gray-900' : 'bg-gray-50';
  const textMain  = dm ? 'text-gray-100' : 'text-gray-800';
  const textSub   = dm ? 'text-gray-400' : 'text-gray-500';
  const inputCls  = dm
    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-400'
    : 'bg-white border-gray-300 text-gray-800 placeholder-gray-400 focus:border-blue-500';
  const btnPrimary = 'bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-4 py-2 transition flex items-center gap-2';

  // ── Rendu d'une carte braderie ────────────────────────────────────────────

  const renderCard = (b) => {
    const note      = NOTES[b.note]      || NOTES.passable;
    const noteDark  = NOTES_DARK[b.note] || NOTES_DARK.passable;
    const isEditing = editingId === b.id;
    const isDeleting = deletingId === b.id;

    const cardColor = dm
      ? `${noteDark.bg} ${noteDark.border}`
      : `${note.bg} ${note.border}`;

    if (isEditing) {
      return (
        <div key={b.id} className={`rounded-2xl border-2 p-4 ${cardColor} transition-all`}>
          {/* Champ ville avec autocomplétion */}
          <div className="relative mb-3" ref={suggestionRef}>
            <input
              value={editVille}
              onChange={e => handleVilleInput(e.target.value, true)}
              onFocus={() => editVille.length >= 2 && setShowEditSuggestions(true)}
              placeholder="Nom de la ville"
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${inputCls}`}
            />
            {showEditSuggestions && editSuggestions.length > 0 && (
              <SuggestionDropdown
                suggestions={editSuggestions}
                onSelect={s => { setEditVille(s.nom); setShowEditSuggestions(false); setEditSuggestions([]); }}
                darkMode={dm}
              />
            )}
          </div>

          {/* Note */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {Object.entries(NOTES).map(([key, n]) => (
              <button
                key={key}
                onClick={() => setEditNote(key)}
                className={`px-3 py-1 rounded-full text-sm font-medium border-2 transition ${
                  editNote === key
                    ? `${n.badgeBg} ${n.badgeText} border-current scale-105 shadow`
                    : dm ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-white text-gray-500 border-gray-300'
                }`}
              >
                {n.emoji} {n.label}
              </button>
            ))}
          </div>

          {/* Commentaire */}
          <textarea
            value={editCommentaire}
            onChange={e => setEditCommentaire(e.target.value)}
            placeholder="Commentaire (optionnel)"
            rows={2}
            className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3 ${inputCls}`}
          />

          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditingId(null)} className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-medium transition ${dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <X size={14} /> Annuler
            </button>
            <button onClick={() => handleSaveEdit(b.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition">
              <Check size={14} /> Enregistrer
            </button>
          </div>
        </div>
      );
    }

    const noteStyle = dm ? noteDark : note;

    return (
      <div key={b.id} className={`rounded-2xl border-2 p-4 ${cardColor} transition-all hover:shadow-md group`}>
        <div className="flex items-start justify-between gap-2">
          {/* Infos principales */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Nom de la ville — cliquable */}
              <button
                onClick={() => openGoogleMaps(b.ville)}
                title="Voir sur Google Maps"
                className={`text-base font-bold leading-tight hover:underline flex items-center gap-1 ${noteStyle.text} text-left`}
              >
                <MapPin size={15} className="shrink-0" />
                {b.ville}
              </button>

              {/* Badge note */}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${noteStyle.badgeBg} ${noteStyle.badgeText}`}>
                {note.emoji} {note.label}
              </span>
            </div>

            {/* Commentaire */}
            {b.commentaire && (
              <p className={`mt-1.5 text-sm ${dm ? 'text-gray-300' : 'text-gray-600'} flex items-start gap-1`}>
                <MessageSquare size={13} className="mt-0.5 shrink-0 opacity-60" />
                {b.commentaire}
              </p>
            )}

            {/* Bouton itinéraire */}
            <button
              onClick={() => openItineraire(b.ville)}
              className={`mt-2 text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100 transition ${noteStyle.text}`}
            >
              🗺️ Voir l'itinéraire
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-1 shrink-0">
            {isDeleting ? (
              <>
                <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition text-xs font-semibold px-2">
                  Confirmer
                </button>
                <button onClick={() => setDeletingId(null)} className={`p-1.5 rounded-lg transition ${dm ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => startEdit(b)} className={`p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-500 hover:bg-gray-100'}`} title="Modifier">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => setDeletingId(b.id)} className={`p-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 ${dm ? 'bg-gray-700 text-red-400 hover:bg-red-900' : 'bg-white text-red-400 hover:bg-red-50'}`} title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Rendu principal ───────────────────────────────────────────────────────

  return (
    <div className={`min-h-screen ${pageBg} ${textMain} font-sans`}>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl font-medium text-sm transition-all ${
          toast.type === 'error'
            ? 'bg-red-600 text-white'
            : dm ? 'bg-green-700 text-white' : 'bg-green-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* ── Header ── */}
      <div className={`sticky top-0 z-30 ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏪</span>
            <div>
              <h1 className="text-lg font-bold leading-tight">Mes Braderies</h1>
              <p className={`text-xs ${textSub}`}>{stats.total} ville{stats.total > 1 ? 's' : ''} enregistrée{stats.total > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle dark mode */}
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-xl transition ${dm ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title="Mode sombre"
            >
              {dm ? '☀️' : '🌙'}
            </button>

            {/* Bouton ajouter */}
            <button
              onClick={() => { setShowForm(v => !v); setFormVille(''); setFormNote(''); setFormCommentaire(''); }}
              className={btnPrimary}
            >
              <Plus size={16} />
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* ── Statistiques ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'tres_bien', count: stats.tres_bien, note: NOTES.tres_bien, dark: NOTES_DARK.tres_bien },
            { key: 'passable',  count: stats.passable,  note: NOTES.passable,  dark: NOTES_DARK.passable  },
            { key: 'a_fuir',    count: stats.a_fuir,    note: NOTES.a_fuir,    dark: NOTES_DARK.a_fuir    },
          ].map(({ key, count, note, dark }) => {
            const n = dm ? dark : note;
            return (
              <button
                key={key}
                onClick={() => setFiltreNote(filtreNote === key ? 'all' : key)}
                className={`rounded-2xl border-2 p-3 text-center transition hover:scale-105 ${n.bg} ${n.border} ${filtreNote === key ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
              >
                <div className={`text-2xl font-bold ${n.text}`}>{count}</div>
                <div className={`text-xs font-medium mt-0.5 ${n.text}`}>{note.emoji} {note.label}</div>
              </button>
            );
          })}
        </div>

        {/* ── Formulaire d'ajout ── */}
        {showForm && (
          <div className={`rounded-2xl border-2 p-4 ${dm ? 'bg-gray-800 border-gray-600' : 'bg-blue-50 border-blue-200'} transition-all`}>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Plus size={16} className="text-blue-500" />
              Nouvelle braderie
            </h2>

            {/* Champ ville + autocomplétion */}
            <div className="relative mb-3" ref={suggestionRef}>
              <input
                ref={villeInputRef}
                value={formVille}
                onChange={e => handleVilleInput(e.target.value)}
                onFocus={() => formVille.length >= 2 && setShowSuggestions(true)}
                placeholder="Nom de la ville…"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${inputCls}`}
                autoFocus
              />
              {suggestionLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {showSuggestions && villeSuggestions.length > 0 && (
                <SuggestionDropdown
                  suggestions={villeSuggestions}
                  onSelect={s => { setFormVille(s.nom); setShowSuggestions(false); setVilleSuggestions([]); villeInputRef.current?.focus(); }}
                  darkMode={dm}
                />
              )}
            </div>

            {/* Sélecteur de note */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {Object.entries(NOTES).map(([key, n]) => (
                <button
                  key={key}
                  onClick={() => setFormNote(key)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition ${
                    formNote === key
                      ? `${n.badgeBg} ${n.badgeText} border-current scale-105 shadow`
                      : dm ? 'bg-gray-700 text-gray-300 border-gray-600 hover:border-gray-400' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {n.emoji} {n.label}
                </button>
              ))}
            </div>

            {/* Commentaire */}
            <textarea
              value={formCommentaire}
              onChange={e => setFormCommentaire(e.target.value)}
              placeholder="Commentaire (optionnel) : parking, horaires, bons coins…"
              rows={2}
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3 ${inputCls}`}
            />

            {/* Boutons */}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${dm ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={formLoading}
                className={`px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-60`}
              >
                {formLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={15} />}
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {/* ── Barre de recherche ── */}
        <div className="relative">
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textSub}`} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher une ville…"
            className={`w-full border rounded-2xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${inputCls}`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${textSub} hover:text-current`}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Filtres note ── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTRE_OPTIONS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltreNote(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                filtreNote === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : dm ? 'bg-gray-700 text-gray-300 border-gray-600 hover:border-gray-400' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>

        {/* ── Liste des braderies ── */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className={`rounded-2xl border-2 p-4 h-20 animate-pulse ${dm ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'}`} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={`text-center py-12 ${textSub}`}>
            <span className="text-4xl block mb-3">🏪</span>
            <p className="font-medium">
              {braderies.length === 0
                ? 'Aucune braderie enregistrée'
                : 'Aucun résultat pour cette recherche'}
            </p>
            {braderies.length === 0 && (
              <p className="text-sm mt-1">Clique sur "Ajouter" pour commencer !</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(b => renderCard(b))}
          </div>
        )}

        {/* ── Footer ── */}
        {filtered.length > 0 && (
          <p className={`text-center text-xs ${textSub} py-2`}>
            {filtered.length} braderie{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
            {filtreNote !== 'all' || searchQuery ? ` sur ${braderies.length}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Composant dropdown suggestions ──────────────────────────────────────────

function SuggestionDropdown({ suggestions, onSelect, darkMode: dm }) {
  return (
    <ul className={`absolute z-50 w-full mt-1 rounded-xl border shadow-lg overflow-hidden ${dm ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
      {suggestions.map((s, i) => (
        <li key={i}>
          <button
            onMouseDown={e => { e.preventDefault(); onSelect(s); }}
            className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition ${dm ? 'hover:bg-gray-700 text-gray-100' : 'hover:bg-blue-50 text-gray-800'}`}
          >
            <span className="flex items-center gap-1.5">
              <MapPin size={12} className={dm ? 'text-gray-400' : 'text-gray-400'} />
              <span className="font-medium">{s.nom}</span>
            </span>
            <span className={`text-xs ${dm ? 'text-gray-400' : 'text-gray-400'} shrink-0`}>
              {s.cp} {s.dept && `— ${s.dept}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
