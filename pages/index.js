import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialiser Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Générer un ID utilisateur unique pour ce navigateur
const getUserId = () => {
  if (typeof window === 'undefined') return null;
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);
  }
  return userId;
};

export default function LockerParcelApp() {
  const [parcels, setParcels] = useState([]);
  const [codeInput, setCodeInput] = useState('');
  const [location, setLocation] = useState('');
  const [lockerType, setLockerType] = useState('mondial-relais');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  useEffect(() => {
    if (userId) {
      loadParcels();
    }
  }, [userId]);

  const loadParcels = async () => {
    try {
      const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('user_id', userId)
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
    const codes = text.match(/[A-Z0-9]{6}/gi);
    return codes ? [...new Set(codes)] : [];
  };

  const addParcels = async () => {
    const codes = extractParcelCodes(codeInput);
    
    if (codes.length === 0) {
      alert('Aucun code de colis valide trouvé (6 caractères requis)');
      return;
    }

    const newParcels = codes.map(code => ({
      code: code.toUpperCase(),
      location: location.trim() || 'Non spécifié',
      locker_type: lockerType,
      collected: false,
      user_id: userId
    }));

    try {
      const { data, error } = await supabase
        .from('parcels')
        .insert(newParcels)
        .select();

      if (error) throw error;
      
      setParcels([...data, ...parcels]);
      setCodeInput('');
      setLocation('');
    } catch (error) {
      console.error('Erreur d\'ajout:', error);
      alert('Erreur lors de l\'ajout des colis');
    }
  };

  const toggleCollected = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('parcels')
        .update({ collected: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setParcels(parcels.map(parcel =>
        parcel.id === id ? { ...parcel, collected: !currentStatus } : parcel
      ));
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
      case 'mondial-relais': return 'Mondial Relais';
      case 'relais-colis': return 'Relais Colis';
      case 'pickup': return 'Pickup';
      default: return 'Autre';
    }
  };

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
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-600 p-3 rounded-xl">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">Mes Colis</h1>
          </div>

          {/* Formulaire d'ajout */}
          <div className="space-y-3">
            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Collez vos codes de colis ici (6 caractères chacun)&#10;Exemples: A1B2C3, D4E5F6, G7H8I9..."
              rows="4"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-lg resize-none"
            />
            
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Emplacement (optionnel)"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
            />

            {/* Type de locker */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Type de locker :</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="lockerType"
                    value="mondial-relais"
                    checked={lockerType === 'mondial-relais'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-5 h-5 text-indigo-600"
                  />
                  <span className="text-lg">🟡 Mondial Relais</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="lockerType"
                    value="relais-colis"
                    checked={lockerType === 'relais-colis'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-5 h-5 text-indigo-600"
                  />
                  <span className="text-lg">🔵 Relais Colis</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="lockerType"
                    value="pickup"
                    checked={lockerType === 'pickup'}
                    onChange={(e) => setLockerType(e.target.value)}
                    className="w-5 h-5 text-indigo-600"
                  />
                  <span className="text-lg">🟢 Pickup</span>
                </label>
              </div>
            </div>

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
              {pendingParcels.map(parcel => (
                <div
                  key={parcel.id}
                  className="border-2 border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleCollected(parcel.id, parcel.collected)}
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
                          onChange={(e) => changeLockerType(parcel.id, e.target.value)}
                          className="text-xl bg-transparent border-none focus:outline-none cursor-pointer"
                        >
                          <option value="mondial-relais">🟡</option>
                          <option value="relais-colis">🔵</option>
                          <option value="pickup">🟢</option>
                        </select>
                        <div className="text-2xl font-bold text-indigo-600 break-all">
                          {parcel.code}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        {getLockerName(parcel.locker_type)} • 📍 {parcel.location}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        {formatDate(parcel.date_added)}
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
            
            <div className="space-y-3">
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
                        <span className="text-xl">
                          {parcel.locker_type === 'mondial-relais' && '🟡'}
                          {parcel.locker_type === 'relais-colis' && '🔵'}
                          {parcel.locker_type === 'pickup' && '🟢'}
                        </span>
                        <div className="text-xl font-bold text-gray-600 line-through break-all">
                          {parcel.code}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {getLockerName(parcel.locker_type)} • 📍 {parcel.location}
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
          </div>
        )}
      </div>
    </div>
  );
}
