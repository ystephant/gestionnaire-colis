import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, RotateCcw, Package, AlertCircle, Plus, Edit, Check, X, Trash2, Grid, Home, List, ArrowLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// 🔗 Connexion Supabase depuis les variables d'environnement Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 📸 Optimiser les images Cloudinary
const getOptimizedImage = (url, width = 400) => {
  if (!url) return url;
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
};
// ⚙️ CONFIGURATION CLOUDINARY - REMPLACEZ PAR VOS VALEURS
const CLOUDINARY_CLOUD_NAME = 'dfnwxqjey'; // ← Changez ici
const CLOUDINARY_UPLOAD_PRESET = 'boardgames_upload'; // ← Changez ici
const USE_SEPARATE_PHOTO_TABLE = true; // true = nouvelle table game_photos, false = ancien système item_details

// 🎨 Composant principal
export default function InventaireJeux() {
  const [darkMode, setDarkMode] = useState(false);
  const [username] = useState('demo_user');
  const [loading, setLoading] = useState(false);
  
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
  
  const [detailedView, setDetailedView] = useState(null);
  const [itemDetails, setItemDetails] = useState({});
  const [editingDetails, setEditingDetails] = useState(false);
  const [currentDetailPhotos, setCurrentDetailPhotos] = useState([]);
  const detailImageInputRef = useRef(null);
  const [currentEditingPhotoId, setCurrentEditingPhotoId] = useState(null);
  
  const [activeInventoryId, setActiveInventoryId] = useState(null);
  const [syncStatus, setSyncStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 📸 Upload vers Cloudinary (parallèle et optimisé)
  const uploadToCloudinary = async (file, folder = 'boardgames') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.secure_url,
      publicId: data.public_id
    };
  };

// 📥 Charger les jeux depuis Supabase
const loadGames = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    setAllGames(data || []);
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    setLoading(false);
  }
};

  // 1️⃣ Chargement initial seulement
useEffect(() => {
  const savedDarkMode = localStorage.getItem('darkMode');
  if (savedDarkMode !== null) {
    setDarkMode(savedDarkMode === 'true');
  }
  
  loadGames();
}, []); // ✅ Vide = une seule fois au démarrage

// 2️⃣ Synchronisation temps réel SÉPARÉE
useEffect(() => {
  const channel = supabase
    .channel('games-realtime')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'games' }, 
      async (payload) => {
        console.log('🔄 Changement Supabase détecté:', payload);
        
        if (payload.eventType === 'UPDATE' && payload.new) {
          // ✅ Mettre à jour le jeu dans la liste
          setAllGames(prev => 
            prev.map(game => 
              game.id === payload.new.id ? payload.new : game
            )
          );
          
          // ✅ Si c'est le jeu actuellement sélectionné, le mettre à jour
          setSelectedGame(prev => {
            if (prev && prev.id === payload.new.id) {
              // 🔥 MISE À JOUR TEMPS RÉEL DES COCHAGES
              setCheckedItems(payload.new.checked_items || {});
              setMissingItems(payload.new.missing_items || '');
              setItemDetails(payload.new.item_details || {});
              
              setSyncStatus('🔄 Synchronisé');
              setTimeout(() => setSyncStatus(''), 2000);
              
              return payload.new;
            }
            return prev;
          });
        } else if (payload.eventType === 'INSERT') {
          await loadGames();
        } else if (payload.eventType === 'DELETE') {
          console.log('🗑️ Suppression détectée:', payload.old);
          
          // Supprimer de la liste
          setAllGames(prev => prev.filter(g => g.id !== payload.old.id));
          
          // Désélectionner si c'était le jeu actif
          if (selectedGame?.id === payload.old.id) {
            setSelectedGame(null);
          }
        }
      }
    )
    .subscribe();
  
  return () => supabase.removeChannel(channel);
}, []); // ✅ Écoute permanente, pas de dépendance !

   useEffect(() => {
  localStorage.setItem('darkMode', darkMode.toString());
}, [darkMode]);

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

  // 📸 Upload MULTIPLE parallèle (10x plus rapide qu'ImgBB)
  const handleDetailPhotoCapture = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Vérifier la configuration
    if (CLOUDINARY_CLOUD_NAME === 'VOTRE_CLOUD_NAME') {
      alert('⚠️ Veuillez configurer Cloudinary dans le code !\n\nÉtapes:\n1. Créez un compte sur cloudinary.com\n2. Notez votre Cloud Name\n3. Créez un Upload Preset "unsigned"\n4. Remplacez CLOUDINARY_CLOUD_NAME et CLOUDINARY_UPLOAD_PRESET dans le code');
      return;
    }

    setUploadingPhotos(true);
    setUploadProgress(0);

    try {
      // ⚡ UPLOAD PARALLÈLE - toutes les photos en même temps !
      let completed = 0;
      const uploadPromises = files.map(async (file, index) => {
        // Vérifier la taille (10MB max par défaut)
        if (file.size > 10 * 1024 * 1024) {
          console.warn(`⚠️ ${file.name} trop grande, ignorée`);
          return null;
        }

        try {
          const folder = selectedGame 
            ? `boardgames/${selectedGame.id}/${detailedView?.itemIndex || 0}`
            : 'boardgames/demo';
            
          const result = await uploadToCloudinary(file, folder);
          
          completed++;
          setUploadProgress(Math.round((completed / files.length) * 100));
          
          return {
            id: `photo_${Date.now()}_${index}`,
            name: '',
            image: result.url,
            cloudinaryPublicId: result.publicId
          };
        } catch (error) {
          console.error(`Erreur upload ${file.name}:`, error);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const newPhotos = results.filter(p => p !== null);

      setCurrentDetailPhotos([...currentDetailPhotos, ...newPhotos]);
      
      alert(`✅ ${newPhotos.length} photo(s) uploadée(s) sur Cloudinary en ${((Date.now() - performance.now()) / 1000).toFixed(1)}s !`);
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('❌ Erreur lors de l\'upload des photos');
    } finally {
      setUploadingPhotos(false);
      setUploadProgress(0);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (editingDetails) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (!editingDetails) return;

    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (files.length === 0) return;

    // Simuler l'événement file input
    const fakeEvent = { target: { files } };
    await handleDetailPhotoCapture(fakeEvent);
  };

  const selectGame = (game) => {
  setSelectedGame(game);
  setSearchQuery('');
  setShowResults(false);
  setCheckedItems(game.checked_items || {});
  setMissingItems(game.missing_items || '');
  setEditMode(false);
  setShowAllGamesList(false);
  setDetailedView(null);
  setItemDetails(game.item_details || {});
};
  const deleteGame = async (gameId, gameName) => {
    if (!confirm(`⚠️ Voulez-vous vraiment supprimer "${gameName}" ?`)) return;
    
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) throw error;

      // Désélectionner immédiatement
      if (selectedGame?.id === gameId) {
        setSelectedGame(null);
      }

      // Supprimer localement (la synchro temps réel confirmera)
      setAllGames(prev => prev.filter(g => g.id !== gameId));

      setSyncStatus('✅ Supprimé');
      setTimeout(() => setSyncStatus(''), 2000);
      
      // ✅ PAS DE loadGames() ! La synchro temps réel s'en occupe
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  };

  const toggleItem = async (index) => {
  const hasDetailPhotos = itemDetails[index]?.filter(p => p.image).length > 0;
  const newCheckedItems = { ...checkedItems };
  
  if (hasDetailPhotos) {
    const isChecking = !checkedItems[index];
    newCheckedItems[index] = isChecking;
    itemDetails[index].forEach(photo => {
      if (photo.image) {
        newCheckedItems[`detail_${index}_${photo.id}`] = isChecking;
      }
    });
  } else {
    newCheckedItems[index] = !checkedItems[index];
  }
  
  setCheckedItems(newCheckedItems);
  
  try {
    const { error } = await supabase
      .from('games')
      .update({ checked_items: newCheckedItems })
      .eq('id', selectedGame.id);

    if (error) throw error;
    
    setSyncStatus('✅ Sauvegardé');
    setTimeout(() => setSyncStatus(''), 1500);
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }
  // ✅ PAS DE loadGames() ici ! La synchro temps réel s'en charge
};
  const toggleDetailPhoto = async (itemIndex, photoId) => {
  const newCheckedItems = {
    ...checkedItems,
    [`detail_${itemIndex}_${photoId}`]: !checkedItems[`detail_${itemIndex}_${photoId}`]
  };
  
  const photos = itemDetails[itemIndex] || [];
  const allPhotosChecked = photos.filter(p => p.image).every(p => 
    newCheckedItems[`detail_${itemIndex}_${p.id}`]
  );
  
  newCheckedItems[itemIndex] = allPhotosChecked;
  setCheckedItems(newCheckedItems);
  
  try {
    const { error } = await supabase
      .from('games')
      .update({ checked_items: newCheckedItems })
      .eq('id', selectedGame.id);

    if (error) throw error;
    
    setSyncStatus('✅ Sauvegardé');
    setTimeout(() => setSyncStatus(''), 1500);
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }
  // ✅ PAS DE loadGames() ici !
};

  const resetInventory = async () => {
  if (!confirm('Réinitialiser l\'inventaire ?')) return;
  
  setCheckedItems({});
  setMissingItems('');
  
  // 💾 Sauvegarder dans Supabase
  try {
    const { error } = await supabase
      .from('games')
      .update({ 
        checked_items: {},
        missing_items: ''
      })
      .eq('id', selectedGame.id);

    if (error) throw error;
    
    setSyncStatus('✅ Inventaire réinitialisé');
    setTimeout(() => setSyncStatus(''), 1500);
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }
};

  const changeGame = () => {
    setSelectedGame(null);
    setCheckedItems({});
    setMissingItems('');
    setSearchQuery('');
    setEditMode(false);
    setDetailedView(null);
  };

  const getProgress = () => {
    if (!selectedGame) return 0;
    
    let totalItems = 0;
    let checkedCount = 0;
    
    selectedGame.items.forEach((item, index) => {
      const photos = itemDetails[index] || [];
      const photoCount = photos.filter(p => p.image).length;
      
      if (photoCount > 0) {
        totalItems += photoCount;
        photos.forEach(photo => {
          if (photo.image && checkedItems[`detail_${index}_${photo.id}`]) {
            checkedCount++;
          }
        });
      } else {
        totalItems += 1;
        if (checkedItems[index]) checkedCount++;
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
    setCurrentEditingPhotoId(null);
    detailImageInputRef.current?.click();
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
  
  // 💾 Auto-save après 1 seconde d'inactivité
  clearTimeout(window.photoNameTimer);
  window.photoNameTimer = setTimeout(async () => {
    const updatedItemDetails = {
      ...itemDetails,
      [detailedView.itemIndex]: updated.filter(p => p.image !== null)
    };
    
    try {
      const { error } = await supabase
        .from('games')
        .update({ item_details: updatedItemDetails })
        .eq('id', selectedGame.id);

      if (error) throw error;
      
      setItemDetails(updatedItemDetails);
      setSyncStatus('✅ Nom sauvegardé');
      setTimeout(() => setSyncStatus(''), 1500);
    } catch (error) {
      console.error('Erreur:', error);
    }
  }, 1000);
};

  const removeDetailPhoto = async (photoId) => {
  const updatedPhotos = currentDetailPhotos.filter(photo => photo.id !== photoId);
  setCurrentDetailPhotos(updatedPhotos);
  
  // 💾 Sauvegarder immédiatement dans Supabase
  const updatedItemDetails = {
    ...itemDetails,
    [detailedView.itemIndex]: updatedPhotos.filter(p => p.image !== null)
  };
  
  try {
    const { error } = await supabase
      .from('games')
      .update({ item_details: updatedItemDetails })
      .eq('id', selectedGame.id);

    if (error) throw error;
    
    setItemDetails(updatedItemDetails);
    setSyncStatus('✅ Photo supprimée');
    setTimeout(() => setSyncStatus(''), 1500);
  } catch (error) {
    console.error('Erreur:', error);
  }
};

  const saveDetailedView = async () => {
    const validPhotos = currentDetailPhotos.filter(photo => photo.image !== null);
    
    const updatedItemDetails = {
      ...itemDetails,
      [detailedView.itemIndex]: validPhotos
    };

    const updatedGame = {
      ...selectedGame,
      itemDetails: updatedItemDetails
    };

    try {
  const { error } = await supabase
    .from('games')
    .update({ item_details: updatedItemDetails })
    .eq('id', selectedGame.id);

  if (error) throw error;

  setSyncStatus('✅ Photos enregistrées avec succès !');
  setTimeout(() => setSyncStatus(''), 3000);
  
  // Message de confirmation
  alert(`✅ ${validPhotos.length} photo(s) enregistrée(s) avec succès !`);
  
  // Fermer le mode édition
  setEditingDetails(false);
  
  setItemDetails(updatedItemDetails);

// ✅ Mettre à jour directement sans recharger
setSelectedGame(prev => ({
  ...prev,
  item_details: updatedItemDetails
}));

setAllGames(prev => 
  prev.map(g => 
    g.id === selectedGame.id 
      ? { ...g, item_details: updatedItemDetails }
      : g
  )
);
} catch (error) {
  console.error('Erreur:', error);
  alert('❌ Erreur sauvegarde photos');
}
  };

  const createGame = async () => {
    const validItems = newGameItems.filter(item => item.trim() !== '');
    
    if (!newGameName.trim() || validItems.length === 0) {
      alert('Veuillez renseigner le nom du jeu et au moins un élément');
      return;
    }

    const newGame = {
      id: Date.now(),
      name: newGameName.trim(),
      items: validItems,
      itemDetails: {},
      created_by: username,
      created_at: new Date().toISOString()
    };

    try {
  const { data, error } = await supabase
    .from('games')
    .insert({
      name: newGameName.trim(),
      search_name: newGameName.trim().toLowerCase(),
      items: validItems,
      item_details: {},
      created_by: username
    })
    .select()
    .single();

  if (error) throw error;

  setSyncStatus('✅ Jeu créé');
  setTimeout(() => setSyncStatus(''), 2000);
  
  closeCreateModal();
  await loadGames();
  if (data) selectGame(data);
} catch (error) {
  console.error('Erreur:', error);
  alert('❌ Erreur création');
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

    const updatedGame = { ...selectedGame, items: validItems };
    try {
  const { error } = await supabase
    .from('games')
    .update({ items: validItems })
    .eq('id', selectedGame.id);

  if (error) throw error;

  setSyncStatus('✅ Synchronisé');
  setTimeout(() => setSyncStatus(''), 2000);
  
  setEditMode(false);
setCheckedItems({});

// ✅ Mettre à jour directement
const updatedGame = { ...selectedGame, items: validItems };
setSelectedGame(updatedGame);

setAllGames(prev => 
  prev.map(g => 
    g.id === selectedGame.id ? updatedGame : g
  )
);
} catch (error) {
  console.error('Erreur:', error);
  alert('❌ Erreur sauvegarde');
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
          <div className={`text-xl ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Chargement...</div>
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
                onClick={() => {
                  setSelectedGame(null);
                  setDetailedView(null);
                  setEditMode(false);
                  setSearchQuery('');
                  setShowResults(false);
                }}
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
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Avec Cloudinary - Upload ultra rapide ⚡</p>
              </div>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
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
  onChange={async (e) => {
    const newValue = e.target.value;
    setMissingItems(newValue);
    
    // 💾 Sauvegarder automatiquement après 1 seconde d'inactivité
    clearTimeout(window.missingItemsTimer);
    window.missingItemsTimer = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('games')
          .update({ missing_items: newValue })
          .eq('id', selectedGame.id);

        if (error) throw error;
        
        setSyncStatus('✅ Notes sauvegardées');
        setTimeout(() => setSyncStatus(''), 1500);
      } catch (error) {
        console.error('Erreur sauvegarde:', error);
      }
    }, 1000);
  }}
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

        {selectedGame && detailedView && (
          <DetailedViewComponent
            detailedView={detailedView}
            currentDetailPhotos={currentDetailPhotos}
            editingDetails={editingDetails}
            darkMode={darkMode}
            closeDetailedView={closeDetailedView}
            startEditingDetails={startEditingDetails}
            saveDetailedView={saveDetailedView}
            cancelEditingDetails={cancelEditingDetails}
            detailImageInputRef={detailImageInputRef}
            handleDetailPhotoCapture={handleDetailPhotoCapture}
            openDetailPhotoCapture={openDetailPhotoCapture}
            removeDetailPhoto={removeDetailPhoto}
            updateDetailPhotoName={updateDetailPhotoName}
            addDetailPhoto={addDetailPhoto}
            checkedItems={checkedItems}
            toggleDetailPhoto={toggleDetailPhoto}
            isDragging={isDragging}
            handleDragEnter={handleDragEnter}
            handleDragLeave={handleDragLeave}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            uploadingPhotos={uploadingPhotos}
            uploadProgress={uploadProgress}
          />
        )}

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

// 🎨 Composant Vue Détaillée - SANS PAGINATION - Scroll infini fluide
function DetailedViewComponent({ 
  detailedView, currentDetailPhotos, editingDetails, darkMode,
  closeDetailedView, startEditingDetails, saveDetailedView, cancelEditingDetails,
  detailImageInputRef, handleDetailPhotoCapture, openDetailPhotoCapture,
  removeDetailPhoto, updateDetailPhotoName, addDetailPhoto,
  checkedItems, toggleDetailPhoto,
  isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
  uploadingPhotos, uploadProgress
}) {
const [currentPage, setCurrentPage] = useState(1);
  const PHOTOS_PER_PAGE = 20;

  // 🚀 AJOUTEZ CES LIGNES ICI :
  const paginatedPhotos = React.useMemo(() => {
    return currentDetailPhotos
      .filter(p => p.image)
      .slice((currentPage - 1) * PHOTOS_PER_PAGE, currentPage * PHOTOS_PER_PAGE);
  }, [currentDetailPhotos, currentPage, PHOTOS_PER_PAGE]);
  
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);
  const [lastTap, setLastTap] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const PHOTOS_PER_PAGE = 20;

  const handlePhotoClick = (e, photo) => {
    const now = Date.now();
    const DOUBLE_CLICK_DELAY = 300;

    if (now - lastTap < DOUBLE_CLICK_DELAY) {
      e.stopPropagation();
      setFullscreenPhoto(photo);
      setLastTap(0);
    } else {
      setLastTap(now);
    }
  };

  const closeFullscreen = () => {
    setFullscreenPhoto(null);
  };

  return (
    <>
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
                {currentDetailPhotos.filter(p => p.image).length} photo{currentDetailPhotos.filter(p => p.image).length > 1 ? 's' : ''} • Pagination active
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
                ⚡ Upload ultra-rapide avec Cloudinary ! Glissez-déposez vos photos ou cliquez sur "Ajouter des photos".
              </p>
              <p className={`text-xs mt-1 ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                📸 {currentDetailPhotos.filter(p => p.image).length} photos • Pagination 20 par page
              </p>
            </div>

            {uploadingPhotos && (
              <div className="mb-4 p-4 rounded-xl bg-purple-100 dark:bg-purple-900 dark:bg-opacity-30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                    📤 Upload en cours... {uploadProgress}%
                  </p>
                </div>
                <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <input
              ref={detailImageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleDetailPhotoCapture}
              className="hidden"
            />

            <div 
              className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4 relative transition-all ${
                isDragging ? 'ring-4 ring-purple-500 ring-opacity-50 bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 rounded-xl p-4' : ''
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-purple-500 bg-opacity-10 rounded-xl border-4 border-dashed border-purple-500 pointer-events-none z-10">
                  <div className="text-center">
                    <Camera size={48} className="mx-auto mb-2 text-purple-600" />
                    <p className={`text-lg font-bold ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                      Déposez vos photos ici
                    </p>
                  </div>
                </div>
              )}
              
              {currentDetailPhotos.map((photo) => (
                <div key={photo.id} className={`border-2 rounded-lg overflow-hidden ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  <div 
                    onClick={() => openDetailPhotoCapture(photo.id)}
                    className={`aspect-square cursor-pointer relative ${
                      darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                    } transition`}
                  >
                    {photo.image ? (
                      <img 
                        src={getOptimizedImage(photo.image, 400)} 
                        alt={photo.name || 'Photo'} 
                        className="w-full h-full object-cover" 
                        loading="lazy"
                        decoding="async"
                      />
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
              Ajouter des photos
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
              <div>
                <div className={`mb-4 p-3 rounded-xl ${darkMode ? 'bg-purple-900 bg-opacity-30' : 'bg-purple-50'}`}>
                  <p className={`text-xs ${darkMode ? 'text-purple-300' : 'text-purple-800'}`}>
                    💡 Double-cliquez sur une photo pour la voir en plein écran • Navigation par pages
                  </p>
                </div>
                
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {paginatedPhotos.map((photo) => {
                    const isChecked = checkedItems[`detail_${detailedView.itemIndex}_${photo.id}`];
                    return (
                      <div
  key={photo.id}
  onClick={(e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      // Double-clic détecté
      e.stopPropagation();
      setFullscreenPhoto(photo);
      setLastTap(0);
    } else {
      // Simple clic
      setLastTap(now);
      toggleDetailPhoto(detailedView.itemIndex, photo.id);
    }
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
                          src={getOptimizedImage(photo.image, 400)} 
                          alt={photo.name || 'Photo'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
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
                
                {/* Pagination */}
                {currentDetailPhotos.filter(p => p.image).length > PHOTOS_PER_PAGE && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className={`px-4 py-2 rounded-lg font-semibold transition ${
                        currentPage === 1
                          ? 'opacity-30 cursor-not-allowed'
                          : darkMode
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      ← Précédent
                    </button>
                    
                    <span className={`px-4 py-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'} font-semibold`}>
                      Page {currentPage} / {Math.ceil(currentDetailPhotos.filter(p => p.image).length / PHOTOS_PER_PAGE)}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(currentDetailPhotos.filter(p => p.image).length / PHOTOS_PER_PAGE), p + 1))}
                      disabled={currentPage >= Math.ceil(currentDetailPhotos.filter(p => p.image).length / PHOTOS_PER_PAGE)}
                      className={`px-4 py-2 rounded-lg font-semibold transition ${
                        currentPage >= Math.ceil(currentDetailPhotos.filter(p => p.image).length / PHOTOS_PER_PAGE)
                          ? 'opacity-30 cursor-not-allowed'
                          : darkMode
                            ? 'bg-purple-600 text-white hover:bg-purple-700'
                            : 'bg-purple-500 text-white hover:bg-purple-600'
                      }`}
                    >
                      Suivant →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {fullscreenPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4"
          onClick={closeFullscreen}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={getOptimizedImage(fullscreenPhoto.image, 1920)} 
              alt={fullscreenPhoto.name || 'Photo'} 
              className="max-w-full max-h-[90vh] object-contain"
              loading="eager"
            />
            {fullscreenPhoto.name && (
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg inline-block">
                  {fullscreenPhoto.name}
                </div>
              </div>
            )}
            <button
              onClick={closeFullscreen}
              className="absolute top-4 right-4 bg-white text-gray-800 p-2 rounded-full hover:bg-gray-200 transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
