import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, RotateCcw, Package, AlertCircle, Plus, Edit, Check, X, Trash2, Grid, Home, List, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

export default function InventaireJeux() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [username] = useState('demo_user');
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [missingItems, setMissingItems] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [allGames, setAllGames] = useState([]);
  const [showAllGamesList, setShowAllGamesList] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [newGameItems, setNewGameItems] = useState(['']);
  const fileInputRef = useRef(null);
  
  // Vue détaillée par item
  const [detailedView, setDetailedView] = useState(null); // { itemIndex: 0, itemName: "54 cartes" }
  const [itemDetails, setItemDetails] = useState({}); // { 0: [{ id, name, image }], 1: [...] }
  const [editingDetails, setEditingDetails] = useState(false);
  const [currentDetailPhotos, setCurrentDetailPhotos] = useState([]);
  const detailImageInputRef = useRef(null);
  const [currentEditingPhotoId, setCurrentEditingPhotoId] = useState(null);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      const parsedGames = (data || []).map(game => ({
        ...game,
        items: Array.isArray(game.items) ? game.items : [],
        itemDetails: game.item_details ? (typeof game.item_details === 'object' ? game.item_details : {}) : {}
      }));
      
      setAllGames(parsedGames);
    } catch (error) {
      console.error('Erreur chargement:', error);
      alert('❌ Erreur lors du chargement des jeux');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.length > 1) {
      const results = allGames.filter(game =>
        game.name.toLowerCase().includes(searchQuery.toLowerCase())
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
    setShowAllGamesList(false);
    setDetailedView(null);
    setItemDetails(game.itemDetails || {});
  };

  const deleteGame = async (gameId, gameName) => {
    if (!confirm(`⚠️ Voulez-vous vraiment supprimer "${gameName}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;

      setAllGames(allGames.filter(game => game.id !== gameId));
      
      if (selectedGame && selectedGame.id === gameId) {
        setSelectedGame(null);
      }
      
      alert('✅ Jeu supprimé avec succès');
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const toggleItem = (index) => {
    setCheckedItems({
      ...checkedItems,
      [index]: !checkedItems[index]
    });
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
    setDetailedView(null);
  };

  const goHome = () => {
    router.push('/');
  };

  const getProgress = () => {
    if (!selectedGame) return 0;
    const total = selectedGame.items.length;
    const checked = Object.values(checkedItems).filter(Boolean).length;
    return Math.round((checked / total) * 100);
  };

  const openCreateModal = () => {
    setNewGameName(searchQuery);
    setNewGameItems(['']);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setNewGameName('');
    setNewGameItems(['']);
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

  // Ouvrir la vue détaillée d'un item
  const openDetailedView = (itemIndex, itemName) => {
    const photos = itemDetails[itemIndex] || [];
    setCurrentDetailPhotos(photos);
    setDetailedView({ itemIndex, itemName });
    setEditingDetails(false);
  };

  const closeDetailedView = () => {
    setDetailedView(null);
    setCurrentDetailPhotos([]);
    setEditingDetails(false);
  };

  const startEditingDetails = () => {
    setEditingDetails(true);
  };

  const cancelEditingDetails = () => {
    setEditingDetails(false);
    const photos = itemDetails[detailedView.itemIndex] || [];
    setCurrentDetailPhotos(photos);
  };

  // Ajouter une photo dans la vue détaillée
  const addDetailPhoto = () => {
    const newPhoto = {
      id: `photo_${Date.now()}`,
      name: '',
      image: null
    };
    setCurrentDetailPhotos([...currentDetailPhotos, newPhoto]);
  };

  const handleDetailPhotoCapture = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentEditingPhotoId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const updatedPhotos = currentDetailPhotos.map(photo => 
        photo.id === currentEditingPhotoId 
          ? { ...photo, image: event.target.result }
          : photo
      );
      setCurrentDetailPhotos(updatedPhotos);
      setCurrentEditingPhotoId(null);
    };
    reader.readAsDataURL(file);
  };

  const openDetailPhotoCapture = (photoId) => {
    setCurrentEditingPhotoId(photoId);
    detailImageInputRef.current?.click();
  };

  const updateDetailPhotoName = (photoId, name) => {
    const updated = currentDetailPhotos.map(photo =>
      photo.id === photoId ? { ...photo, name } : photo
    );
    setCurrentDetailPhotos(updated);
  };

  const removeDetailPhoto = (photoId) => {
    setCurrentDetailPhotos(currentDetailPhotos.filter(photo => photo.id !== photoId));
  };

  const saveDetailedView = async () => {
    // Permettre la sauvegarde même sans nom
    const validPhotos = currentDetailPhotos.filter(photo => photo.image !== null);
    
    const updatedItemDetails = {
      ...itemDetails,
      [detailedView.itemIndex]: validPhotos
    };

    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          item_details: updatedItemDetails,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedGame.id);

      if (error) throw error;

      const updatedGame = {
        ...selectedGame,
        itemDetails: updatedItemDetails
      };

      const updatedGames = allGames.map(game =>
        game.id === selectedGame.id ? updatedGame : game
      );

      setAllGames(updatedGames);
      setSelectedGame(updatedGame);
      setItemDetails(updatedItemDetails);
      setEditingDetails(false);
      alert('✅ Photos enregistrées !');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('❌ Erreur lors de la sauvegarde');
    }
  };

  const createGame = async () => {
    const validItems = newGameItems.filter(item => item.trim() !== '');
    
    if (!newGameName.trim() || validItems.length === 0) {
      alert('Veuillez renseigner le nom du jeu et au moins un élément');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('games')
        .insert([{
          name: newGameName.trim(),
          search_name: newGameName.toLowerCase().trim(),
          items: validItems,
          item_details: {},
          created_by: username
        }])
        .select()
        .single();

      if (error) throw error;

      const newGame = {
        ...data,
        itemDetails: {}
      };

      setAllGames([newGame, ...allGames].sort((a, b) => a.name.localeCompare(b.name)));
      alert(`✅ Le jeu "${newGameName}" a été créé !`);
      closeCreateModal();
      selectGame(newGame);
    } catch (error) {
      console.error('Erreur création:', error);
      alert('❌ Erreur lors de la création du jeu');
    }
  };

  const startEditMode = () => {
    setNewGameItems([...selectedGame.items]);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setNewGameItems([]);
  };

  const saveEdit = async () => {
    const validItems = newGameItems.filter(item => item.trim() !== '');
    
    if (validItems.length === 0) {
      alert('Le jeu doit contenir au moins un élément');
      return;
    }

    try {
      const { error } = await supabase
        .from('games')
        .update({ 
          items: validItems,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedGame.id);

      if (error) throw error;

      const updatedGame = { ...selectedGame, items: validItems };
      const updatedGames = allGames.map(game => 
        game.id === selectedGame.id ? updatedGame : game
      );

      setAllGames(updatedGames);
      setSelectedGame(updatedGame);
      setEditMode(false);
      setCheckedItems({});
      alert('✅ Modifications enregistrées !');
    } catch (error) {
      console.error('Erreur modification:', error);
      alert('❌ Erreur lors de la modification');
    }
  };

  const getDetailPhotoCount = (itemIndex) => {
    const photos = itemDetails[itemIndex] || [];
    return photos.filter(p => p.image).length;
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mb-4"></div>
          <div className={`text-xl ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Chargement des jeux...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-amber-50 to-orange-100'} py-8 px-4`}>
      <div className="max-w-4xl mx-auto">
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={goHome}
                className={`${darkMode ? 'text-gray-400 hover:text-orange-400 hover:bg-gray-700' : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'} p-2 rounded-lg transition`}
                title="Retour à l'accueil"
              >
                <Home size={24} />
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
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 rounded-xl transition-all duration-300 ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {!selectedGame && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
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
                className={`w-full px-4 py-3 border-2 rounded-xl focus:border-orange-500 focus:outline-none text-lg ${
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
                    <div key={game.id} className="flex items-center justify-between group">
                      <button
                        onClick={() => selectGame(game)}
                        className={`flex-1 text-left px-4 py-3 transition ${
                          darkMode 
                            ? 'hover:bg-gray-600 text-gray-100' 
                            : 'hover:bg-orange-50 text-gray-800'
                        } border-b last:border-b-0 ${darkMode ? 'border-gray-600' : 'border-gray-100'}`}
                      >
                        <div className="font-semibold">{game.name}</div>
                        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {game.items.length} éléments
                        </div>
                      </button>
                      <button
                        onClick={() => deleteGame(game.id, game.name)}
                        className={`px-3 py-3 opacity-0 group-hover:opacity-100 transition ${
                          darkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
                        }`}
                        title="Supprimer ce jeu"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
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
              <div className="flex items-center justify-between mb-3">
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  💡 <strong>{allGames.length} jeu{allGames.length > 1 ? 'x' : ''}</strong> dans votre collection
                </p>
                <button
                  onClick={() => setShowAllGamesList(!showAllGamesList)}
                  className={`text-sm font-semibold flex items-center gap-1 ${
                    darkMode ? 'text-orange-400 hover:text-orange-300' : 'text-orange-600 hover:text-orange-700'
                  }`}
                >
                  <List size={16} />
                  {showAllGamesList ? 'Masquer' : 'Voir la liste'}
                </button>
              </div>

              {showAllGamesList && allGames.length > 0 && (
                <div className={`mb-3 max-h-60 overflow-y-auto rounded-lg border-2 ${
                  darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-white'
                }`}>
                  {allGames.map(game => (
                    <div key={game.id} className="flex items-center justify-between group">
                      <button
                        onClick={() => selectGame(game)}
                        className={`flex-1 text-left px-3 py-2 text-sm transition ${
                          darkMode 
                            ? 'hover:bg-gray-700 text-gray-200' 
                            : 'hover:bg-orange-50 text-gray-800'
                        } border-b last:border-b-0 ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}
                      >
                        {game.name}
                      </button>
                      <button
                        onClick={() => deleteGame(game.id, game.name)}
                        className={`px-2 py-2 opacity-0 group-hover:opacity-100 transition ${
                          darkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
                        }`}
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
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

        {/* Vue normale - Liste avec icônes détails */}
        {selectedGame && !editMode && !detailedView && (
          <div className="space-y-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
              <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div className="flex-1 min-w-[200px]">
                  <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-2`}>
                    {selectedGame.name}
                  </h2>
                  <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {selectedGame.items.length} éléments à vérifier
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={startEditMode}
                    className={`px-3 py-2 rounded-lg font-medium transition flex items-center gap-2 text-sm ${
                      darkMode 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    <Edit size={16} />
                    Éditer
                  </button>
                  <button
                    onClick={() => deleteGame(selectedGame.id, selectedGame.name)}
                    className={`px-3 py-2 rounded-lg font-medium transition text-sm ${
                      darkMode 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={changeGame}
                    className={`px-3 py-2 rounded-lg font-medium transition text-sm ${
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

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>
                Contenu de la boîte
              </h3>
              
              <div className="space-y-2">
                {selectedGame.items.map((item, index) => {
                  const photoCount = getDetailPhotoCount(index);
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        onClick={() => openDetailedView(index, item)}
                        className={`p-2 rounded-lg transition ${
                          photoCount > 0
                            ? darkMode
                              ? 'bg-purple-600 hover:bg-purple-700 text-white'
                              : 'bg-purple-500 hover:bg-purple-600 text-white'
                            : darkMode
                              ? 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                        }`}
                        title={photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? 's' : ''}` : 'Ajouter des photos'}
                      >
                        <Grid size={16} />
                      </button>
                      
                      <label
                        className={`flex-1 flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
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
                        <div className="flex-1">
                          <span className={`text-sm ${
                            checkedItems[index]
                              ? darkMode ? 'text-green-300 line-through' : 'text-green-700 line-through'
                              : darkMode ? 'text-gray-200' : 'text-gray-800'
                          }`}>
                            {item}
                          </span>
                          {photoCount > 0 && (
                            <div className={`text-xs mt-1 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                              📸 {photoCount} photo{photoCount > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
              <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4 flex items-center gap-2`}>
                <AlertCircle size={20} className="text-red-500" />
                Éléments manquants
              </h3>
              
              <textarea
                value={missingItems}
                onChange={(e) => setMissingItems(e.target.value)}
                placeholder="Notez ici les éléments manquants ou endommagés..."
                rows="6"
                className={`w-full px-4 py-3 border-2 rounded-xl focus:border-orange-500 focus:outline-none resize-none ${
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

        {/* Mode édition liste */}
        {selectedGame && editMode && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
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
                    className={`flex-1 px-4 py-2 border-2 rounded-lg focus:border-blue-500 focus:outline-none ${
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

        {/* Vue détaillée d'un item avec photos */}
        {selectedGame && detailedView && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <button
                  onClick={closeDetailedView}
                  className={`p-2 rounded-lg transition ${
                    darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <ArrowLeft size={24} />
                </button>
                <div>
                  <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
                    <Grid size={24} className="text-purple-500" />
                    {detailedView.itemName}
                  </h2>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {currentDetailPhotos.filter(p => p.image).length} photo{currentDetailPhotos.filter(p => p.image).length > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {editingDetails ? (
                  <>
                    <button
                      onClick={saveDetailedView}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2"
                    >
                      <Check size={18} />
                      Sauvegarder
                    </button>
                    <button
                      onClick={cancelEditingDetails}
                      className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                        darkMode 
                          ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <X size={18} />
                      Annuler
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startEditingDetails}
                    className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                      darkMode 
                        ? 'bg-purple-600 text-white hover:bg-purple-700' 
                        : 'bg-purple-500 text-white hover:bg-purple-600'
                    }`}
                  >
                    <Edit size={18} />
                    Gérer les photos
                  </button>
                )}
              </div>
            </div>

            {editingDetails ? (
              <>
                <div className={`mb-4 p-4 rounded-xl ${darkMode ? 'bg-blue-900 bg-opacity-30' : 'bg-blue-50'}`}>
                  <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                    💡 Cliquez sur chaque carte pour ajouter une photo. Le nom est optionnel.
                  </p>
                </div>

                <input
                  ref={detailImageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleDetailPhotoCapture}
                  className="hidden"
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                  {currentDetailPhotos.map((photo) => (
                    <div key={photo.id} className={`border-2 rounded-lg overflow-hidden ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                      <div 
                        onClick={() => openDetailPhotoCapture(photo.id)}
                        className={`aspect-square cursor-pointer relative ${
                          darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                        } transition`}
                      >
                        {photo.image ? (
                          <img src={photo.image} alt={photo.name || 'Photo'} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Camera size={32} className={darkMode ? 'text-gray-500' : 'text-gray-400'} />
                            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              Ajouter photo
                            </span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeDetailPhoto(photo.id);
                            }}
                            className="bg-red-600 text-white p-1 rounded-full hover:bg-red-700 transition"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={photo.name}
                        onChange={(e) => updateDetailPhotoName(photo.id, e.target.value)}
                        placeholder="Nom (optionnel)"
                        className={`w-full px-2 py-2 text-xs focus:outline-none ${
                          darkMode ? 'bg-gray-800 text-gray-100' : 'bg-white text-gray-900'
                        }`}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={addDetailPhoto}
                  className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Ajouter une photo
                </button>
              </>
            ) : (
              <>
                {currentDetailPhotos.filter(p => p.image).length === 0 ? (
                  <div className={`text-center py-12 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    <Grid size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg mb-2">Aucune photo pour cet élément</p>
                    <p className="text-sm">Cliquez sur "Gérer les photos" pour ajouter des photos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {currentDetailPhotos.filter(p => p.image).map((photo) => {
                      const isChecked = checkedItems[`detail_${detailedView.itemIndex}_${photo.id}`];
                      return (
                        <div
                          key={photo.id}
                          onClick={() => {
                            setCheckedItems({
                              ...checkedItems,
                              [`detail_${detailedView.itemIndex}_${photo.id}`]: !isChecked
                            });
                          }}
                          className={`relative aspect-square rounded-lg cursor-pointer transition-all border-4 overflow-hidden ${
                            isChecked
                              ? 'border-green-500 opacity-60'
                              : darkMode
                                ? 'border-gray-600 hover:border-purple-500'
                                : 'border-gray-200 hover:border-purple-500'
                          }`}
                        >
                          <img 
                            src={photo.image} 
                            alt={photo.name || 'Photo'}
                            className="w-full h-full object-cover"
                          />
                          
                          {isChecked && (
                            <div className="absolute inset-0 bg-green-500 bg-opacity-50 flex items-center justify-center">
                              <Check size={48} className="text-white" />
                            </div>
                          )}
                          
                          {photo.name && (
                            <div className={`absolute bottom-0 left-0 right-0 p-2 text-xs font-medium text-center ${
                              darkMode ? 'bg-gray-900 bg-opacity-80 text-gray-100' : 'bg-white bg-opacity-90 text-gray-800'
                            }`}>
                              {photo.name}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
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
                    placeholder="Ex: Monopoly, Uno, Detective Club..."
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:border-orange-500 focus:outline-none ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                        : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
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
                          placeholder={`Ex: 54 cartes, 8 pions loupes...`}
                          className={`flex-1 px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:outline-none ${
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
