import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function GenerateurAnnonces() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // États pour le formulaire
  const [nomJeu, setNomJeu] = useState('');
  const [prefixSociete, setPrefixSociete] = useState(true);
  const [etatMateriel, setEtatMateriel] = useState('Bon état');
  const [blister, setBlister] = useState('Non');
  const [complet, setComplet] = useState('Complet');
  const [reglesFr, setReglesFr] = useState(true);
  const [rayures, setRayures] = useState('Bon état');
  const [aspectSecondaire, setAspectSecondaire] = useState(false);
  const [rayures2, setRayures2] = useState('Bon état');
  const [extension, setExtension] = useState(false);
  const [lot, setLot] = useState(false);
  const [vintedInfo, setVintedInfo] = useState(true);
  const [noHand, setNoHand] = useState(false);
  const [preferShipping, setPreferShipping] = useState(false);
  const [elementsManquants, setElementsManquants] = useState('');
  const [description, setDescription] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [gameNameSuggestions, setGameNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [extraText, setExtraText] = useState('');
  const [ventes, setVentes] = useState([]); // ventes passées, pour le prix moyen

  // Annonces types
  const [templates, setTemplates] = useState([]);
  const [templatesError, setTemplatesError] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateIncludeName, setTemplateIncludeName] = useState(true);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [renamingTemplateId, setRenamingTemplateId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // Le nom du jeu saisi dans le formulaire filtre les vignettes (sauf si on a demandé "Tout afficher")
  useEffect(() => { setShowAllTemplates(false); }, [nomJeu]);

  const etatOptions = [
    "Bon état", "Boîte usée un peu partout", "Comme neuf", "Correct avec marques d'usage",
    "État moyen, mais jouable", "Joué une fois, en très bon état",
    "Neuf, n'a jamais servi, encore un paquet de cartes sous blister.",
    "Neuf, n'a jamais servi, toutes les cartes sont sous blister.",
    "Très bon état", "Traces d'usure visibles", "Traces d'usure"
  ].sort();

  const rayuresOptions = [
    "Bon état", "Très bon état", "Coin inférieur droit abîmé", "Coin inférieur droit enfoncé",
    "Coin inférieur gauche abîmé", "Coin inférieur gauche enfoncé", "Coin supérieur droit abîmé",
    "Coin supérieur droit enfoncé", "Coin supérieur gauche abîmé", "Coin supérieur gauche enfoncé",
    "Coins abîmés", "Coins légèrement usés", "Pas de rayures, état parfait",
    "Quelques rayures superficielles", "Rayures visibles sur la boîte", "Traces d'usure"
  ].sort();

  useEffect(() => {
    checkAuth();
    loadGameNames();
    loadTemplates();
    loadVentes();
  }, []);

  // Même regroupement que le stock : sans accents ni casse, sans suffixe « +… »
  const cleJeu = (name) =>
    String(name || '').split(' +')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  const loadVentes = async () => {
    const savedUsername = localStorage.getItem('username');
    if (!savedUsername) return;
    const toutes = [];
    for (let from = 0; from < 100000; from += 1000) {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, game_name, price')
        .eq('user_id', savedUsername)
        .eq('type', 'sell')
        .order('id', { ascending: true })
        .range(from, from + 999);
      if (error) { console.error('Erreur ventes:', error); return; }
      toutes.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setVentes(toutes);
  };

  const ventesDuJeu = nomJeu.trim()
    ? ventes.filter(v => cleJeu(v.game_name) === cleJeu(nomJeu) && Number(v.price) > 0)
    : [];
  const prixMoyen = ventesDuJeu.length
    ? ventesDuJeu.reduce((s, v) => s + Number(v.price), 0) / ventesDuJeu.length
    : null;

  useEffect(() => {
    genererDescription();
  }, [nomJeu, prefixSociete, etatMateriel, blister, complet, reglesFr, rayures, aspectSecondaire, rayures2, extension, lot, vintedInfo, noHand, preferShipping, elementsManquants, extraText]);

  const checkAuth = () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setIsLoggedIn(true);
    } else {
      router.push('/');
    }
    setLoading(false);
  };

  const loadGameNames = async () => {
    const savedUsername = localStorage.getItem('username');
    if (!savedUsername) return;
    
    try {
      const { data: buys, error: buyError } = await supabase
        .from('transactions')
        .select('game_name')
        .eq('user_id', savedUsername)
        .not('game_name', 'is', null);

      const { data: sells, error: sellError } = await supabase
        .from('transactions')
        .select('game_name')
        .eq('user_id', savedUsername)
        .not('game_name', 'is', null);

      if (buyError) console.error('Erreur buys:', buyError);
      if (sellError) console.error('Erreur sells:', sellError);

      const allTransactions = [...(buys || []), ...(sells || [])];
      const uniqueNames = [...new Set(allTransactions
        .map(t => t.game_name)
        .filter(name => name && name.trim() !== '')
      )].sort();
      
      setGameNameSuggestions(uniqueNames);
    } catch (error) {
      console.error('Erreur de chargement:', error);
    }
  };
  
  const genererDescription = () => {
    let desc = '';

    if (prefixSociete) {
      desc += `Jeu de société ${nomJeu}\n`;
    } else {
      desc += `${nomJeu}\n`;
    }

    if (blister === 'Oui - Neuf sous blister') {
      desc += 'Neuf, encore sous blister.\n';
    } else {
      desc += `État du matériel : ${etatMateriel}\n`;
      desc += `Aspect extérieur de la boîte : ${rayures}`;
      if (aspectSecondaire && rayures2) {
        desc += `, ${rayures2}`;
      }
      desc += '.\n';

      if (complet === 'Complet') {
        let contenu = 'Complet';
        if (reglesFr) {
          contenu += ' avec règles du jeu en français.';
        }
        desc += contenu + '\n';
      } else if (complet === 'Incomplet') {
        const manquants = elementsManquants.trim();
        if (manquants) {
          desc += `Incomplet : ${manquants}\n`;
        } else {
          desc += 'Incomplet\n';
        }
      }
    }

    if (extraText.trim()) {
      desc += '\n' + extraText.trim() + '\n';
    }

    if (extension) {
      desc += '\n🚩 Attention, il s\'agit d\'une extension. Je ne vends pas le jeu de base qui est nécessaire pour jouer.';
    }

    if (lot) {
      desc += '\n🚩 Pas de vente au détail, vente du lot uniquement.';
    }

    if (vintedInfo) {
      desc += '\n🚩 Pas d\'envoi par Vinted GO.';
      desc += '\n✨ Toutes les infos concernant mes ventes (prix, envois, offres…) sont déjà précisées sur mon profil.\nUn coup d\'œil rapide devrait répondre à la plupart de vos questions 😉.';
    }

    if (noHand) {
      desc += '\n🚩 Je ne fais pas de remise en main propre.';
    }
    if (preferShipping) {
      desc += '\n🚩 Je privilégie les envois à la remise en main propre.';
    }

    setDescription(desc);
  };

  const copierDescription = () => {
    if (description.trim()) {
      navigator.clipboard.writeText(description);
      setCopyMessage('Description copiée dans le presse-papier, à toi de jouer !');
      setTimeout(() => setCopyMessage(''), 10000);
    }
  };

  // ── Annonces types ───────────────────────────────────────────
  const loadTemplates = async () => {
    const savedUsername = localStorage.getItem('username');
    if (!savedUsername) return;
    try {
      const { data, error } = await supabase
        .from('annonce_templates')
        .select('*')
        .eq('user_id', savedUsername)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setTemplates(data || []);
      setTemplatesError(false);
    } catch (error) {
      console.error('Erreur de chargement des annonces types:', error);
      setTemplatesError(true);
    }
  };

  const getCurrentSettings = (includeName) => ({
    gameName: includeName ? nomJeu.trim() : '',
    prefixSociete, etatMateriel, blister, complet, reglesFr, rayures,
    aspectSecondaire, rayures2, extension, lot, vintedInfo, noHand, preferShipping,
    elementsManquants, extraText,
  });

  const appliquerTemplate = (tpl) => {
    const t = tpl.settings || {};
    if (t.gameName) setNomJeu(t.gameName);
    setPrefixSociete(t.prefixSociete ?? true);
    setEtatMateriel(t.etatMateriel ?? 'Bon état');
    setBlister(t.blister ?? 'Non');
    setComplet(t.complet ?? 'Complet');
    setReglesFr(t.reglesFr ?? true);
    setRayures(t.rayures ?? 'Bon état');
    setAspectSecondaire(t.aspectSecondaire ?? false);
    setRayures2(t.rayures2 ?? 'Bon état');
    setExtension(t.extension ?? false);
    setLot(t.lot ?? false);
    setVintedInfo(t.vintedInfo ?? true);
    setNoHand(t.noHand ?? false);
    setPreferShipping(t.preferShipping ?? false);
    setElementsManquants(t.elementsManquants ?? '');
    setExtraText(t.extraText ?? '');
    setActiveTemplateId(tpl.id);
    setCopyMessage(`Annonce type « ${tpl.name} » appliquée`);
    setTimeout(() => setCopyMessage(''), 4000);
  };

  const enregistrerTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    const savedUsername = localStorage.getItem('username');
    try {
      const { data, error } = await supabase
        .from('annonce_templates')
        .insert({ user_id: savedUsername, name, settings: getCurrentSettings(templateIncludeName) })
        .select()
        .single();
      if (error) throw error;
      setTemplates(prev => [...prev, data]);
      setActiveTemplateId(data.id);
      setShowSaveTemplate(false);
      setTemplateName('');
      setTemplatesError(false);
      setCopyMessage(`Annonce type « ${name} » enregistrée`);
      setTimeout(() => setCopyMessage(''), 4000);
    } catch (error) {
      console.error('Erreur enregistrement annonce type:', error);
      alert("Impossible d'enregistrer l'annonce type. La table annonce_templates existe-t-elle bien dans Supabase ?");
    }
  };

  const mettreAJourTemplate = async (tpl) => {
    if (!confirm(`Remplacer le contenu de « ${tpl.name} » par le formulaire actuel ?`)) return;
    const includeName = !!(tpl.settings && tpl.settings.gameName);
    const settings = getCurrentSettings(includeName);
    try {
      const { error } = await supabase.from('annonce_templates').update({ settings }).eq('id', tpl.id);
      if (error) throw error;
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, settings } : t));
      setActiveTemplateId(tpl.id);
      setCopyMessage(`Annonce type « ${tpl.name} » mise à jour`);
      setTimeout(() => setCopyMessage(''), 4000);
    } catch (error) {
      console.error('Erreur mise à jour annonce type:', error);
      alert("Impossible de mettre à jour l'annonce type.");
    }
  };

  const renommerTemplate = async (tpl) => {
    const name = renameValue.trim();
    setRenamingTemplateId(null);
    if (!name || name === tpl.name) return;
    try {
      const { error } = await supabase.from('annonce_templates').update({ name }).eq('id', tpl.id);
      if (error) throw error;
      setTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, name } : t));
    } catch (error) {
      console.error('Erreur renommage annonce type:', error);
      alert("Impossible de renommer l'annonce type.");
    }
  };

  const supprimerTemplate = async (tpl) => {
    if (!confirm(`Supprimer l'annonce type « ${tpl.name} » ?`)) return;
    try {
      const { error } = await supabase.from('annonce_templates').delete().eq('id', tpl.id);
      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== tpl.id));
      if (activeTemplateId === tpl.id) setActiveTemplateId(null);
    } catch (error) {
      console.error('Erreur suppression annonce type:', error);
      alert("Impossible de supprimer l'annonce type.");
    }
  };

  // Couleur = état général de l'annonce type
  const templateLevel = (t) => {
    const e = t.etatMateriel || 'Bon état';
    let lvl = 1; // 0 excellent, 1 bon, 2 correct, 3 usé
    if (t.blister === 'Oui - Neuf sous blister' || /^Neuf|Comme neuf|Joué une fois|^Très bon état/.test(e)) lvl = 0;
    else if (e === 'Bon état') lvl = 1;
    else if (/^Correct|^Traces d'usure$/.test(e)) lvl = 2;
    else lvl = 3;
    if (t.blister !== 'Oui - Neuf sous blister' && (t.complet || 'Complet') !== 'Complet') lvl = Math.min(3, lvl + 1);
    return lvl;
  };
  const LEVEL_STYLES = [
    { bar: 'bg-emerald-500', label: 'Excellent' },
    { bar: 'bg-lime-500', label: 'Bon' },
    { bar: 'bg-amber-500', label: 'Correct' },
    { bar: 'bg-rose-500', label: 'Usé / incomplet' },
  ];
  const normText = (x) => (x || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const searchQ = normText(templateSearch);
  const nameQ = (!searchQ && !showAllTemplates) ? normText(nomJeu) : '';
  const visibleTemplates = [...templates]
    .filter(tpl => {
      const hay = normText(tpl.name + ' ' + ((tpl.settings && tpl.settings.gameName) || ''));
      if (searchQ) return hay.includes(searchQ);
      if (nameQ) return hay.includes(nameQ) || !(tpl.settings && tpl.settings.gameName); // les modèles généraux restent visibles
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center`}>
        <div className={`text-xl ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-emerald-50 to-teal-100'} py-8 px-4 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className={`${darkMode ? 'text-gray-400 hover:text-emerald-400 hover:bg-gray-700' : 'text-gray-600 hover:text-emerald-600 hover:bg-gray-100'} p-2 rounded-lg transition`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-emerald-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Générateur d'Annonces</h1>
            </div>

            {/* Toggle Dark Mode */}
            <button
              onClick={toggleDarkMode}
              className={`p-3 rounded-xl transition-all duration-300 ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {darkMode ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Colonne gauche - Formulaire */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>Paramètres</h2>
            
            <div className="space-y-4">
              {/* Cases à cocher */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefixSociete}
                    onChange={(e) => setPrefixSociete(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Jeux de société</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reglesFr}
                    onChange={(e) => setReglesFr(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Règles du jeu en français</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aspectSecondaire}
                    onChange={(e) => setAspectSecondaire(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Ajouter un aspect extérieur secondaire</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extension}
                    onChange={(e) => setExtension(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Extension</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lot}
                    onChange={(e) => setLot(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Lot</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vintedInfo}
                    onChange={(e) => setVintedInfo(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Inclure infos Vinted</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noHand}
                    onChange={(e) => setNoHand(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Pas de remise en main propre</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferShipping}
                    onChange={(e) => setPreferShipping(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>Privilégier les expéditions</span>
                </label>
              </div>

              {/* Nom du jeu */}
              <div className="relative">
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Nom du jeu :
                </label>
                <input
                  type="text"
                  value={nomJeu}
                  onChange={(e) => {
                    setNomJeu(e.target.value);
                    setShowSuggestions(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowSuggestions(nomJeu.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Ex: Catane, Azul..."
                  className={`w-full px-4 py-2 border-2 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
                
                {/* Suggestions d'autocomplétion */}
                {showSuggestions && nomJeu.length > 0 && (
                  (() => {
                    const filteredSuggestions = gameNameSuggestions.filter(name => 
                      name.toLowerCase().includes(nomJeu.toLowerCase())
                    );
                    
                    return filteredSuggestions.length > 0 && (
                      <div className={`absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto ${
                        darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                      }`}>
                        {filteredSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setNomJeu(suggestion);
                              setShowSuggestions(false);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-emerald-500 hover:text-white transition ${
                              darkMode ? 'text-gray-200' : 'text-gray-800'
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* État du matériel */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  État du matériel :
                </label>
                <select
                  value={etatMateriel}
                  onChange={(e) => setEtatMateriel(e.target.value)}
                  className={`w-full px-4 py-2 border-2 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  {etatOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Sous blister */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Sous blister :
                </label>
                <select
                  value={blister}
                  onChange={(e) => setBlister(e.target.value)}
                  className={`w-full px-4 py-2 border-2 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="Non">Non</option>
                  <option value="Oui - Neuf sous blister">Oui - Neuf sous blister</option>
                </select>
              </div>

              {/* Contenu */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Contenu :
                </label>
                <select
                  value={complet}
                  onChange={(e) => setComplet(e.target.value)}
                  className={`w-full px-4 py-2 border-2 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  <option value="Complet">Complet</option>
                  <option value="Incomplet">Incomplet</option>
                </select>
              </div>

              {/* Éléments manquants (si incomplet) */}
              {complet === 'Incomplet' && (
                <div>
                  <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                    Éléments manquants dans le jeu :
                  </label>
                  <textarea
                    value={elementsManquants}
                    onChange={(e) => setElementsManquants(e.target.value)}
                    rows="3"
                    className={`w-full px-4 py-2 border-2 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors duration-300 ${
                      darkMode 
                        ? 'bg-yellow-900 border-yellow-700 text-gray-100 placeholder-gray-400' 
                        : 'bg-yellow-50 border-gray-200 text-gray-900'
                    }`}
                    placeholder="Décrivez les éléments manquants..."
                  />
                </div>
              )}

              {/* Aspect extérieur */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Aspect extérieur (boîte) :
                </label>
                <select
                  value={rayures}
                  onChange={(e) => setRayures(e.target.value)}
                  className={`w-full px-4 py-2 border-2 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors duration-300 ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-100' 
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                >
                  {rayuresOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Aspect secondaire */}
              {aspectSecondaire && (
                <div>
                  <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                    Aspect extérieur secondaire (boîte) :
                  </label>
                  <select
                    value={rayures2}
                    onChange={(e) => setRayures2(e.target.value)}
                    className={`w-full px-4 py-2 border-2 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors duration-300 ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100' 
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  >
                    {rayuresOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              )}

              {/* Caractéristiques particulières du jeu */}
              <div>
                <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                  Caractéristiques particulières (ajouté à l'annonce) :
                </label>
                <textarea
                  value={extraText}
                  onChange={(e) => setExtraText(e.target.value)}
                  rows="3"
                  className={`w-full px-4 py-2 border-2 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors duration-300 ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                  placeholder="Ex : édition collector, 3 extensions incluses, jetons en bois..."
                />
              </div>
            </div>
          </div>

          {/* Colonne droite - Résultat */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Description générée</h2>
              {nomJeu.trim() && (
                <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                  prixMoyen === null
                    ? darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                    : darkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {prixMoyen === null
                    ? 'Aucune vente connue'
                    : `Vente moyenne : ${prixMoyen.toFixed(2).replace('.', ',')} € (${ventesDuJeu.length} vente${ventesDuJeu.length > 1 ? 's' : ''})`}
                </span>
              )}
            </div>
            
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="20"
              className={`w-full px-4 py-3 border-2 rounded-xl focus:border-emerald-500 focus:outline-none font-mono text-sm resize-none transition-colors duration-300 ${
                darkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
              placeholder="La description générée apparaîtra ici. Vous pouvez la modifier manuellement..."
            />

            <button
              onClick={copierDescription}
              className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              📋 Copier la description
            </button>

            {copyMessage && (
              <p className="text-green-600 text-center mt-4 font-medium animate-pulse">
                {copyMessage}
              </p>
            )}

            <button
              onClick={() => {
                setTemplateName(nomJeu.trim());
                setTemplateIncludeName(nomJeu.trim() !== '');
                setShowSaveTemplate(v => !v);
              }}
              className={`w-full mt-3 py-2.5 rounded-xl font-semibold text-sm border-2 border-dashed transition ${
                darkMode
                  ? 'border-gray-600 text-gray-300 hover:border-emerald-500 hover:text-emerald-400'
                  : 'border-gray-300 text-gray-600 hover:border-emerald-500 hover:text-emerald-600'
              }`}
            >
              💾 Enregistrer comme annonce type
            </button>

            {showSaveTemplate && (
              <div className={`mt-3 p-4 rounded-xl space-y-3 ${darkMode ? 'bg-gray-700/60' : 'bg-emerald-50'}`}>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') enregistrerTemplate(); }}
                  placeholder="Nom de l'annonce type (ex : Catane, Très bon état...)"
                  className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:border-emerald-500 focus:outline-none ${
                    darkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                      : 'bg-white border-gray-200 text-gray-900'
                  }`}
                  autoFocus
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateIncludeName}
                    onChange={(e) => setTemplateIncludeName(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Inclure le nom du jeu (décocher pour un modèle général, valable pour tous les jeux)
                  </span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={enregistrerTemplate}
                    className="flex-1 bg-emerald-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setShowSaveTemplate(false)}
                    className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${
                      darkMode ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Annonces types */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mt-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between mb-1">
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Annonces types</h2>
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{visibleTemplates.length === templates.length ? templates.length : `${visibleTemplates.length} / ${templates.length}`} modèle{templates.length > 1 ? 's' : ''}</span>
          </div>
          <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Clique sur une vignette pour remplir le formulaire d'un coup, puis ajuste si besoin.
          </p>

          <div className="relative mb-2">
            <input
              type="text"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Rechercher une annonce type (nom, jeu)..."
              className={`w-full pl-4 pr-10 py-2 border-2 rounded-xl text-sm focus:border-emerald-500 focus:outline-none ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
            {templateSearch && (
              <button
                onClick={() => setTemplateSearch('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-2 text-lg leading-none ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
                title="Effacer la recherche"
              >×</button>
            )}
          </div>

          {nameQ && (
            <p className={`text-xs mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Filtré d'après le nom du jeu « {nomJeu.trim()} » (les modèles généraux restent affichés).{' '}
              <button onClick={() => setShowAllTemplates(true)} className="text-emerald-600 font-semibold hover:underline">Tout afficher</button>
            </p>
          )}

          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-[11px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <span>Couleur = état général :</span>
            {LEVEL_STYLES.map(l => (
              <span key={l.label} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${l.bar}`} />{l.label}</span>
            ))}
          </div>

          {templatesError && (
            <p className={`text-sm mb-4 px-3 py-2 rounded-lg ${darkMode ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
              Les annonces types ne sont pas encore activées : lance le script SQL « annonce_templates » dans Supabase.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleTemplates.map((tpl) => {
              const t = tpl.settings || {};
              const isActive = activeTemplateId === tpl.id;
              const chips = [
                t.blister === 'Oui - Neuf sous blister' ? 'Neuf sous blister' : (t.etatMateriel || 'Bon état'),
                t.blister === 'Oui - Neuf sous blister' ? null : (t.complet || 'Complet'),
                t.extension ? 'Extension' : null,
                t.lot ? 'Lot' : null,
                t.extraText && t.extraText.trim() ? 'Texte perso' : null,
              ].filter(Boolean);
              return (
                <div
                  key={tpl.id}
                  onClick={() => renamingTemplateId !== tpl.id && appliquerTemplate(tpl)}
                  className={`relative group rounded-xl border-2 p-3 pl-4 cursor-pointer overflow-hidden transition-all hover:shadow-lg ${
                    isActive
                      ? (darkMode ? 'border-emerald-500 bg-emerald-900/20' : 'border-emerald-500 bg-emerald-50')
                      : (darkMode ? 'border-gray-700 bg-gray-700/40 hover:border-gray-500' : 'border-gray-200 bg-white hover:border-emerald-300')
                  }`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${LEVEL_STYLES[templateLevel(t)].bar}`} />
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {renamingTemplateId === tpl.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => renommerTemplate(tpl)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renommerTemplate(tpl);
                            if (e.key === 'Escape') setRenamingTemplateId(null);
                          }}
                          className={`w-full px-2 py-1 border-2 rounded-lg text-sm focus:border-emerald-500 focus:outline-none ${
                            darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-200 text-gray-900'
                          }`}
                          autoFocus
                        />
                      ) : (
                        <p className={`font-bold text-sm truncate ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{tpl.name}</p>
                      )}
                      <p className={`text-xs truncate mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t.gameName ? `🎲 ${t.gameName}` : 'Modèle général'}
                      </p>
                    </div>
                    <div className="flex gap-0.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenamingTemplateId(tpl.id); setRenameValue(tpl.name); }}
                        className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}
                        title="Renommer"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); mettreAJourTemplate(tpl); }}
                        className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-100 text-gray-500'}`}
                        title="Mettre à jour avec le formulaire actuel"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="23 4 23 10 17 10"></polyline>
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); supprimerTemplate(tpl); }}
                        className={`p-1.5 rounded-lg ${darkMode ? 'hover:bg-red-900/50 text-red-400' : 'hover:bg-red-50 text-red-500'}`}
                        title="Supprimer"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {chips.map(c => (
                      <span key={c} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${darkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-100 text-gray-600'}`}>{c}</span>
                    ))}
                  </div>
                </div>
              );
            })}

            {templates.length > 0 && visibleTemplates.length === 0 && (
              <p className={`text-sm col-span-full text-center py-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Aucune annonce type ne correspond.
              </p>
            )}
            {templates.length === 0 && !templatesError && (
              <p className={`text-sm col-span-full text-center py-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Aucune annonce type pour l'instant. Remplis le formulaire puis clique sur « Enregistrer comme annonce type ».
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
