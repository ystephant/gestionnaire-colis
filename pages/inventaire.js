import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, RotateCcw, Package, AlertCircle, Plus, Edit, Check, X, Trash2, Grid, Home, List, ArrowLeft } from 'lucide-react';
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
  
  const [detailedView, setDetailedView] = useState(null);
  const [itemDetails, setItemDetails] = useState({});
  const [editingDetails, setEditingDetails] = useState(false);
  const [currentDetailPhotos, setCurrentDetailPhotos] = useState([]);
  const detailImageInputRef = useRef(null);
  const [currentEditingPhotoId, setCurrentEditingPhotoId] = useState(null);
  
  const [activeInventoryId, setActiveInventoryId] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');

  // Charger le mode sombre depuis localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  // Sauvegarder le mode sombre
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    fetchGames();
  }, []);

  // Synchronisation temps réel
  useEffect(() => {
    if (selectedGame && activeInventoryId) {
      setupRealtimeSync();
      return () => {
        if (window.inventoryChannel) {
          supabase.removeChannel(window.inventoryChannel);
        }
      };
    }
  }, [activeInventoryId]);

  const setupRealtimeSync = () => {
    const channel = supabase
      .channel(`inventory-${selectedGame.id}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_inventories',
          filter: `game_id=eq.${selectedGame.id}`
        },
        (payload) => {
          console.log('🔄 Changement temps réel:', payload);
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setCheckedItems(payload.new.checked_items || {});
            setMissingItems(payload.new.missing_items || '');
            setSyncStatus('✅ Synchronisé');
            setTimeout(() => setSyncStatus(''), 2000);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Synchronisation temps réel activée');
          setSyncStatus('🔄 Synchronisé en temps réel');
        }
      });

    window.inventoryChannel = channel;
  };

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

  const loadActiveInventory = async (game) => {
    try {
      const { data, error } = await supabase
        .from('game_inventories')
        .select('*')
        .eq('game_id', game.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setActiveInventoryId(data.id);
        setCheckedItems(data.checked_items || {});
        setMissingItems(data.missing_items || '');
      } else {
        const { data: newInventory, error: createError } = await supabase
          .from('game_inventories')
          .insert([{
            game_id: game.id,
            checked_items: {},
            missing_items: ''
          }])
          .select()
          .single();

        if (createError) throw createError;
        setActiveInventoryId(newInventory.id);
      }
    } catch (error) {
      console.error('Erreur chargement inventaire:', error);
    }
  };

  const selectGame = async (game) => {
    setSelectedGame(game);
    setSearchQuery('');
    setShowResults(false);
    setCheckedItems({});
    setMissingItems('');
    setEditMode(false);
    setShowAllGamesList(false);
    setDetailedView(null);
    setItemDetails(game.itemDetails || {});
    await loadActiveInventory(game);
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

  const toggleItem = async (index) => {
    const hasDetailPhotos = itemDetails[index] && itemDetails[index].filter(p => p.image).length > 0;
    
    const newCheckedItems = { ...checkedItems };
    
    if (hasDetailPhotos) {
      // Si on coche l'item parent, cocher toutes les photos détaillées
      const isChecking = !checkedItems[index];
      newCheckedItems[index] = isChecking;
      
      // Cocher/décocher toutes les photos de cet item
      itemDetails[index].forEach(photo => {
        if (photo.image) {
          newCheckedItems[`detail_${index}_${photo.id}`] = isChecking;
        }
      });
    } else {
      // Pas de photos détaillées, toggle simple
      newCheckedItems[index] = !checkedItems[index];
    }
    
    setCheckedItems(newCheckedItems);
    await saveCheckedItems(newCheckedItems);
  };

  const toggleDetailPhoto = async (itemIndex, photoId) => {
    const newCheckedItems = {
      ...checkedItems,
      [`detail_${itemIndex}_${photoId}`]: !checkedItems[`detail_${itemIndex}_${photoId}`]
    };
    
    // Vérifier si toutes les photos de cet item sont cochées
    const photos = itemDetails[itemIndex] || [];
    const allPhotosChecked = photos.filter(p => p.image).every(p => 
      newCheckedItems[`detail_${itemIndex}_${p.id}`]
    );
    
    // Mettre à jour l'item parent en conséquence
    newCheckedItems[itemIndex] = allPhotosChecked;
    
    setCheckedItems(newCheckedItems);
    await saveCheckedItems(newCheckedItems);
  };

  const saveCheckedItems = async (items) => {
    if (activeInventoryId) {
      try {
        const { error } = await supabase
          .from('game_inventories')
          .update({ 
            checked_items: items,
            updated_at: new Date().toISOString()
          })
          .eq('id', activeInventoryId);

        if (error) throw error;
      } catch (error) {
        console.error('Erreur sauvegarde:', error);
      }
    }
  };

  const resetInventory = async () => {
    if (!confirm('Réinitialiser l\'inventaire de ce jeu ?')) return;
    
    const emptyState = {};
    setCheckedItems(emptyState);
    setMissingItems('');
    
    if (activeInventoryId) {
      try {
        const { error } = await supabase
          .from('game_inventories')
          .update({ 
            checked_items: emptyState,
            missing_items: '',
            updated_at: new Date().toISOString()
          })
          .eq('id', activeInventoryId);

        if (error) throw error;
      } catch (error) {
        console.error('Erreur réinitialisation:', error);
      }
    }
  };

  const changeGame = () => {
    setSelectedGame(null);
    setCheckedItems({});
    setMissingItems('');
    setSearchQuery('');
    setEditMode(false);
    setDetailedView(null);
    setActiveInventoryId(null);
    setSyncStatus('');
    
    if (window.inventoryChannel) {
      supabase.removeChannel(window.inventoryChannel);
    }
  };

  const goHome = () => {
    router.push('/');
  };

  const getProgress = () => {
    if (!selectedGame) return 0;
    
    let totalItems = 0;
    let checkedCount = 0;
    
    selectedGame.items.forEach((item, index) => {
      const photos = itemDetails[index] || [];
      const photoCount = photos.filter(p => p.image).length;
      
      if (photoCount > 0) {
        // Compter chaque photo individuellement
        totalItems += photoCount;
        photos.forEach(photo => {
          if (photo.image && checkedItems[`detail_${index}_${photo.id}`]) {
            checkedCount++;
          }
        });
      } else {
        // Pas de photos, compter l'item simple
        totalItems += 1;
        if (checkedItems[index]) {
          checkedCount++;
        }
      }
    });
    
    return totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
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
        {syncStatus && (
          <div className="fixed top-4 right-4 bg-green-100 text-green-800 px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
            {syncStatus}
          </div>
        )}

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
             
