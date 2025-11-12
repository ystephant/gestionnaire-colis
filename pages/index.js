import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MenuPrincipal() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [urgentParcels, setUrgentParcels] = useState(0);

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

  const handleLogin = () => {
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

  // Page de connexion
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="bg-indigo-600 p-3 rounded-xl">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Mes Outils</h1>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && document.getElementById('password-input').focus()}
                placeholder="Choisissez un nom d'utilisateur"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                id="password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Choisissez un mot de passe"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleLogin}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition"
            >
              Se connecter
            </button>

            <p className="text-sm text-gray-600 text-center mt-4">
              Utilisez les mêmes identifiants sur tous vos appareils
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl text-indigo-600">Chargement...</div>
      </div>
    );
  }

  // Menu principal
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Mes Outils</h1>
                <p className="text-sm text-gray-500">Connecté: {username}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-red-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              Déconnexion
            </button>
          </div>
        </div>

        {/* Alerte colis urgents */}
        {urgentParcels > 0 && (
          <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl shadow-xl p-6 mb-6 animate-pulse">
            <div className="flex items-center gap-4 text-white">
              <div className="bg-white bg-opacity-20 p-4 rounded-xl">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-1">
                  ⚠️ {urgentParcels} colis urgent{urgentParcels > 1 ? 's' : ''} !
                </h3>
                <p className="text-white text-opacity-90">
                  Il ne vous reste plus que 2 jours ou moins pour récupérer {urgentParcels > 1 ? 'ces colis' : 'ce colis'}
                </p>
              </div>
              <button
                onClick={() => router.push('/colis')}
                className="bg-white text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-50 transition"
              >
                Voir les colis →
              </button>
            </div>
          </div>
        )}

        {/* Cartes des applications */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Gestionnaire de Colis */}
          <div 
            onClick={() => router.push('/colis')}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition cursor-pointer group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl mb-4 group-hover:scale-110 transition">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Gestionnaire de Colis</h2>
              <p className="text-gray-600 mb-4">
                Gérez vos colis de lockers avec rappels automatiques
              </p>
              <div className="flex gap-2 flex-wrap justify-center text-sm">
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">📦 Suivi</span>
                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">⏰ Rappels</span>
              </div>
            </div>
          </div>

          {/* Générateur d'Annonces */}
          <div 
            onClick={() => router.push('/annonces')}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition cursor-pointer group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl mb-4 group-hover:scale-110 transition">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Générateur d'Annonces</h2>
              <p className="text-gray-600 mb-4">
                Créez des descriptions détaillées pour vos annonces
              </p>
              <div className="flex gap-2 flex-wrap justify-center text-sm">
                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">🎲 Jeux</span>
                <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full">⚡ Rapide</span>
              </div>
            </div>
          </div>

          {/* Réponses Préfaites */}
          <div 
            onClick={() => router.push('/reponses')}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition cursor-pointer group"
          >
            <div className="flex flex-col items-center text-center">
              <div className="bg-gradient-to-br from-pink-500 to-rose-600 p-6 rounded-2xl mb-4 group-hover:scale-110 transition">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Réponses Préfaites</h2>
              <p className="text-gray-600 mb-4">
                Répondez rapidement aux acheteurs et vendeurs
              </p>
              <div className="flex gap-2 flex-wrap justify-center text-sm">
                <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full">💬 Messages</span>
                <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full">🚀 Efficace</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-8 bg-white bg-opacity-60 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-600">
            💡 Vos données sont synchronisées entre tous vos appareils
          </p>
        </div>
      </div>
    </div>
  );
}
