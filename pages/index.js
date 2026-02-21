import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const PHILIBERT_FLASH_URL = 'https://www.philibertnet.com/fr/flash-sales?p=1';

function getFlashSaleStatus() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const isNoonOrAfter = hours > 12 || (hours === 12 && minutes >= 0);
  const isBeforeNoon = hours < 12;

  if (day === 2 && isNoonOrAfter) {
    return { active: true, message: "Hey ! on est mardi midi ! il est temps de regarder les ventes flash sur Philibert !" };
  }
  if (day === 3) {
    return { active: true, message: "Hey ! Les ventes flash sont en cours sur Philibert !" };
  }
  if (day === 4) {
    return { active: true, message: "Hey ! Les ventes flash sont en cours sur Philibert !" };
  }
  if (day === 5 && isBeforeNoon) {
    return { active: true, message: "Hey ! Les ventes flash sont en cours sur Philibert !" };
  }
  return { active: false, message: '' };
}

export default function MenuPrincipal() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [urgentParcels, setUrgentParcels] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  const flashStatus = getFlashSaleStatus();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadUrgentParcels();
    }
  }, [isLoggedIn]);

  const checkAuth = () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setIsLoggedIn(true);
    }
    setLoading(false);
  };

  const loadUrgentParcels = async () => {
    try {
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('user_id', username)
        .eq('collected', false);

      if (error) throw error;

      const now = new Date();
      const urgent = data.filter(parcel => {
        const added = new Date(parcel.date_added);
        const diffDays = Math.floor((now - added) / (1000 * 60 * 60 * 24));
        const remainingDays = 5 - diffDays;
        return remainingDays <= 2 && remainingDays >= 0;
      });

      setUrgentParcels(urgent.length);
    } catch (error) {
      console.error('Erreur de chargement:', error);
    }
  };

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (username.trim() && password.trim()) {
      localStorage.setItem('username', username.trim());
      localStorage.setItem('password', password.trim());
      setIsLoggedIn(true);
    } else {
      alert('Veuillez remplir tous les champs');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
  };

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center p-4 transition-colors duration-300`}>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8 w-full max-w-md transition-colors duration-300`}>
          <div className="flex items-center justify-center gap-3 mb-8">
            <div>
              <img src="/meeple_outils.png" alt="Logo" width="96" height="96" className="object-contain" />
            </div>
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Mes Outils</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choisissez un nom d'utilisateur"
                className={`w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                Mot de passe
              </label>
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choisissez un mot de passe"
                className={`w-full px-4 py-3 border-2 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition"
            >
              Se connecter
            </button>

            <p className={`text-sm text-center mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Utilisez les mêmes identifiants sur tous vos appareils
            </p>
          </form>

          <div className="mt-6 flex justify-center">
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} transition-colors duration-300`}>

      {/* ⚡ BANDEAU VENTES FLASH PHILIBERT */}
      {flashStatus.active && !bannerDismissed && (
        <div
          className="relative w-full bg-amber-400 text-black py-3 px-6 flex items-center justify-center cursor-pointer shadow-md"
          onClick={() => window.open(PHILIBERT_FLASH_URL, '_blank')}
        >
          <span className="font-semibold text-sm sm:text-base text-center pr-8 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="black" stroke="black" strokeWidth="1">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            {flashStatus.message}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="black" stroke="black" strokeWidth="1">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setBannerDismissed(true);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-black hover:text-amber-800 transition-colors"
            title="Fermer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-8 transition-colors duration-300`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <img src="/meeple_outils.png" alt="Logo" width="96" height="96" className="object-contain" />
                </div>
                <div>
                  <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Mes Outils</h1>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Connecté en tant que <span className="font-semibold">{username}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2 sm:self-auto self-start">

                {/* ⚙️ Bouton Paramètres */}
                <div className="relative">
                  <button
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    className={`p-3 rounded-xl transition-all duration-300 ${
                      darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                    }`}
                    title="Paramètres"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </button>

                  {/* Fenêtre flottante */}
                  {settingsOpen && (
                    <>
                      {/* Overlay transparent pour fermer en cliquant ailleurs */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setSettingsOpen(false)}
                      />
                      <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl border z-20 overflow-hidden ${
                        darkMode
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className={`px-4 py-2.5 border-b text-xs font-semibold uppercase tracking-wider ${
                          darkMode ? 'border-gray-700 text-gray-500' : 'border-gray-100 text-gray-400'
                        }`}>
                          Outils
                        </div>

                        {/* 🖨️ Imprimer des étiquettes */}
                        <button
                          onClick={() => {
                            setSettingsOpen(false);
                            const filePath = '/Etiquettes_LePetitMeeple.pdf';
                            const ext = filePath.split('.').pop().toLowerCase();
                            if (ext === 'pdf') {
                              window.open(filePath, '_blank');
                            } else {
                              const w = window.open('', '_blank');
                              w.document.write(
                                `<!DOCTYPE html><html><head><title>Étiquettes</title>` +
                                `<style>*{margin:0;padding:0;}img{width:100%;height:auto;}` +
                                `@media print{@page{margin:0;}}</style></head>` +
                                `<body onload="window.print()"><img src="${filePath}" /></body></html>`
                              );
                              w.document.close();
                            }
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors duration-150 ${
                            darkMode
                              ? 'text-gray-300 hover:bg-gray-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                          </svg>
                          Imprimer des étiquettes
                        </button>

                        {/* Emplacement pour futurs menus */}
                      </div>
                    </>
                  )}
                </div>

                {/* 🔲 Bouton mode d'affichage */}
                <button
                  onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                  className={`p-3 rounded-xl transition-all duration-300 ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-gray-200'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                  }`}
                  title={viewMode === 'grid' ? 'Passer en mode liste' : 'Passer en mode grille'}
                >
                  {viewMode === 'grid' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                    </svg>
                  )}
                </button>

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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      <line x1="1" y1="12" x2="3" y2="12"/>
                      <line x1="21" y1="12" x2="23" y2="12"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                  )}
                </button>

                {/* ⚡ Bouton Vente flash (visible si bandeau fermé ou hors période de ventes flash) */}
                {(!flashStatus.active || bannerDismissed) && (
                  <button
                    onClick={() => window.open(PHILIBERT_FLASH_URL, '_blank')}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 bg-amber-400 hover:bg-amber-500 text-black"
                    title="Voir les ventes flash Philibert"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="black" stroke="black" strokeWidth="1">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    <span className="hidden sm:inline">Vente flash !</span>
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 border ${
                    darkMode
                      ? 'border-gray-600 text-gray-400 hover:border-red-500 hover:text-red-400 hover:bg-red-500/10'
                      : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                  }`}
                  title="Se déconnecter"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </div>
            </div>
          </div>

          {(() => {
            const apps = [
              {
                path: '/colis',
                title: 'Gestionnaire de Colis',
                description: 'Gérez vos colis de lockers avec rappels automatiques',
                gradient: 'from-indigo-500 to-purple-600',
                tags: [{ label: '📦 Suivi', bg: 'bg-indigo-100', text: 'text-indigo-700' }, { label: '⏰ Rappels', bg: 'bg-purple-100', text: 'text-purple-700' }],
                badge: urgentParcels > 0 ? `${urgentParcels} urgent${urgentParcels > 1 ? 's' : ''}` : null,
                icon: (size) => (
                  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                ),
              },
              {
                path: '/annonces',
                title: "Générateur d'Annonces",
                description: 'Créez des descriptions détaillées pour vos annonces',
                gradient: 'from-emerald-500 to-teal-600',
                tags: [{ label: '🎲 Jeux', bg: 'bg-emerald-100', text: 'text-emerald-700' }, { label: '⚡ Rapide', bg: 'bg-teal-100', text: 'text-teal-700' }],
                badge: null,
                icon: (size) => (
                  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                ),
              },
              {
                path: '/reponses',
                title: 'Réponses Préfaites',
                description: 'Répondez rapidement aux acheteurs et vendeurs',
                gradient: 'from-pink-500 to-rose-600',
                tags: [{ label: '💬 Messages', bg: 'bg-pink-100', text: 'text-pink-700' }, { label: '🚀 Efficace', bg: 'bg-rose-100', text: 'text-rose-700' }],
                badge: null,
                icon: (size) => (
                  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                ),
              },
              {
                path: '/inventaire',
                title: 'Inventaire de Jeux',
                description: 'Vérifiez le contenu de vos jeux de société',
                gradient: 'from-orange-500 to-amber-600',
                tags: [{ label: '📦 Inventaire', bg: 'bg-orange-100', text: 'text-orange-700' }, { label: '✅ Vérification', bg: 'bg-amber-100', text: 'text-amber-700' }],
                badge: null,
                icon: (size) => (
                  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="12 12 12 12.01"></polyline>
                    <polyline points="12 6 12 6.01"></polyline>
                    <polyline points="12 18 12 18.01"></polyline>
                  </svg>
                ),
              },
              {
                path: '/transactions',
                title: 'Suivi Achats/Ventes',
                description: 'Suivez vos bénéfices en temps réel',
                gradient: 'from-blue-500 to-cyan-600',
                tags: [{ label: '💰 Bénéfices', bg: 'bg-blue-100', text: 'text-blue-700' }, { label: '📊 Stats', bg: 'bg-cyan-100', text: 'text-cyan-700' }],
                badge: null,
                icon: (size) => (
                  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                ),
              },
              {
                path: '/ludotheque',
                title: 'Ma Ludothèque',
                description: 'Organisez vos jeux sur des étagères virtuelles',
                gradient: 'from-violet-500 to-fuchsia-600',
                tags: [{ label: '🎲 Organisation', bg: 'bg-violet-100', text: 'text-violet-700' }, { label: '📚 Règles IA', bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' }],
                badge: null,
                icon: (size) => (
                  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                ),
              },
              {
                path: '/masquage-pdf',
                title: 'Masquage PDF',
                description: 'Masquez les informations sensibles sur vos étiquettes',
                gradient: 'from-red-500 to-orange-600',
                tags: [{ label: '📄 PDF', bg: 'bg-red-100', text: 'text-red-700' }, { label: '🔒 Confidentialité', bg: 'bg-orange-100', text: 'text-orange-700' }],
                badge: null,
                icon: (size) => (
                  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <rect x="8" y="12" width="8" height="2" fill="white"></rect>
                    <rect x="8" y="16" width="8" height="2" fill="white"></rect>
                  </svg>
                ),
              },
              {
                path: '/sav',
                title: 'SAV Jeux',
                description: 'Accédez rapidement aux SAV de vos éditeurs',
                gradient: 'from-cyan-500 to-blue-600',
                tags: [{ label: '🔧 Support', bg: 'bg-cyan-100', text: 'text-cyan-700' }, { label: '🔗 Liens', bg: 'bg-blue-100', text: 'text-blue-700' }],
                badge: null,
                icon: (size) => (
                  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                  </svg>
                ),
              },
            ];

            if (viewMode === 'grid') {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {apps.map((app) => (
                    <div
                      key={app.path}
                      onClick={() => router.push(app.path)}
                      className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-8 hover:shadow-2xl transition cursor-pointer group relative`}
                    >
                      {app.badge && (
                        <div className="absolute top-4 right-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
                          {app.badge}
                        </div>
                      )}
                      <div className="flex flex-col items-center text-center">
                        <div className={`bg-gradient-to-br ${app.gradient} p-6 rounded-2xl mb-4 group-hover:scale-110 transition`}>
                          {app.icon(48)}
                        </div>
                        <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{app.title}</h2>
                        <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{app.description}</p>
                        <div className="flex gap-2 flex-wrap justify-center text-sm">
                          {app.tags.map((tag) => (
                            <span key={tag.label} className={`${tag.bg} ${tag.text} px-3 py-1 rounded-full`}>{tag.label}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-2">
                {apps.map((app) => (
                  <div
                    key={app.path}
                    onClick={() => router.push(app.path)}
                    className={`${darkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'} rounded-xl shadow px-4 py-3 flex items-center gap-4 cursor-pointer transition group relative`}
                  >
                    <div className={`bg-gradient-to-br ${app.gradient} p-2.5 rounded-xl shrink-0 group-hover:scale-105 transition`}>
                      {app.icon(22)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>{app.title}</span>
                      <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{app.description}</p>
                    </div>
                    {app.badge && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full animate-pulse shrink-0">{app.badge}</span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className={`mt-8 rounded-xl p-4 text-center transition-colors duration-300 ${
            darkMode ? 'bg-gray-800 bg-opacity-60' : 'bg-white bg-opacity-60'
          }`}>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              💡 Vos données sont synchronisées entre tous vos appareils
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
