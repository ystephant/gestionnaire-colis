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
  }, []);

  useEffect(() => {
    genererDescription();
  }, [nomJeu, prefixSociete, etatMateriel, blister, complet, reglesFr, rayures, aspectSecondaire, rayures2, extension, lot, vintedInfo, noHand, preferShipping, elementsManquants]);

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
            </div>
          </div>

          {/* Colonne droite - Résultat */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>Description générée</h2>
            
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
          </div>
        </div>
      </div>
    </div>
  );
}
