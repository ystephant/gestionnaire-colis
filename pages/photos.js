import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';
import {
  Upload, Tag, Trash2, X, Check, ChevronDown,
  Image as ImageIcon, Loader2, Sun, Moon, LogOut, ArrowLeft
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CLOUDINARY_CLOUD_NAME = 'dfnwxqjey';
const CLOUDINARY_UPLOAD_PRESET = 'boardgames_upload';

const COLUMNS = [
  { id: 'pas_encore_en_vente',    label: 'Pas encore en vente',        color: 'bg-slate-500',   light: 'bg-slate-100',   border: 'border-slate-400',  dot: 'bg-slate-400'  },
  { id: 'en_cours_de_vente',      label: 'En cours de vente',          color: 'bg-amber-500',   light: 'bg-amber-50',    border: 'border-amber-400',  dot: 'bg-amber-400'  },
  { id: 'en_vente',               label: 'En vente',                   color: 'bg-blue-500',    light: 'bg-blue-50',     border: 'border-blue-400',   dot: 'bg-blue-400'   },
  { id: 'en_attente_reception',   label: 'En attente réception',       color: 'bg-purple-500',  light: 'bg-purple-50',   border: 'border-purple-400', dot: 'bg-purple-400' },
  { id: 'vendu',                  label: 'Vendu ✓',                    color: 'bg-green-600',   light: 'bg-green-50',    border: 'border-green-500',  dot: 'bg-green-500'  },
];

export default function PhotosManager() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // Photos state
  const [photos, setPhotos] = useState({
    pas_encore_en_vente: [],
    en_cours_de_vente: [],
    en_vente: [],
    en_attente_reception: [],
    vendu: [],
  });

  // Upload zone
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Drag between columns
  const [draggingPhoto, setDraggingPhoto] = useState(null); // { photo, fromColumn }
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState(null);

  // Multi-select & tag
  const [selectedPhotos, setSelectedPhotos] = useState({}); // { columnId: Set<id> }
  const [selectModeColumn, setSelectModeColumn] = useState(null);
  const [gamesList, setGamesList] = useState([]);
  const [tagDropdown, setTagDropdown] = useState(null); // columnId
  const [tagSearch, setTagSearch] = useState('');

  // Confirm delete (vendu)
  const [pendingVendu, setPendingVendu] = useState(null); // { photo, fromColumn }

  // Toast
  const [toast, setToast] = useState(null);

  // ─── Auth ───────────────────────────────────────────────
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setIsLoggedIn(true);
    } else {
      router.push('/');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoggedIn && username) {
      loadPhotos();
      loadGames();
    }
  }, [isLoggedIn, username]);

  // ─── Load photos ────────────────────────────────────────
  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('sale_photos')
        .select('*')
        .eq('user_id', username)
        .order('position', { ascending: true });
      if (error) throw error;

      const grouped = {
        pas_encore_en_vente: [],
        en_cours_de_vente: [],
        en_vente: [],
        en_attente_reception: [],
        vendu: [],
      };
      (data || []).forEach(p => {
        if (grouped[p.status]) grouped[p.status].push(p);
      });
      setPhotos(grouped);
    } catch (err) {
      showToast('Erreur chargement photos', 'error');
    }
  };

  // ─── Load games from transactions ───────────────────────
  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('game_name')
        .eq('user_id', username)
        .not('game_name', 'is', null);
      if (error) throw error;
      const unique = [...new Set((data || []).map(t => t.game_name).filter(Boolean))].sort();
      setGamesList(unique);
    } catch (err) {
      console.error('Erreur chargement jeux:', err);
    }
  };

  // ─── Toast ──────────────────────────────────────────────
  const showToast = (message, type = 'default') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Upload to Cloudinary ───────────────────────────────
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'sale_photos');

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );
    if (!res.ok) throw new Error('Upload Cloudinary échoué');
    const data = await res.json();
    return { url: data.secure_url, publicId: data.public_id };
  };

  // ─── Handle file drop in upload zone ────────────────────
  const handleFileDrop = useCallback(async (files) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!validFiles.length) return;

    setUploading(true);
    setUploadProgress(0);
    let done = 0;

    for (const file of validFiles) {
      try {
        const { url, publicId } = await uploadToCloudinary(file);
        const { data, error } = await supabase
          .from('sale_photos')
          .insert({
            user_id: username,
            image_url: url,
            cloudinary_public_id: publicId,
            status: 'pas_encore_en_vente',
            position: Date.now(),
          })
          .select()
          .single();
        if (error) throw error;

        setPhotos(prev => ({
          ...prev,
          pas_encore_en_vente: [...prev.pas_encore_en_vente, data],
        }));
      } catch (err) {
        showToast(`Erreur upload: ${file.name}`, 'error');
      }
      done++;
      setUploadProgress(Math.round((done / validFiles.length) * 100));
    }

    setUploading(false);
    setUploadProgress(0);
    showToast(`${done} photo${done > 1 ? 's' : ''} ajoutée${done > 1 ? 's' : ''}`, 'success');
  }, [username]);

  // ─── OS file drag events ─────────────────────────────────
  const onDropZoneDragOver = (e) => { e.preventDefault(); setIsDraggingFile(true); };
  const onDropZoneDragLeave = () => setIsDraggingFile(false);
  const onDropZoneDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    handleFileDrop(e.dataTransfer.files);
  };

  // ─── Drag between columns ────────────────────────────────
  const onPhotoDragStart = (e, photo, fromColumn) => {
    setDraggingPhoto({ photo, fromColumn });
    e.dataTransfer.effectAllowed = 'move';
  };

  const onPhotoDragEnd = () => {
    setDraggingPhoto(null);
    setDragOverColumn(null);
    setDragOverPhotoId(null);
  };

  const onColumnDragOver = (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const onPhotoDragOverItem = (e, photoId) => {
    e.preventDefault();
    setDragOverPhotoId(photoId);
  };

  const onColumnDrop = async (e, toColumn) => {
    e.preventDefault();
    if (!draggingPhoto) return;

    const { photo, fromColumn } = draggingPhoto;
    setDraggingPhoto(null);
    setDragOverColumn(null);
    setDragOverPhotoId(null);

    if (fromColumn === toColumn && !dragOverPhotoId) return;

    // If dropping to "vendu", ask for confirmation
    if (toColumn === 'vendu') {
      setPendingVendu({ photo, fromColumn });
      return;
    }

    await movePhoto(photo, fromColumn, toColumn, dragOverPhotoId);
  };

  const movePhoto = async (photo, fromColumn, toColumn, beforePhotoId = null) => {
    // Optimistic update
    setPhotos(prev => {
      const from = prev[fromColumn].filter(p => p.id !== photo.id);
      let to = prev[toColumn].filter(p => p.id !== photo.id);

      const updated = { ...photo, status: toColumn };
      if (beforePhotoId) {
        const idx = to.findIndex(p => p.id === beforePhotoId);
        to.splice(idx >= 0 ? idx : to.length, 0, updated);
      } else {
        to.push(updated);
      }
      return { ...prev, [fromColumn]: from, [toColumn]: to };
    });

    try {
      await supabase
        .from('sale_photos')
        .update({ status: toColumn, updated_at: new Date().toISOString() })
        .eq('id', photo.id);
    } catch (err) {
      showToast('Erreur déplacement', 'error');
      loadPhotos();
    }
  };

  // ─── Confirm "vendu" → delete ────────────────────────────
  const confirmVendu = async () => {
    if (!pendingVendu) return;
    const { photo, fromColumn } = pendingVendu;
    setPendingVendu(null);

    // Remove from UI immediately
    setPhotos(prev => ({
      ...prev,
      [fromColumn]: prev[fromColumn].filter(p => p.id !== photo.id),
    }));

    try {
      // Delete from Cloudinary via API route
      await fetch('/api/delete-cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: photo.cloudinary_public_id }),
      });

      // Delete from Supabase
      await supabase.from('sale_photos').delete().eq('id', photo.id);

      showToast('Photo supprimée définitivement', 'success');
    } catch (err) {
      showToast('Erreur suppression', 'error');
      loadPhotos();
    }
  };

  // ─── Tag assignment ──────────────────────────────────────
  const assignTag = async (columnId, gameName) => {
    const sel = selectedPhotos[columnId];
    if (!sel || sel.size === 0) return;

    const ids = [...sel];
    setTagDropdown(null);
    setTagSearch('');

    setPhotos(prev => ({
      ...prev,
      [columnId]: prev[columnId].map(p =>
        ids.includes(p.id) ? { ...p, game_tag: gameName } : p
      ),
    }));

    try {
      await supabase
        .from('sale_photos')
        .update({ game_tag: gameName, updated_at: new Date().toISOString() })
        .in('id', ids);

      showToast(`Tag "${gameName}" appliqué à ${ids.length} photo${ids.length > 1 ? 's' : ''}`, 'success');
      setSelectedPhotos(prev => ({ ...prev, [columnId]: new Set() }));
      setSelectModeColumn(null);
    } catch (err) {
      showToast('Erreur tag', 'error');
      loadPhotos();
    }
  };

  // ─── Select helpers ──────────────────────────────────────
  const toggleSelectPhoto = (columnId, photoId) => {
    setSelectedPhotos(prev => {
      const set = new Set(prev[columnId] || []);
      if (set.has(photoId)) set.delete(photoId);
      else set.add(photoId);
      return { ...prev, [columnId]: set };
    });
  };

  const selectAllInColumn = (columnId) => {
    const allIds = photos[columnId].map(p => p.id);
    setSelectedPhotos(prev => ({ ...prev, [columnId]: new Set(allIds) }));
  };

  const clearSelection = (columnId) => {
    setSelectedPhotos(prev => ({ ...prev, [columnId]: new Set() }));
    setSelectModeColumn(null);
    setTagDropdown(null);
  };

  const selectedCount = (columnId) => (selectedPhotos[columnId]?.size || 0);

  // ─── Logout ──────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('password');
    router.push('/');
  };

  // ─── Filtered games list ─────────────────────────────────
  const filteredGames = gamesList.filter(g =>
    g.toLowerCase().includes(tagSearch.toLowerCase())
  );

  // ─── Render ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isLoggedIn) return null;

  const bg = darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const text = darkMode ? 'text-gray-100' : 'text-gray-800';
  const subtext = darkMode ? 'text-gray-400' : 'text-gray-500';
  const colBg = darkMode ? 'bg-gray-800/60' : 'bg-gray-100/80';
  const photoBg = darkMode ? 'bg-gray-700' : 'bg-white';

  return (
    <div className={`min-h-screen ${bg} ${text}`}>

      {/* ── Header ── */}
      <div className={`sticky top-0 z-30 border-b ${darkMode ? 'bg-gray-900/95 border-gray-700' : 'bg-white/95 border-gray-200'} backdrop-blur`}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${subtext}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-500" />
              <span className="font-bold text-lg">Photos Vente</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className={`p-2 rounded-lg hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-800' : ''} transition-colors`}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className={`p-2 rounded-lg hover:bg-gray-100 ${darkMode ? 'hover:bg-gray-800' : ''} transition-colors ${subtext}`}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── Upload zone ── */}
        <div
          onDragOver={onDropZoneDragOver}
          onDragLeave={onDropZoneDragLeave}
          onDrop={onDropZoneDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDraggingFile
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]'
              : darkMode
                ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-800/50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={e => handleFileDrop(e.target.files)}
          />
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
              <p className={`text-sm font-medium ${subtext}`}>Upload en cours… {uploadProgress}%</p>
              <div className="w-64 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className={`w-10 h-10 mx-auto ${isDraggingFile ? 'text-blue-500' : subtext}`} />
              <p className={`font-semibold ${isDraggingFile ? 'text-blue-500' : text}`}>
                {isDraggingFile ? 'Relâcher pour uploader' : 'Glisser vos photos ici'}
              </p>
              <p className={`text-sm ${subtext}`}>ou cliquer pour sélectionner — JPG, PNG, WEBP</p>
            </div>
          )}
        </div>

        {/* ── Kanban ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMNS.map(col => {
            const colPhotos = photos[col.id] || [];
            const selCount = selectedCount(col.id);
            const isSelMode = selectModeColumn === col.id;
            const isOver = dragOverColumn === col.id;
            const isVendu = col.id === 'vendu';

            return (
              <div
                key={col.id}
                onDragOver={e => onColumnDragOver(e, col.id)}
                onDrop={e => onColumnDrop(e, col.id)}
                onDragLeave={() => setDragOverColumn(null)}
                className={`flex flex-col rounded-2xl border-2 transition-all duration-150 ${
                  isOver
                    ? `${col.border} ${isVendu ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/10'} scale-[1.01]`
                    : darkMode ? 'border-gray-700 bg-gray-800/60' : `border-gray-200 ${col.light}`
                }`}
                style={{ minHeight: '420px' }}
              >
                {/* Column header */}
                <div className={`px-3 py-3 rounded-t-2xl ${darkMode ? 'bg-gray-700/80' : col.light} border-b ${darkMode ? 'border-gray-600' : col.border.replace('border-', 'border-b-')}`}>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
                      <span className="font-semibold text-sm truncate">{col.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${darkMode ? 'bg-gray-600 text-gray-300' : 'bg-white/70 text-gray-600'}`}>
                        {colPhotos.length}
                      </span>
                    </div>
                    {/* Select mode toggle */}
                    {!isVendu && colPhotos.length > 0 && (
                      <button
                        onClick={() => {
                          if (isSelMode) clearSelection(col.id);
                          else { setSelectModeColumn(col.id); setTagDropdown(null); }
                        }}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors flex-shrink-0 ${
                          isSelMode
                            ? 'bg-blue-500 text-white'
                            : darkMode ? 'bg-gray-600 text-gray-300 hover:bg-gray-500' : 'bg-white text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {isSelMode ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Selection toolbar */}
                  {isSelMode && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => selectAllInColumn(col.id)}
                          className={`flex-1 text-xs py-1 rounded-lg font-medium transition-colors ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'}`}
                        >
                          Tout ({colPhotos.length})
                        </button>
                        {selCount > 0 && (
                          <button
                            onClick={() => setTagDropdown(tagDropdown === col.id ? null : col.id)}
                            className="flex-1 text-xs py-1 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center gap-1"
                          >
                            <Tag className="w-3 h-3" />
                            Tag ({selCount})
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Tag dropdown */}
                      {tagDropdown === col.id && (
                        <div className={`rounded-xl border shadow-lg overflow-hidden ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}>
                          <div className="p-2">
                            <input
                              type="text"
                              placeholder="Rechercher un jeu…"
                              value={tagSearch}
                              onChange={e => setTagSearch(e.target.value)}
                              className={`w-full text-xs px-2 py-1.5 rounded-lg border outline-none ${darkMode ? 'bg-gray-600 border-gray-500 text-gray-200 placeholder-gray-400' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`}
                            />
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {filteredGames.length === 0 ? (
                              <p className={`text-xs px-3 py-2 ${subtext}`}>Aucun jeu trouvé</p>
                            ) : (
                              filteredGames.map(game => (
                                <button
                                  key={game}
                                  onClick={() => assignTag(col.id, game)}
                                  className={`w-full text-left text-xs px-3 py-1.5 transition-colors ${darkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-blue-50 text-gray-700'}`}
                                >
                                  {game}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Photos grid */}
                <div className="flex-1 p-2 grid grid-cols-2 gap-2 content-start">
                  {colPhotos.length === 0 ? (
                    <div className={`col-span-2 flex flex-col items-center justify-center py-10 gap-2 rounded-xl border-2 border-dashed ${darkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                      <ImageIcon className={`w-8 h-8 ${subtext}`} />
                      <p className={`text-xs ${subtext}`}>Déposer ici</p>
                    </div>
                  ) : (
                    colPhotos.map(photo => {
                      const isSelected = selectedPhotos[col.id]?.has(photo.id);
                      const isDragged = draggingPhoto?.photo?.id === photo.id;
                      const isOverItem = dragOverPhotoId === photo.id;

                      return (
                        <div
                          key={photo.id}
                          draggable
                          onDragStart={e => onPhotoDragStart(e, photo, col.id)}
                          onDragEnd={onPhotoDragEnd}
                          onDragOver={e => onPhotoDragOverItem(e, photo.id)}
                          onClick={() => isSelMode && toggleSelectPhoto(col.id, photo.id)}
                          className={`relative rounded-xl overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-150 group ${
                            isDragged ? 'opacity-30 scale-95' : 'opacity-100'
                          } ${isOverItem ? 'ring-2 ring-blue-400' : ''} ${
                            isSelected ? 'ring-2 ring-blue-500 scale-95' : ''
                          } ${isSelMode ? 'cursor-pointer' : ''}`}
                          style={{ aspectRatio: '1/1' }}
                        >
                          <img
                            src={photo.image_url}
                            alt={photo.game_tag || 'photo'}
                            className="w-full h-full object-cover"
                            draggable={false}
                          />

                          {/* Selection overlay */}
                          {isSelMode && (
                            <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-blue-500/30' : 'bg-black/0 group-hover:bg-black/10'}`}>
                              <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/70 border-white'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          )}

                          {/* Game tag */}
                          {photo.game_tag && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1.5 py-1">
                              <p className="text-white text-xs font-medium truncate">{photo.game_tag}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Confirm "Vendu" modal ── */}
      {pendingVendu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-base">Supprimer définitivement ?</h3>
                <p className={`text-sm mt-1 ${subtext}`}>
                  Cette photo sera supprimée de Cloudinary et de la base de données. Cette action est irréversible.
                </p>
              </div>
            </div>
            {pendingVendu.photo.image_url && (
              <img
                src={pendingVendu.photo.image_url}
                alt=""
                className="w-full h-32 object-cover rounded-xl"
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setPendingVendu(null)}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                Annuler
              </button>
              <button
                onClick={confirmVendu}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl font-medium text-sm flex items-center gap-2 transition-all duration-300 ${
          toast.type === 'error'
            ? 'bg-red-500 text-white'
            : toast.type === 'success'
              ? 'bg-green-500 text-white'
              : darkMode ? 'bg-gray-700 text-white' : 'bg-gray-800 text-white'
        }`}>
          {toast.type === 'success' && <Check className="w-4 h-4" />}
          {toast.type === 'error' && <X className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
