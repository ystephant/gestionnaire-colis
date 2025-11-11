import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialiser Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Logos des transporteurs (SVG en base64 ou URL)
const LOCKER_LOGOS = {
  'mondial-relay': 'https://upload.wikimedia.org/wikipedia/commons/6/66/Mondial_Relay_logo.svg',
  'vinted-go': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Vinted_logo.svg',
  'relais-colis': 'https://upload.wikimedia.org/wikipedia/fr/1/1e/Relais_Colis_logo.svg',
  'pickup': 'https://upload.wikimedia.org/wikipedia/fr/8/8c/Chronopost_Pickup_Station_logo.svg'
};


export default function LockerParcelApp() {
  const [parcels, setParcels] = useState([]);
  const [codeInput, setCodeInput] = useState('');
  const [content, setContent] = useState('');
  const [lockerType, setLockerType] = useState('mondial-relay');
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadParcels();
    }
  }, [isLoggedIn]);

  const checkAuth = () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setPassword(savedPassword);
      setIsLoggedIn(true);
    } else {
      setLoading(false);
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
    setParcels([]);
  };

  const loadParcels = async () => {
    try {
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('user_id', username)
        .order('collected', { ascending: true })
        .order('date_added', { ascending: false });

      if (error) throw error;
      
      setParcels(data || []);
    } catch (error) {
      console.error('Erreur de chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractParcelCodes = (text) => {
    let codes = [];
    
    if (lockerType === 'mondial-relay') {
      codes = text.match(/[A-Z0-9]{6}(?![A-Z0-9])/gi) || [];
    } else if (lockerType === 'vinted-go') {
      codes = text.split(/[\s,\n]+/).filter(code => 
        code.length >= 4 && code.length <= 20 && /[A-Z0-9-]+/i.test(code)
      );
    } else {
      codes = text.split(/[\s,\n]+/).filter(code => 
        code.length >= 4 && code.length <= 15 && /[A-Z0-9]+/i.test(code)
      );
    }
    
    return codes ? [...new Set(codes)] : [];
  };

  const addParcels = async () => {
    const codes = extractParcelCodes(codeInput);
    
    if (codes.length === 0) {
      alert('Aucun code de colis valide trouvé');
      return;
    }

    const newParcels = codes.map(code => ({
      code: code.toUpperCase(),
      location: content.trim() || 'Non spécifié',
      locker_type: lockerType,
      collected: false,
      user_id: username
    }));

    try {
      const { data, error } = await supabase
        .from('parcels')
        .insert(newParcels)
        .select();

      if (error) throw error;
      
      setParcels([...data, ...parcels]);
      setCodeInput('');
      setContent('');
    } catch (error) {
      console.error('Erreur d\'ajout:', error);
      alert('Erreur lors de l\'ajout des colis');
    }
  };

  const toggleCollected = async (id, currentStatus) => {
    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('parcels')
        .update({ 
          collected: !currentStatus,
          date_added: !currentStatus ? now : parcels.find(p => p.id === id)?.date_added
        })
        .eq('id', id);

      if (error) throw error;

      loadParcels();
    } catch (error) {
      console.error('Erreur de mise à jour:', error);
    }
  };

  const changeLockerType = async (id, newType) => {
    try {
      const { error } = await supabase
        .from('parcels')
        .update({ locker_type: newType })
        .eq('id', id);

      if (error) throw error;

      setParcels(parcels.map(parcel =>
        parcel.id === id ? { ...parcel, locker_type: newType } : parcel
      ));
    } catch (error) {
      console.error('Erreur de mise à jour:', error);
    }
  };

  const deleteParcel = async (id) => {
    try {
      const { error } = await supabase
        .from('parcels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setParcels(parcels.filter(parcel => parcel.id !== id));
    } catch (error) {
      console.error('Erreur de suppression:', error);
    }
  };

  const deleteAllCollected = async () => {
    if (!confirm('Supprimer tous les colis récupérés ?')) return;

    try {
      const collectedIds = collectedParcels.map(p => p.id);
      
      const { error } = await supabase
        .from('parcels')
        .delete()
        .in('id', collectedIds);

      if (error) throw error;

      setParcels(parcels.filter(parcel => !parcel.collected));
    } catch (error) {
      console.error('Erreur de suppression:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getRemainingDays = (dateAdded) => {
    const added = new Date(dateAdded);
    const now = new Date();
    const diffTime = now - added;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, 5 - diffDays);
  };

  const getRemainingDaysText = (remainingDays) => {
    if (remainingDays === 0) return '⚠️ Dernier jour pour récupérer';
    if (remainingDays === 1) return '⏰ Il te reste 1 jour';
    return `📅 Il te reste ${remainingDays} jours`;
  };

  const getPhilibertUrl = (gameName) => {
    if (!gameName || gameName === 'Non spécifié') return null;
    const searchQuery = encodeURIComponent(gameName);
    return `https://www.philibertnet.com/fr/recherche?query=${searchQuery}`;
  };

  const pendingParcels = parcels.filter(p => !p.collected);
  const collectedParcels = parcels.filter(p => p.collected);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    return `Il y a ${diffDays} jours`;
  };

  const getLockerName = (type) => {
    switch(type) {
      case 'mondial-relay': return 'Mondial Relay';
      case 'relais-colis': return 'Relais Colis';
      case 'pickup': return 'Pickup';
      case 'vinted-go': return 'Vinted GO';
      default: return 'Autre';
    }
  };

  const getCodeFormatHint = () => {
    switch(lockerType) {
      case 'mondial-relay': return 'Format: 6 caractères (ex: A1B2C3)';
      case 'vinted-go': return 'Format: 4-20 caractères (ex: VT-1234-ABCD)';
      case 'relais-colis': return 'Format: 4-15 caractères (ex: RC123456)';
      case 'pickup': return 'Format: 4-15 caractères (ex: PK789012)';
      default: return '';
    }
  };

  // Page de connexion
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="bg-indigo-600 p-3 rounded-xl">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Mes Colis</h1>
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
              Utilisez les mêmes identifiants sur tous vos appareils pour synchroniser vos colis
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header avec bouton déconnexion */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Mes Colis</h1>
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

          {/* Formulaire d'ajout */}
          <div className="space-y-3">
            {/* Type de locker avec logos */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Type de locker :</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
                  <input
                    type="radio"
                    name="lockerType"
                    value="mondial-relay"
                    checked={lockerType === 'mondial-relay'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <img src={LOCKER_LOGOS['mondial-relay']} alt="Mondial Relay" className="h-6 object-contain" />
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
                  <input
                    type="radio"
                    name="lockerType"
                    value="vinted-go"
                    checked={lockerType === 'vinted-go'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <img src={LOCKER_LOGOS['vinted-go']} alt="Vinted GO" className="h-6 object-contain" />
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
                  <input
                    type="radio"
                    name="lockerType"
                    value="relais-colis"
                    checked={lockerType === 'relais-colis'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <img src={LOCKER_LOGOS['relais-colis']} alt="Relais Colis" className="h-6 object-contain" />
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white p-3 rounded-lg border-2 border-gray-200 hover:border-indigo-400 transition">
                  <input
                    type="radio"
                    name="lockerType"
                    value="pickup"
                    checked={lockerType === 'pickup'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-4 h-4 text-indigo-600"
                  />
                  <img src={LOCKER_LOGOS['pickup']} alt="Pickup" className="h-6 object-contain" />
                </label>
              </div>
              <p className="text-xs text-indigo-600 mt-2">{getCodeFormatHint()}</p>
            </div>

            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder={`Collez vos codes ici\n${getCodeFormatHint()}`}
              rows="4"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-lg resize-none"
            />
            
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Contenu du colis (ex: Catane, Azul...)"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
            />

            <button
              onClick={addParcels}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Ajouter les colis
            </button>
          </div>
        </div>

        {/* Colis en attente */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
            À récupérer ({pendingParcels.length})
          </h2>
          
          {pendingParcels.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun colis en attente</p>
          ) : (
            <div className="space-y-3">
              {pendingParcels.map(parcel => {
                const remainingDays = getRemainingDays(parcel.date_added);
                const isUrgent = remainingDays <= 1;
                const philibertUrl = getPhilibertUrl(parcel.location);
                
                return (
                  <div
                    key={parcel.id}
                    onClick={(e) => {
                      if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                        toggleCollected(parcel.id, parcel.collected);
                      }
                    }}
                    className={`border-2 rounded-xl p-4 transition cursor-pointer ${
                      isUrgent 
                        ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCollected(parcel.id, parcel.collected);
                        }}
                        className="mt-1 w-6 h-6 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:border-indigo-500 flex-shrink-0"
                      >
                        {parcel.collected && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </button>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <select
                            value={parcel.locker_type}
                            onChange={(e) => {
                              e.stopPropagation();
                              changeLockerType(parcel.id, e.target.value);
                            }}
                            className="bg-transparent border-none focus:outline-none cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="mondial-relay">Mondial Relay</option>
                            <option value="vinted-go">Vinted GO</option>
                            <option value="relais-colis">Relais Colis</option>
                            <option value="pickup">Pickup</option>
                          </select>
                          <img src={LOCKER_LOGOS[parcel.locker_type]} alt="" className="h-5 object-contain inline" />
                        </div>
                        <div className="text-2xl font-bold text-indigo-600 break-all mb-2">
                          {parcel.code}
                        </div>
                        <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                          {philibertUrl ? (
                            <a 
                              href={philibertUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                            >
                              🎲 {parcel.location}
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                              </svg>
                            </a>
                          ) : (
                            <span>📦 {parcel.location}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-400 flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            {formatDate(parcel.date_added)}
                          </span>
                          <span className={`opacity-60 ${isUrgent ? 'font-bold text-red-600 opacity-100' : ''}`}>
                            {getRemainingDaysText(remainingDays)}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteParcel(parcel.id);
                        }}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Colis récupérés */}
        {collectedParcels.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Récupérés ({collectedParcels.length})
            </h2>
            
            <div className="space-y-3 mb-4">
              {collectedParcels.map(parcel => (
                <div
                  key={parcel.id}
                  className="border-2 border-green-200 bg-green-50 rounded-xl p-4 opacity-75"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleCollected(parcel.id, parcel.collected)}
                      className="mt-1 w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <img src={LOCKER_LOGOS[parcel.locker_type]} alt="" className="h-5 object-contain" />
                        <div className="text-xl font-bold text-gray-600 line-through break-all">
                          {parcel.code}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {getLockerName(parcel.locker_type)} • 📦 {parcel.location}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => deleteParcel(parcel.id)}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={deleteAllCollected}
              className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Supprimer tous les colis récupérés
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
