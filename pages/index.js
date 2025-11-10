import React, { useState, useEffect } from 'react';
import { Package, Plus, Check, Trash2, Calendar, Download } from 'lucide-react';

export default function LockerParcelApp() {
  const [parcels, setParcels] = useState([]);
  const [codeInput, setCodeInput] = useState('');
  const [location, setLocation] = useState('');
  const [lockerType, setLockerType] = useState('mondial-relais');
  const [loading, setLoading] = useState(true);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Détecter si l'app peut être installée
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Charger les colis au démarrage
  useEffect(() => {
    loadParcels();
  }, []);

  // Sauvegarder automatiquement à chaque changement
  useEffect(() => {
    if (!loading) {
      saveParcels();
    }
  }, [parcels, loading]);

  const loadParcels = async () => {
    try {
      const result = await window.storage.get('parcels');
      if (result && result.value) {
        setParcels(JSON.parse(result.value));
      }
    } catch (error) {
      console.log('Aucun colis sauvegardé');
    } finally {
      setLoading(false);
    }
  };

  const saveParcels = async () => {
    try {
      await window.storage.set('parcels', JSON.stringify(parcels));
    } catch (error) {
      console.error('Erreur de sauvegarde:', error);
    }
  };

  const installApp = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    
    setDeferredPrompt(null);
  };

  const extractParcelCodes = (text) => {
    // Extrait tous les codes de 6 caractères (lettres et chiffres)
    const codes = text.match(/[A-Z0-9]{6}/gi);
    return codes ? [...new Set(codes)] : []; // Supprime les doublons
  };

  const addParcels = () => {
    const codes = extractParcelCodes(codeInput);
    
    if (codes.length === 0) {
      alert('Aucun code de colis valide trouvé (6 caractères requis)');
      return;
    }

    const newParcels = codes.map(code => ({
      id: Date.now() + Math.random(),
      code: code.toUpperCase(),
      location: location.trim() || 'Non spécifié',
      lockerType: lockerType,
      collected: false,
      dateAdded: new Date().toISOString()
    }));

    setParcels([...newParcels, ...parcels]);
    setCodeInput('');
    setLocation('');
  };

  const toggleCollected = (id) => {
    setParcels(parcels.map(parcel =>
      parcel.id === id ? { ...parcel, collected: !parcel.collected } : parcel
    ));
  };

  const changeLockerType = (id, newType) => {
    setParcels(parcels.map(parcel =>
      parcel.id === id ? { ...parcel, lockerType: newType } : parcel
    ));
  };

  const deleteParcel = (id) => {
    setParcels(parcels.filter(parcel => parcel.id !== id));
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

  const getLockerIcon = (type) => {
    switch(type) {
      case 'mondial-relais': return '🟡';
      case 'relais-colis': return '🔵';
      case 'pickup': return '🟢';
      default: return '📦';
    }
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
        {/* Bannière d'installation */}
        {showInstallBanner && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">Installer l'application</h3>
                <p className="text-sm text-indigo-100">
                  Installez l'app sur votre ordinateur pour un accès rapide !
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={installApp}
                  className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50 transition flex items-center gap-2 whitespace-nowrap"
                >
                  <Download size={18} />
                  Installer
                </button>
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 px-3 py-2 rounded-lg transition"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-600 p-3 rounded-xl">
              <Package className="text-white" size={28} />
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
              <Plus size={20} />
              Ajouter les colis
            </button>
          </div>
        </div>

        {/* Colis en attente */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={20} className="text-orange-500" />
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
                      onClick={() => toggleCollected(parcel.id)}
                      className="mt-1 w-6 h-6 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:border-indigo-500 flex-shrink-0"
                    >
                      {parcel.collected && <Check size={16} className="text-indigo-600" />}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <select
                          value={parcel.lockerType}
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
                        {getLockerName(parcel.lockerType)} • 📍 {parcel.location}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(parcel.dateAdded)}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => deleteParcel(parcel.id)}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                    >
                      <Trash2 size={18} />
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
              <Check size={20} className="text-green-500" />
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
                      onClick={() => toggleCollected(parcel.id)}
                      className="mt-1 w-6 h-6 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                      <Check size={16} className="text-white" />
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{getLockerIcon(parcel.lockerType)}</span>
                        <div className="text-xl font-bold text-gray-600 line-through break-all">
                          {parcel.code}
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {getLockerName(parcel.lockerType)} • 📍 {parcel.location}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => deleteParcel(parcel.id)}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition flex-shrink-0"
                    >
                      <Trash2 size={18} />
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
