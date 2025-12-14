import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, RotateCcw, Package, AlertCircle, Plus, Edit, Check, X, Upload, Trash2 } from 'lucide-react';

// Simulation du contexte theme et router
const useTheme = () => {
  const [darkMode, setDarkMode] = useState(false);
  return { darkMode, toggleDarkMode: () => setDarkMode(!darkMode) };
};

const useRouter = () => ({
  push: (path) => console.log('Navigate to:', path),
  pathname: '/inventaire'
});

// Simulation Supabase
const mockSupabase = {
  games: [
    {
      id: 1,
      name: "Les Colons de Catane",
      search_name: "catane",
      items: [
        "1 plateau de jeu modulable (19 tuiles hexagonales)",
        "4 cartes récapitulatives",
        "95 cartes ressources (Bois, Argile, Blé, Mouton, Minerai)",
        "25 cartes développement",
        "4 cartes d'aide de jeu",
        "2 cartes spéciales (Route la plus longue, Armée la plus puissante)",
        "16 villes (4 par joueur)",
        "20 colonies (5 par joueur)",
        "60 routes (15 par joueur)",
        "2 dés",
        "1 pion voleur",
        "1 livret de règles"
      ]
    },
    {
      id: 2,
      name: "Azul",
      search_name: "azul",
      items: [
        "100 tuiles en résine (20 de chaque couleur)",
        "9 disques Usine",
        "4 plateaux joueur individuels",
        "1 plateau Premier Joueur",
        "1 marqueur Premier Joueur",
        "1 sac en tissu",
        "1 livret de règles"
      ]
    }
  ]
};

export default function InventaireJeux() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [username] = useState('demo_user');
  const [loading, setLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [missingItems, setMissingItems] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [allGames, setAllGames] = useState(mockSupabase.games);
  
  // États pour création/édition
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [newGameItems, setNewGameItems] = useState(['']);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Recherche
  useEffect(() => {
    if (searchQuery.length > 1) {
      const results = allGames.filter(game =>
        game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.search_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(results);
      setShowResults(true);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchQuery, allGames]);

  const selectGame = (game) => {
    setSelectedGame(game);
    setSearchQuery('');
    setShowResults(false);
    setCheckedItems({});
    setMissingItems('');
    setEditMode(false);
  };

  const toggleItem = (index) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const resetInventory = () => {
    if (!confirm('Réinitialiser l\'inventaire de ce jeu ?')) return;
    setCheckedItems({});
    setMissingItems('');
  };

  const changeGame = () => {
    setSelectedGame(null);
    setCheckedItems({});
    setMissingItems('');
    setSearchQuery('');
    setEditMode(false);
  };

  const getProgress = () => {
    if (!selectedGame) return 0;
    const total = selectedGame.items.length;
    const checked = Object.values(checkedItems).filter(Boolean).length;
    return Math.round((checked / total) * 100);
  };

  // Création de jeu
  const openCreateModal = () => {
    setNewGameName(searchQuery);
    setNewGameItems(['']);
    setCapturedImage(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setNewGameName('');
    setNewGameItems(['']);
    setCapturedImage(null);
  };

  const addItemField = () => {
    setNewGameItems([...newGameItems, '']);
  };

  const removeItemField = (index) => {
    if (newGameItems.length <= 1) return;
    setNewGameItems(newGameItems.filter((_, i) => i !== index));
  };

  const updateItemField = (index, value) => {
    const updated = [...newGameItems];
    updated[index] = value;
    setNewGameItems(updated);
  };

  // Capture photo et OCR
  const handleImageCapture = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setIsProcessingImage(true);
  
  // Prévisualisation
  const reader = new FileReader();
  reader.onload = (event) => {
    setCapturedImage(event.target.result);
  };
  reader.readAsDataURL(file);

  // Conversion en base64
  const base64Data = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.readAsDataURL(file);
  });

  try {
    // Appel API Claude avec vision
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: file.type,
                  data: base64Data
                }
              },
              {
                type: "text",
                text: `Analyse cette image de règle de jeu de société. 
                
Extrait UNIQUEMENT la liste du matériel/contenu de la boîte.
Retourne UNIQUEMENT un JSON avec ce format exact :
{
  "items": ["élément 1", "élément 2", ...]
}

Ne retourne RIEN d'autre que le JSON. Pas de markdown, pas d'explication.`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.content[0].text;
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    
    setNewGameItems(parsed.items || []);
    setIsProcessingImage(false);
    alert('✅ Contenu détecté ! Vérifiez et modifiez si nécessaire.');
  } catch (error) {
    console.error('Erreur OCR:', error);
    alert('❌ Erreur lors de l\'analyse. Veuillez réessayer.');
    setIsProcessingImage(false);
  }
};

  const createGame = () => {
    const validItems = newGameItems.filter(item => item.trim() !== '');
    
    if (!newGameName.trim() || validItems.length === 0) {
      alert('Veuillez renseigner le nom du jeu et au moins un élément');
      return;
    }

    const newGame = {
      id: Date.now(),
      name: newGameName.trim(),
      search_name: newGameName.toLowerCase().trim(),
      items: validItems
    };

    setAllGames([...allGames, newGame]);
    alert(`✅ Le jeu "${newGameName}" a été créé et est maintenant disponible pour tous !`);
    closeCreateModal();
    selectGame(newGame);
  };

  // Édition de jeu existant
  const startEditMode = () => {
    setNewGameItems([...selectedGame.items]);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setNewGameItems([]);
  };

  const saveEdit = () => {
    const validItems = newGameItems.filter(item => item.trim() !== '');
    
    if (validItems.length === 0) {
      alert('Le jeu doit contenir au moins un élément');
      return;
    }

    const updatedGames = allGames.map(game => 
      game.id === selectedGame.id 
        ? { ...game, items: validItems }
        : game
    );

    setAllGames(updatedGames);
    setSelectedGame({ ...selectedGame, items: validItems });
    setEditMode(false);
    setCheckedItems({});
    alert('✅ Modifications enregistrées !');
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center transition-colors duration-300`}>
        <div className={`text-xl ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-amber-50 to-orange-100'} py-8 px-4 transition-colors duration-300`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className={`${darkMode ? 'text-gray-400 hover:text-orange-400 hover:bg-gray-700' : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'} p-2 rounded-lg transition`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-orange-600 p-3 rounded-xl">
                <Package size={28} color="white" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Inventaire de Jeux</h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Vérifiez le contenu de vos jeux</p>
              </div>
            </div>

            <button
              onClick={toggleDarkMode}
              className={`p-3 rounded-xl transition-all duration-300 ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
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

        {/* Recherche */}
        {!selectedGame && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4 flex items-center gap-2`}>
              <Search size={24} className="text-orange-600" />
              Rechercher un jeu
            </h2>
            
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tapez le nom d'un jeu..."
                className={`w-full px-4 py-3 border-2 rounded-xl focus:border-orange-500 focus:outline-none text-lg transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
                autoFocus
              />
              
              {showResults && searchResults.length > 0 && (
                <div className={`absolute w-full mt-2 rounded-xl shadow-xl border-2 max-h-80 overflow-y-auto z-10 ${
                  darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                }`}>
                  {searchResults.map(game => (
                    <button
                      key={game.id}
                      onClick={() => selectGame(game)}
                      className={`w-full text-left px-4 py-3 transition ${
                        darkMode 
                          ? 'hover:bg-gray-600 text-gray-100' 
                          : 'hover:bg-orange-50 text-gray-800'
                      } border-b last:border-b-0 ${darkMode ? 'border-gray-600' : 'border-gray-100'}`}
                    >
                      <div className="font-semibold">{game.name}</div>
                      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {game.items.length} éléments à vérifier
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {showResults && searchResults.length === 0 && searchQuery.length > 1 && (
                <div className={`absolute w-full mt-2 rounded-xl shadow-xl border-2 p-4 ${
                  darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={20} className="text-orange-500" />
                      <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                        Jeu introuvable
                      </span>
                    </div>
                    <button
                      onClick={openCreateModal}
                      className="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 transition flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Créer ce jeu
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`mt-6 p-4 rounded-xl ${darkMode ? 'bg-gray-700' : 'bg-orange-50'}`}>
              <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                💡 <strong>{allGames.length} jeux disponibles</strong> dans la base de données
              </p>
              <button
                onClick={openCreateModal}
                className="w-full bg-orange-600 text-white py-2 rounded-lg font-semibold hover:bg-orange-700 transition flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Créer un nouveau jeu
              </button>
            </div>
          </div>
        )}

        {/* Jeu sélectionné */}
        {selectedGame && !editMode && (
          <div className="space-y-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-2`}>
                    {selectedGame.name}
                  </h2>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {selectedGame.items.length} éléments à vérifier
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={startEditMode}
                    className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    <Edit size={18} />
                    Éditer
                  </button>
                  <button
                    onClick={changeGame}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      darkMode 
                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Changer
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Progression
                  </span>
                  <span className={`text-sm font-bold ${darkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                    {getProgress()}%
                  </span>
                </div>
                <div className={`w-full h-3 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-500"
                    style={{ width: `${getProgress()}%` }}
                  />
                </div>
              </div>

              <button
                onClick={resetInventory}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold hover:bg-orange-700 transition flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} />
                Réinitialiser l'inventaire
              </button>
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>
                Contenu de la boîte
              </h3>
              
              <div className="space-y-2">
                {selectedGame.items.map((item, index) => (
                  <label
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                      checkedItems[index]
                        ? darkMode
                          ? 'bg-green-900 bg-opacity-30 border-2 border-green-700'
                          : 'bg-green-50 border-2 border-green-300'
                        : darkMode
                          ? 'bg-gray-700 hover:bg-gray-650 border-2 border-gray-600'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checkedItems[index] || false}
                      onChange={() => toggleItem(index)}
                      className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500 mt-0.5 flex-shrink-0"
                    />
                    <span className={`text-sm ${
                      checkedItems[index]
                        ? darkMode ? 'text-green-300 line-through' : 'text-green-700 line-through'
                        : darkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4 flex items-center gap-2`}>
                <AlertCircle size={20} className="text-red-500" />
                Éléments manquants
              </h3>
              
              <textarea
                value={missingItems}
                onChange={(e) => setMissingItems(e.target.value)}
                placeholder="Notez ici les éléments manquants ou endommagés..."
                rows="6"
                className={`w-full px-4 py-3 border-2 rounded-xl focus:border-orange-500 focus:outline-none resize-none transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              />

              {missingItems && (
                <div className={`mt-4 p-4 rounded-lg ${
                  darkMode ? 'bg-red-900 bg-opacity-30 border-2 border-red-700' : 'bg-red-50 border-2 border-red-200'
                }`}>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-red-300' : 'text-red-700'} mb-2`}>
                    ⚠️ Attention : Des éléments manquent
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-red-200' : 'text-red-600'} whitespace-pre-wrap`}>
                    {missingItems}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode édition */}
        {selectedGame && editMode && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 transition-colors duration-300`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
                <Edit size={24} className="text-blue-500" />
                Éditer : {selectedGame.name}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={saveEdit}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2"
                >
                  <Check size={18} />
                  Valider
                </button>
                <button
                  onClick={cancelEdit}
                  className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                    darkMode 
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <X size={18} />
                  Annuler
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {newGameItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateItemField(index, e.target.value)}
                    placeholder={`Élément ${index + 1}`}
                    className={`flex-1 px-4 py-2 border-2 rounded-lg focus:border-blue-500 focus:outline-none transition-colors duration-300 ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                  <button
                    onClick={() => removeItemField(index)}
                    disabled={newGameItems.length <= 1}
                    className={`p-2 rounded-lg transition ${
                      newGameItems.length <= 1
                        ? 'opacity-30 cursor-not-allowed'
                        : darkMode
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addItemField}
              className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Ajouter un élément
            </button>
          </div>
        )}

        {/* Modal création */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
                  <Plus size={24} className="text-orange-600" />
                  Créer un nouveau jeu
                </h2>
                <button
                  onClick={closeCreateModal}
                  className={`p-2 rounded-lg transition ${
                    darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                    Nom du jeu *
                  </label>
                  <input
                    type="text"
                    value={newGameName}
                    onChange={(e) => setNewGameName(e.target.value)}
                    placeholder="Ex: Monopoly, Uno..."
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:border-orange-500 focus:outline-none transition-colors duration-300 ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                </div>

                <div className={`p-4 rounded-xl ${darkMode ? 'bg-blue-900 bg-opacity-30 border-2 border-blue-700' : 'bg-blue-50 border-2 border-blue-200'}`}>
                  <p className={`text-sm font-semibold ${darkMode ? 'text-blue-300' : 'text-blue-800'} mb-3 flex items-center gap-2`}>
                    <Camera size={18} />
                    Scanner la règle du jeu (OCR)
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <Camera size={18} />
                      Prendre une photo
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2"
                    >
                      <Upload size={18} />
                      Choisir un fichier
                    </button>
                  </div>
                  
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageCapture}
                    className="hidden"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageCapture}
                    className="hidden"
                  />
                  
                  {isProcessingImage && (
                    <div className="mt-3 text-center">
                      <div className="animate-spin inline-block w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                      <p className={`text-sm mt-2 ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                        Analyse de l'image en cours...
                      </p>
                    </div>
                  )}
                  
                  {capturedImage && (
                    <div className="mt-3">
                      <img src={capturedImage} alt="Règle capturée" className="w-full rounded-lg border-2 border-blue-500" />
                    </div>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
                    Contenu du jeu *
                  </label>
                  
                  <div className="space-y-3">
                    {newGameItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => updateItemField(index, e.target.value)}
                          placeholder={`Élément ${index + 1}`}
                          className={`flex-1 px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:outline-none transition-colors duration-300 ${
                            darkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                              : 'bg-white border-gray-200 text-gray-900'
                          }`}
                        />
                        <button
                          onClick={() => removeItemField(index)}
                          disabled={newGameItems.length <= 1}
                          className={`p-2 rounded-lg transition ${
                            newGameItems.length <= 1
                              ? 'opacity-30 cursor-not-allowed'
                              : darkMode
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-red-500 hover:bg-red-600 text-white'
                          }`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addItemField}
                    className="w-full mt-3 bg-orange-600 text-white py-2 rounded-lg font-semibold hover:bg-orange-700 transition flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Ajouter un élément
                  </button>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={createGame}
                    className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    Créer le jeu
                  </button>
                  <button
                    onClick={closeCreateModal}
                    className={`flex-1 py-3 rounded-xl font-bold transition ${
                      darkMode 
                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
