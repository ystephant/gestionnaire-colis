import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, RotateCcw, Package, AlertCircle, Plus, Edit, Check, X, Trash2, Grid, Home, List, ArrowLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// 🔗 Connexion Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 📸 Optimiser les images Cloudinary
const getOptimizedImage = (url, width = 400) => {
  if (!url) return url;
  return url.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
};

// ⚙️ CONFIGURATION CLOUDINARY
const CLOUDINARY_CLOUD_NAME = 'dfnwxqjey';
const CLOUDINARY_UPLOAD_PRESET = 'boardgames_upload';

// 🎨 Composant principal
export default function InventaireJeux() {
  // States
  const [darkMode, setDarkMode] = useState(false);
  const [username] = useState('demo_user');
  const [loading, setLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [allGames, setAllGames] = useState([]);
  const [showAllGamesList, setShowAllGamesList] = useState(true);
  
  const [gameRating, setGameRating] = useState(0);
  const [senderName, setSenderName] = useState('');
  const [additionalComment, setAdditionalComment] = useState('');
  const [evaluations, setEvaluations] = useState([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingGameName, setEditingGameName] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [newGameItems, setNewGameItems] = useState(['']);
  
  const [detailedView, setDetailedView] = useState(null);
  const [itemDetails, setItemDetails] = useState({});
  const [editingDetails, setEditingDetails] = useState(false);
  const [currentDetailPhotos, setCurrentDetailPhotos] = useState([]);
  const detailImageInputRef = useRef(null);
  const [currentEditingPhotoId, setCurrentEditingPhotoId] = useState(null);
  
  const [syncStatus, setSyncStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoRotations, setPhotoRotations] = useState({});
  const [sortOrder, setSortOrder] = useState('default'); // 'default', 'asc', 'desc'

  // 📸 Upload vers Cloudinary
  const uploadToCloudinary = async (file, folder = 'boardgames') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) throw new Error(`Cloudinary upload failed: ${response.status}`);
    const data = await response.json();
    return { url: data.secure_url, publicId: data.public_id };
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

  // 📥 Charger les évaluations depuis Supabase
  const loadEvaluations = async () => {
    try {
      const { data, error } = await supabase
        .from('game_evaluations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setEvaluations(data || []);
    } catch (error) {
      console.error('Erreur chargement évaluations:', error);
    }
  };

// 1️⃣ Chargement initial
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode !== null) setDarkMode(savedDarkMode === 'true');
    loadGames();
    loadEvaluations();
  }, []);

  // 2️⃣ Synchronisation temps réel
  useEffect(() => {
    const channel = supabase
      .channel('games-realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'games' }, 
        async (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setAllGames(prev => prev.map(game => game.id === payload.new.id ? payload.new : game));
            setSelectedGame(prev => {
              if (prev && prev.id === payload.new.id) {
                setCheckedItems(payload.new.checked_items || {});
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
            setAllGames(prev => prev.filter(g => g.id !== payload.old.id));
            if (selectedGame?.id === payload.old.id) setSelectedGame(null);
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

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

  // 🆕 FONCTION D'AGRÉGATION AMÉLIORÉE - Plus flexible et intelligente
const getAggregatedItems = () => {
  if (!selectedGame) return {};
  
  const aggregated = {};
  
  selectedGame.items.forEach(item => {
    // 🔍 Essayer plusieurs patterns pour détecter les quantités
    
    // Pattern 1: "X nom" ou "X noms" (ex: "8 cartes", "11 cartes Glace")
    let match = item.match(/^(\d+)\s+(.+?)s?\s*$/i);
    
    // Pattern 2: "X nom Y" (ex: "8 cartes Glace", "11 cartes Chapeau")
    // On extrait juste le type sans le qualificatif
    if (match) {
      const quantity = parseInt(match[1]);
      let itemType = match[2].toLowerCase().trim();
      
      // Extraire le premier mot (le type) si c'est du format "cartes Glace"
      let firstWord = itemType.split(' ')[0];
      
      // 🔥 CORRECTION : Retirer le "s" final s'il existe déjà
      if (firstWord.endsWith('s')) {
        firstWord = firstWord.slice(0, -1);
      }
      
      // Utiliser le premier mot comme clé de regroupement
      const groupKey = firstWord;
      
      if (!aggregated[groupKey]) {
        aggregated[groupKey] = {
          total: 0,
          items: [],
          fullNames: [] // Pour debug
        };
      }
      
      aggregated[groupKey].total += quantity;
      aggregated[groupKey].items.push(item);
      aggregated[groupKey].fullNames.push(itemType);
    }
  });
  
  // Ne garder que les types avec plusieurs occurrences
  const filtered = {};
  Object.keys(aggregated).forEach(key => {
    if (aggregated[key].items.length > 1) {
      filtered[key] = aggregated[key];
    }
  });
  
  return filtered;
};

  
  // 📊 Calculer la progression par type d'élément
  const getAggregatedProgress = () => {
    if (!selectedGame) return {};
    
    const aggregated = getAggregatedItems();
    const progress = {};
    
    Object.keys(aggregated).forEach(itemType => {
      let checkedCount = 0;
      
      // Parcourir tous les items pour compter ceux qui sont cochés
      selectedGame.items.forEach((item, index) => {
        const match = item.match(/^(\d+)\s+(.+?)s?\s*$/i);
        if (match) {
          let firstWord = match[2].toLowerCase().trim().split(' ')[0];
          if (firstWord.endsWith('s')) {
            firstWord = firstWord.slice(0, -1);
          }
          
          if (firstWord === itemType && checkedItems[index]) {
            checkedCount += parseInt(match[1]);
          }
        }
      });
      
      progress[itemType] = checkedCount;
    });
    
    return progress;
  };

  // 🔄 Fonction pour trier les items
  const getSortedItems = () => {
    if (!selectedGame) return [];
    
    const items = [...selectedGame.items.map((item, index) => ({ item, index }))];
    
    if (sortOrder === 'asc') {
      return items.sort((a, b) => {
        // Extraire le texte après les chiffres
        const textA = a.item.replace(/^\d+\s*/, '').trim();
        const textB = b.item.replace(/^\d+\s*/, '').trim();
        return textA.localeCompare(textB, 'fr');
      });
    } else if (sortOrder === 'desc') {
      return items.sort((a, b) => {
        // Extraire le texte après les chiffres
        const textA = a.item.replace(/^\d+\s*/, '').trim();
        const textB = b.item.replace(/^\d+\s*/, '').trim();
        return textB.localeCompare(textA, 'fr');
      });
    }
    
    return items; // ordre par défaut
  };
  
  // 📸 Upload MULTIPLE parallèle
  const handleDetailPhotoCapture = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (CLOUDINARY_CLOUD_NAME === 'VOTRE_CLOUD_NAME') {
      alert('⚠️ Veuillez configurer Cloudinary !');
      return;
    }

    setUploadingPhotos(true);
    setUploadProgress(0);

    try {
      let completed = 0;
      const uploadPromises = files.map(async (file, index) => {
        if (file.size > 10 * 1024 * 1024) return null;
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
      alert(`✅ ${newPhotos.length} photo(s) uploadée(s) !`);
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('❌ Erreur lors de l\'upload');
    } finally {
      setUploadingPhotos(false);
      setUploadProgress(0);
    }
  };

  // Drag & Drop handlers
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
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    const fakeEvent = { target: { files } };
    await handleDetailPhotoCapture(fakeEvent);
  };

  const selectGame = (game) => {
    setSelectedGame(game);
    setSearchQuery('');
    setShowResults(false);
    setCheckedItems(game.checked_items || {});
    setEditMode(false);
    setShowAllGamesList(false);
    setDetailedView(null);
    setItemDetails(game.item_details || {});
    setPhotoRotations(game.photo_rotations || {});
    setGameRating(0);
    setSenderName('');
    setAdditionalComment('');
  };

  const deleteGame = async (gameId, gameName) => {
    if (!confirm(`⚠️ Voulez-vous vraiment supprimer "${gameName}" ?`)) return;
    try {
      const { error } = await supabase.from('games').delete().eq('id', gameId);
      if (error) throw error;
      if (selectedGame?.id === gameId) setSelectedGame(null);
      setAllGames(prev => prev.filter(g => g.id !== gameId));
      setSyncStatus('✅ Supprimé');
      setTimeout(() => setSyncStatus(''), 2000);
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
        if (photo.image) newCheckedItems[`detail_${index}_${photo.id}`] = isChecking;
      });
    } else {
      newCheckedItems[index] = !checkedItems[index];
    }
    
    setCheckedItems(newCheckedItems);
    try {
      const { error } = await supabase.from('games').update({ checked_items: newCheckedItems }).eq('id', selectedGame.id);
      if (error) throw error;
      setSyncStatus('✅ Sauvegardé');
      setTimeout(() => setSyncStatus(''), 1500);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
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
      const { error } = await supabase.from('games').update({ checked_items: newCheckedItems }).eq('id', selectedGame.id);
      if (error) throw error;
      setSyncStatus('✅ Sauvegardé');
      setTimeout(() => setSyncStatus(''), 1500);
    } catch (error) {
    console.error('Erreur sauvegarde:', error);
  }
};

// 👇 AJOUTER ICI
const toggleAggregatedType = async (itemType) => {
  const aggregated = getAggregatedItems();
  const progress = getAggregatedProgress();
  const checked = progress[itemType] || 0;
  const total = aggregated[itemType].total;
  
  const shouldCheck = checked < total;
  const newCheckedItems = { ...checkedItems };
  
  selectedGame.items.forEach((item, index) => {
    const match = item.match(/^(\d+)\s+(.+?)s?\s*$/i);
    if (match) {
      let firstWord = match[2].toLowerCase().trim().split(' ')[0];
      if (firstWord.endsWith('s')) {
        firstWord = firstWord.slice(0, -1);
      }
      
      if (firstWord === itemType) {
        newCheckedItems[index] = shouldCheck;
        
        const photos = itemDetails[index] || [];
        if (photos.filter(p => p.image).length > 0) {
          photos.forEach(photo => {
            if (photo.image) {
              newCheckedItems[`detail_${index}_${photo.id}`] = shouldCheck;
            }
          });
        }
      }
    }
  });
  
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
};
// 👆 JUSQU'ICI

const resetInventory = async () => {
    if (!confirm('Réinitialiser l\'inventaire ?')) return;
    setCheckedItems({});
    setGameRating(0);
    setSenderName('');
    setAdditionalComment('');
    try {
      const { error } = await supabase.from('games').update({ checked_items: {} }).eq('id', selectedGame.id);
      if (error) throw error;
      setSyncStatus('✅ Inventaire réinitialisé');
      setTimeout(() => setSyncStatus(''), 1500);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    }
  };;

  const changeGame = () => {
    setSelectedGame(null);
    setCheckedItems({});
    setSearchQuery('');
    setEditMode(false);
    setDetailedView(null);
    setGameRating(0);
    setSenderName('');
    setAdditionalComment('');
  };

  const getProgress = () => {
    if (!selectedGame) return 0;
    const totalElements = selectedGame.items.length;
    if (totalElements === 0) return 0;
    const percentagePerElement = 100 / totalElements;
    let totalProgress = 0;
    selectedGame.items.forEach((item, index) => {
      const photos = itemDetails[index] || [];
      const photoCount = photos.filter(p => p.image).length;
      if (photoCount > 0) {
        let checkedPhotosCount = 0;
        photos.forEach(photo => {
          if (photo.image && checkedItems[`detail_${index}_${photo.id}`]) checkedPhotosCount++;
        });
        totalProgress += (checkedPhotosCount / photoCount) * percentagePerElement;
      } else {
        if (checkedItems[index]) totalProgress += percentagePerElement;
      }
    });
    return Math.round(totalProgress);
  };

  const getDetailPhotoCount = (itemIndex) => {
    const photos = itemDetails[itemIndex] || [];
    return photos.filter(p => p.image).length;
  };

  // Fonctions pour les modales
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

  const addItemField = () => setNewGameItems([...newGameItems, '']);
  
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

  const rotatePhoto = (photoId, direction) => {
    const currentRotation = photoRotations[photoId] || 0;
    const newRotation = direction === 'right' 
      ? (currentRotation + 90) % 360 
      : (currentRotation - 90 + 360) % 360;
    
    setPhotoRotations(prev => ({
      ...prev,
      [photoId]: newRotation
    }));
  };
  
  const closeDetailedView = () => {
    setDetailedView(null);
    setCurrentDetailPhotos([]);
    setEditingDetails(false);
  };

  const startEditingDetails = () => setEditingDetails(true);
  
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
    clearTimeout(window.photoNameTimer);
    window.photoNameTimer = setTimeout(async () => {
      const updatedItemDetails = {
        ...itemDetails,
        [detailedView.itemIndex]: updated.filter(p => p.image !== null)
      };
      try {
        const { error } = await supabase.from('games').update({ item_details: updatedItemDetails }).eq('id', selectedGame.id);
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
    const updatedItemDetails = {
      ...itemDetails,
      [detailedView.itemIndex]: updatedPhotos.filter(p => p.image !== null)
    };
    try {
      const { error } = await supabase.from('games').update({ item_details: updatedItemDetails }).eq('id', selectedGame.id);
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
    try {
      const { error } = await supabase.from('games').update({ 
        item_details: updatedItemDetails,
        photo_rotations: photoRotations
      }).eq('id', selectedGame.id);
      if (error) throw error;
      setSyncStatus('✅ Photos enregistrées !');
      setTimeout(() => setSyncStatus(''), 3000);
      alert(`✅ ${validPhotos.length} photo(s) enregistrée(s) !`);
      setEditingDetails(false);
      setItemDetails(updatedItemDetails);
      setSelectedGame(prev => ({ ...prev, item_details: updatedItemDetails }));
      setAllGames(prev => prev.map(g => g.id === selectedGame.id ? { ...g, item_details: updatedItemDetails } : g));
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur sauvegarde');
    }
  };

  const saveEvaluation = async () => {
    if (gameRating === 0) {
      alert('⚠️ Veuillez attribuer une note (1 à 5 étoiles)');
      return;
    }
    if (!senderName.trim()) {
      alert('⚠️ Veuillez indiquer le nom de l\'expéditeur');
      return;
    }

    try {
      const evaluation = {
        id: `eval_${Date.now()}`,
        game_id: selectedGame.id,
        game_name: selectedGame.name,
        rating: gameRating,
        sender_name: senderName.trim(),
        comment: additionalComment.trim() || null,
        created_by: username
      };

      const { error } = await supabase
        .from('game_evaluations')
        .insert(evaluation);
      
      if (error) throw error;
      
      setSyncStatus('✅ Évaluation enregistrée');
      setTimeout(() => setSyncStatus(''), 2000);
      
      setGameRating(0);
      setSenderName('');
      setAdditionalComment('');
      
      await loadEvaluations();
      
      alert('✅ Évaluation enregistrée avec succès !');
    } catch (error) {
      console.error('Erreur sauvegarde évaluation:', error);
      alert('❌ Erreur lors de l\'enregistrement');
    }
  };

  const deleteEvaluation = async (evalId) => {
    if (!confirm('Supprimer cette évaluation ?')) return;
    try {
      const { error } = await supabase
        .from('game_evaluations')
        .delete()
        .eq('id', evalId);
      
      if (error) throw error;
      
      setSyncStatus('✅ Évaluation supprimée');
      setTimeout(() => setSyncStatus(''), 1500);
      await loadEvaluations();
    } catch (error) {
      console.error('Erreur suppression:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const deleteAllEvaluations = async () => {
    if (!confirm('⚠️ Supprimer TOUTES les évaluations ? Cette action est irréversible.')) return;
    try {
      const { error } = await supabase
        .from('game_evaluations')
        .delete()
        .neq('id', '');
      
      if (error) throw error;
      
      setSyncStatus('✅ Toutes les évaluations supprimées');
      setTimeout(() => setSyncStatus(''), 2000);
      setEvaluations([]);
    } catch (error) {
      console.error('Erreur suppression globale:', error);
      alert('❌ Erreur lors de la suppression');
    }
  };

  const createGame = async () => {
    const validItems = newGameItems.filter(item => item.trim() !== '');
    if (!newGameName.trim() || validItems.length === 0) {
      alert('Veuillez renseigner le nom du jeu et au moins un élément');
      return;
    }
    try {
      const { data, error } = await supabase.from('games').insert({
        name: newGameName.trim(),
        search_name: newGameName.trim().toLowerCase(),
        items: validItems,
        item_details: {},
        created_by: username
      }).select().single();
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
    setNewGameName(selectedGame.name);
    setNewGameItems([...selectedGame.items]);
    setEditingGameName(false);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditingGameName(false);
    setNewGameItems([]);
    setNewGameName('');
  };

  const saveEdit = async () => {
    const validItems = newGameItems.filter(item => item.trim() !== '');
    if (validItems.length === 0) {
      alert('Le jeu doit contenir au moins un élément');
      return;
    }
    if (!newGameName.trim()) {
      alert('Le nom du jeu ne peut pas être vide');
      return;
    }
    try {
      const { error } = await supabase.from('games').update({ 
        name: newGameName.trim(),
        search_name: newGameName.trim().toLowerCase(),
        items: validItems 
      }).eq('id', selectedGame.id);
      if (error) throw error;
      setSyncStatus('✅ Synchronisé');
      setTimeout(() => setSyncStatus(''), 2000);
      setEditMode(false);
      setEditingGameName(false);
      setCheckedItems({});
      const updatedGame = { ...selectedGame, name: newGameName.trim(), search_name: newGameName.trim().toLowerCase(), items: validItems };
      setSelectedGame(updatedGame);
      setAllGames(prev => prev.map(g => g.id === selectedGame.id ? updatedGame : g));
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur sauvegarde');
    }
  };
  
// Loading screen
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

        {/* 🆕 HEADER MODIFIÉ avec bouton "Revenir à la recherche" */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => window.location.href = '/'}
                className={`${darkMode ? 'text-gray-400 hover:text-orange-400 hover:bg-gray-700' : 'text-gray-600 hover:text-orange-600 hover:bg-gray-100'} p-2 rounded-lg transition`}
                title="Retour à l'accueil"
              >
                <Home size={24} />
              </button>
              <div className="bg-orange-600 p-3 rounded-xl">
                <Package size={28} color="white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Inventaire de Jeux</h1>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Avec Cloudinary - Upload ultra rapide ⚡</p>
                  </div>
                  {selectedGame && !editMode && !detailedView && (
                    <button
                      onClick={changeGame}
                      className="px-3 py-2 rounded-lg font-medium transition text-sm whitespace-nowrap bg-orange-600 text-white hover:bg-orange-700 flex items-center gap-1.5"
                    >
                      <Search size={16} />
                      Rechercher
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 rounded-xl transition-all ml-4 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Section recherche - utilise SearchGameSection (voir partie suivante) */}
        {!selectedGame && (
          <SearchGameSection 
            darkMode={darkMode}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showResults={showResults}
            searchResults={searchResults}
            selectGame={selectGame}
            deleteGame={deleteGame}
            allGames={allGames}
            showAllGamesList={showAllGamesList}
            setShowAllGamesList={setShowAllGamesList}
            openCreateModal={openCreateModal}
            evaluations={evaluations}
            deleteEvaluation={deleteEvaluation}
            deleteAllEvaluations={deleteAllEvaluations}
          />
        )}

        {/* Section inventaire avec agrégation - utilise GameInventorySection */}
        {selectedGame && !editMode && !detailedView && (
          <GameInventorySection
            darkMode={darkMode}
            selectedGame={selectedGame}
            startEditMode={startEditMode}
            deleteGame={deleteGame}
            getProgress={getProgress}
            resetInventory={resetInventory}
            getAggregatedItems={getAggregatedItems}
            getAggregatedProgress={getAggregatedProgress}
            checkedItems={checkedItems}
            toggleItem={toggleItem}
            itemDetails={itemDetails}
            getDetailPhotoCount={getDetailPhotoCount}
            openDetailedView={openDetailedView}
            supabase={supabase}
            setSyncStatus={setSyncStatus}
            toggleAggregatedType={toggleAggregatedType}
            gameRating={gameRating}
            setGameRating={setGameRating}
            senderName={senderName}
            setSenderName={setSenderName}
            additionalComment={additionalComment}
            setAdditionalComment={setAdditionalComment}
            saveEvaluation={saveEvaluation}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            getSortedItems={getSortedItems}
          />
        )}

        {/* Section édition - utilise EditGameSection */}
        {selectedGame && editMode && (
          <EditGameSection
            darkMode={darkMode}
            selectedGame={selectedGame}
            newGameName={newGameName}
            setNewGameName={setNewGameName}
            editingGameName={editingGameName}
            setEditingGameName={setEditingGameName}
            newGameItems={newGameItems}
            updateItemField={updateItemField}
            removeItemField={removeItemField}
            addItemField={addItemField}
            saveEdit={saveEdit}
            cancelEdit={cancelEdit}
          />
        )}

        {/* Vue détaillée - utilise DetailedViewComponent */}
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
            getOptimizedImage={getOptimizedImage}
            photoRotations={photoRotations} 
            rotatePhoto={rotatePhoto}
          />
        )}

        {/* Modal création - utilise CreateGameModal */}
        {showCreateModal && (
          <CreateGameModal
            darkMode={darkMode}
            newGameName={newGameName}
            setNewGameName={setNewGameName}
            newGameItems={newGameItems}
            updateItemField={updateItemField}
            removeItemField={removeItemField}
            addItemField={addItemField}
            createGame={createGame}
            closeCreateModal={closeCreateModal}
          />
        )}
      </div>
    </div>
  );
}

// Composant SearchGameSection
function SearchGameSection({ darkMode, searchQuery, setSearchQuery, showResults, searchResults, selectGame, deleteGame, allGames, showAllGamesList, setShowAllGamesList, openCreateModal, evaluations, deleteEvaluation, deleteAllEvaluations }) {
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const StarRating = ({ rating }) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={`text-lg ${star <= rating ? 'text-yellow-400' : 'text-gray-400'}`}>
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
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
            darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
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
                    darkMode ? 'hover:bg-gray-600 text-gray-100' : 'hover:bg-orange-50 text-gray-800'
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
                <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Jeu introuvable</span>
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
                    darkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-orange-50 text-gray-800'
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

      {/* Historique des évaluations */}
      {evaluations.length > 0 && (
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
              📋 Historique des évaluations
            </h2>
            <button
              onClick={deleteAllEvaluations}
              className="text-red-500 hover:text-red-600 text-sm font-semibold flex items-center gap-1"
            >
              <Trash2 size={16} />
              Tout supprimer
            </button>
          </div>

          <div className="space-y-3">
            {evaluations.map(evaluation => (
              <div key={evaluation.id} className={`p-4 rounded-xl border-2 ${
                darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatDate(evaluation.created_at)}
                      </span>
                      <span className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                        {evaluation.game_name}
                      </span>
                    </div>
                    
                    <StarRating rating={evaluation.rating} />
                    
                    <div className={`text-sm ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      <strong>Expéditeur :</strong> {evaluation.sender_name}
                    </div>
                    
                    {evaluation.comment && (
                      <div className={`text-sm p-2 rounded-lg ${
                        darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'
                      }`}>
                        <strong>Commentaire :</strong> {evaluation.comment}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => deleteEvaluation(evaluation.id)}
                    className={`p-2 rounded-lg transition flex-shrink-0 ${
                      darkMode ? 'text-red-400 hover:bg-gray-600' : 'text-red-600 hover:bg-gray-200'
                    }`}
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

// Composant GameInventorySection avec AGRÉGATION
function GameInventorySection({ darkMode, selectedGame, startEditMode, deleteGame, getProgress, resetInventory, getAggregatedItems, getAggregatedProgress, checkedItems, toggleItem, itemDetails, getDetailPhotoCount, openDetailedView, supabase, setSyncStatus, toggleAggregatedType, gameRating, setGameRating, senderName, setSenderName, additionalComment, setAdditionalComment, saveEvaluation, sortOrder, setSortOrder, getSortedItems }) {
  const StarSelector = ({ rating, setRating }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setRating(star)}
            className="text-3xl hover:scale-110 transition"
          >
            <span className={star <= rating ? 'text-yellow-400' : 'text-gray-400'}>★</span>
          </button>
        ))}
      </div>
    );
  };

  return (
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
                darkMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              <Edit size={16} />
              Éditer
            </button>
            <button
              onClick={() => deleteGame(selectedGame.id, selectedGame.name)}
              className={`px-3 py-2 rounded-lg font-medium transition text-sm ${
                darkMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              <Trash2 size={16} />
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

        <div className={`p-4 rounded-xl mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              🔄 Tri du contenu
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortOrder('default')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  sortOrder === 'default'
                    ? 'bg-orange-600 text-white'
                    : darkMode ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Par défaut
              </button>
              <button
                onClick={() => setSortOrder('asc')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  sortOrder === 'asc'
                    ? 'bg-orange-600 text-white'
                    : darkMode ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                A → Z
              </button>
              <button
                onClick={() => setSortOrder('desc')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  sortOrder === 'desc'
                    ? 'bg-orange-600 text-white'
                    : darkMode ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Z → A
              </button>
            </div>
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

      {/* 🆕 BLOC D'AGRÉGATION AUTOMATIQUE - Version compacte cliquable */}
      {Object.keys(getAggregatedItems()).length > 0 && (
        <div className={`${darkMode ? 'bg-purple-900 bg-opacity-20' : 'bg-purple-50'} rounded-xl p-3 border ${darkMode ? 'border-purple-700' : 'border-purple-200'}`}>
          <h3 className={`text-sm font-semibold ${darkMode ? 'text-purple-300' : 'text-purple-700'} mb-2 flex items-center gap-1`}>
            📊 Récapitulatif
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(getAggregatedItems()).map(([itemType, data]) => {
              const progress = getAggregatedProgress();
              const checked = progress[itemType] || 0;
              const isComplete = checked === data.total;
              return (
                <button
                  key={itemType}
                  onClick={() => toggleAggregatedType(itemType)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isComplete
                      ? darkMode ? 'bg-green-700 text-green-200' : 'bg-green-200 text-green-800'
                      : darkMode ? 'bg-purple-800 text-purple-200 hover:bg-purple-700' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                  }`}
                >
                  <span className="font-bold">{checked}/{data.total}</span> {itemType}{data.total > 1 ? 's' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}
        
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
        <h3 className={`text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} mb-4`}>
          Contenu de la boîte
        </h3>
        
        <div className="space-y-2">
          {getSortedItems().map(({ item, index }) => {
            const photoCount = getDetailPhotoCount(index);
            return (
              <div key={index} className="flex items-center gap-2">
                <button
                  onClick={() => openDetailedView(index, item)}
                  className={`p-2 rounded-lg transition ${
                    photoCount > 0
                      ? darkMode ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-purple-500 hover:bg-purple-600 text-white'
                      : darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-400' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                  }`}
                  title={photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? 's' : ''}` : 'Ajouter des photos'}
                >
                  <Grid size={16} />
                </button>
                
                <label
                  className={`flex-1 flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                    checkedItems[index]
                      ? darkMode ? 'bg-green-900 bg-opacity-30 border-2 border-green-700' : 'bg-green-50 border-2 border-green-300'
                      : darkMode ? 'bg-gray-700 hover:bg-gray-650 border-2 border-gray-600' : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
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
          ⭐ Évaluation du jeu
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
              Est-ce que le jeu est OK ? *
            </label>
            <StarSelector rating={gameRating} setRating={setGameRating} />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
              Nom de la personne qui vous a envoyé le jeu *
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Ex: Jean Dupont"
              className={`w-full px-4 py-3 border-2 rounded-xl focus:border-orange-500 focus:outline-none ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
          </div>

          <div>
            <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
              Commentaire supplémentaire (optionnel)
            </label>
            <textarea
              value={additionalComment}
              onChange={(e) => setAdditionalComment(e.target.value)}
              placeholder="Ajoutez des remarques sur l'état du jeu..."
              rows="4"
              className={`w-full px-4 py-3 border-2 rounded-xl focus:border-orange-500 focus:outline-none resize-none ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
          </div>

          <button
            onClick={saveEvaluation}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            <Check size={20} />
            Enregistrer l'évaluation
          </button>
        </div>
      </div>
    </div>
  );
}

// Composant EditGameSection
function EditGameSection({ darkMode, selectedGame, newGameName, setNewGameName, editingGameName, setEditingGameName, newGameItems, updateItemField, removeItemField, addItemField, saveEdit, cancelEdit }) {
  return (
    <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} flex items-center gap-2`}>
          <Edit size={24} className="text-blue-500" />
          Éditer le jeu
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
              darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <X size={18} />
            Annuler
          </button>
        </div>
      </div>

      {/* Section modification du nom */}
      <div className="mb-6">
        <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
          Nom du jeu
        </label>
        <input
          type="text"
          value={newGameName}
          onChange={(e) => setNewGameName(e.target.value)}
          placeholder="Nom du jeu"
          className={`w-full px-4 py-3 border-2 rounded-xl focus:border-blue-500 focus:outline-none text-lg font-semibold ${
            darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
          }`}
        />
      </div>

      {/* Section modification des éléments */}
      <div>
        <label className={`block text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-2`}>
          Contenu du jeu
        </label>
        <div className="space-y-3">
        {newGameItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => updateItemField(index, e.target.value)}
              placeholder={`Élément ${index + 1}`}
              className={`flex-1 px-4 py-2 border-2 rounded-lg focus:border-blue-500 focus:outline-none ${
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
              }`}
            />
            <button
              onClick={() => removeItemField(index)}
              disabled={newGameItems.length <= 1}
              className={`p-2 rounded-lg transition ${
                newGameItems.length <= 1
                  ? 'opacity-30 cursor-not-allowed'
                  : darkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
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
    </div>
  );
}

// Composant CreateGameModal
function CreateGameModal({ darkMode, newGameName, setNewGameName, newGameItems, updateItemField, removeItemField, addItemField, createGame, closeCreateModal }) {
  return (
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
                darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
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
                    placeholder="Ex: 54 cartes, 8 pions loupes..."
                    className={`flex-1 px-4 py-2 border-2 rounded-lg focus:border-orange-500 focus:outline-none ${
                      darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                  <button
                    onClick={() => removeItemField(index)}
                    disabled={newGameItems.length <= 1}
                    className={`p-2 rounded-lg transition ${
                      newGameItems.length <= 1
                        ? 'opacity-30 cursor-not-allowed'
                        : darkMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
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
                darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant DetailedViewComponent
function DetailedViewComponent({ 
  detailedView, currentDetailPhotos, editingDetails, darkMode,
  closeDetailedView, startEditingDetails, saveDetailedView, cancelEditingDetails,
  detailImageInputRef, handleDetailPhotoCapture, openDetailPhotoCapture,
  removeDetailPhoto, updateDetailPhotoName, addDetailPhoto,
  checkedItems, toggleDetailPhoto,
  isDragging, handleDragEnter, handleDragLeave, handleDragOver, handleDrop,
  uploadingPhotos, uploadProgress, getOptimizedImage,
  photoRotations, rotatePhoto
}) {
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);
  const [lastTap, setLastTap] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const PHOTOS_PER_PAGE = 20;

  const paginatedPhotos = React.useMemo(() => {
    return currentDetailPhotos
      .filter(p => p.image)
      .slice((currentPage - 1) * PHOTOS_PER_PAGE, currentPage * PHOTOS_PER_PAGE);
  }, [currentDetailPhotos, currentPage]);

  const closeFullscreen = () => setFullscreenPhoto(null);

  return (
    <>
      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={closeDetailedView}
              className={`p-2 rounded-lg transition ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
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
                    darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                  darkMode ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-purple-500 text-white hover:bg-purple-600'
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
            <div 
              className={`mb-4 p-6 rounded-xl border-2 border-dashed transition-all ${
                isDragging 
                  ? darkMode ? 'bg-purple-900 bg-opacity-40 border-purple-500' : 'bg-purple-100 border-purple-500'
                  : darkMode ? 'bg-blue-900 bg-opacity-30 border-blue-700' : 'bg-blue-50 border-blue-300'
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center gap-3">
                <Camera size={48} className={`${
                  isDragging 
                    ? 'text-purple-600 animate-bounce' 
                    : darkMode ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <p className={`text-center font-semibold ${
                  isDragging
                    ? 'text-purple-600 dark:text-purple-400'
                    : darkMode ? 'text-blue-300' : 'text-blue-800'
                }`}>
                  {isDragging 
                    ? '📸 Déposez vos photos ici !' 
                    : '⚡ Glissez-déposez vos photos ici'}
                </p>
                <p className={`text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  ou cliquez sur le bouton ci-dessous
                </p>
              </div>
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
                      <>
                        <img 
                          src={getOptimizedImage(photo.image, 400)} 
                          alt={photo.name || 'Photo'} 
                          className="w-full h-full object-cover" 
                          style={{ transform: `rotate(${photoRotations[photo.id] || 0}deg)` }}
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute bottom-2 left-2 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              rotatePhoto(photo.id, 'left');
                            }}
                            className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition shadow-lg"
                            title="Pivoter à gauche"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/>
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              rotatePhoto(photo.id, 'right');
                            }}
                            className="bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition shadow-lg"
                            title="Pivoter à droite"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
                            </svg>
                          </button>
                        </div>
                      </>
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
      e.stopPropagation();
      setFullscreenPhoto(photo);
      setLastTap(0);
    } else {
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
                          style={{ transform: `rotate(${photoRotations[photo.id] || 0}deg)` }}
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
                        
                        {/* Bouton Zoom */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenPhoto(photo);
                          }}
                          className={`absolute bottom-2 right-2 p-2 rounded-lg transition shadow-lg ${
                            darkMode ? 'bg-gray-800 bg-opacity-90 text-white hover:bg-gray-700' : 'bg-white bg-opacity-90 text-gray-800 hover:bg-gray-100'
                          }`}
                          title="Agrandir"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            <line x1="11" y1="8" x2="11" y2="14"></line>
                            <line x1="8" y1="11" x2="14" y2="11"></line>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
</div>
                
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
              style={{ transform: `rotate(${photoRotations[fullscreenPhoto.id] || 0}deg)` }}
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






