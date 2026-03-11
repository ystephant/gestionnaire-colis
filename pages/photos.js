import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';
import {
  Upload, Tag, Trash2, X, Check, ChevronDown, ChevronRight,
  Image as ImageIcon, Loader2, Sun, Moon, LogOut, ArrowLeft,
  Folder, FolderOpen, Layers
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CLOUDINARY_CLOUD_NAME = 'dfnwxqjey';
const CLOUDINARY_UPLOAD_PRESET = 'boardgames_upload';

const COLUMNS = [
  { id: 'pas_encore_en_vente',  label: 'Pas encore en vente', light: 'bg-slate-100',  border: 'border-slate-300',  dot: 'bg-slate-400'  },
  { id: 'en_cours_de_vente',    label: 'En cours de vente',   light: 'bg-amber-50',   border: 'border-amber-300',  dot: 'bg-amber-400'  },
  { id: 'en_vente',             label: 'En vente',            light: 'bg-blue-50',    border: 'border-blue-300',   dot: 'bg-blue-400'   },
  { id: 'en_attente_reception', label: 'En attente réception',light: 'bg-purple-50',  border: 'border-purple-300', dot: 'bg-purple-400' },
  { id: 'vendu',                label: 'Vendu \u2713',        light: 'bg-green-50',   border: 'border-green-300',  dot: 'bg-green-500'  },
];

const formatTagTimestamp = () => {
  const n = new Date();
  const d = String(n.getDate()).padStart(2,'0');
  const mo = String(n.getMonth()+1).padStart(2,'0');
  const h = String(n.getHours()).padStart(2,'0');
  const mi = String(n.getMinutes()).padStart(2,'0');
  return `${d}/${mo} ${h}:${mi}`;
};

const baseGameName = (tag) => tag ? tag.split(' \u2022 ')[0] : '';

export default function PhotosManager() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [username, setUsername]     = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading]       = useState(true);

  const [photos, setPhotos] = useState({
    pas_encore_en_vente: [], en_cours_de_vente: [],
    en_vente: [], en_attente_reception: [], vendu: [],
  });

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const [draggingPhoto, setDraggingPhoto]     = useState(null);
  const [dragOverColumn, setDragOverColumn]   = useState(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState(null);

  // Global multi-select
  const [selectMode, setSelectMode]         = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState({});

  // Tag dropdown
  const [gamesList, setGamesList]           = useState([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch]           = useState('');

  // Folder mode per column
  const [folderMode, setFolderMode]             = useState(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState({});

  const [pendingVendu, setPendingVendu] = useState(null);
  const [toast, setToast]               = useState(null);

  // ── Auth ──────────────────────────────────────────────────
  useEffect(() => {
    const u = localStorage.getItem('username');
    const p = localStorage.getItem('password');
    if (u && p) { setUsername(u); setIsLoggedIn(true); }
    else router.push('/');
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoggedIn && username) { loadPhotos(); loadGames(); }
  }, [isLoggedIn, username]);

  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('sale_photos').select('*')
        .eq('user_id', username).order('position', { ascending: true });
      if (error) throw error;
      const g = { pas_encore_en_vente:[], en_cours_de_vente:[], en_vente:[], en_attente_reception:[], vendu:[] };
      (data||[]).forEach(p => { if (g[p.status]) g[p.status].push(p); });
      setPhotos(g);
    } catch { showToast('Erreur chargement photos','error'); }
  };

  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions').select('game_name')
        .eq('user_id', username).not('game_name','is',null);
      if (error) throw error;
      const unique = [...new Set((data||[]).map(t=>t.game_name).filter(Boolean))].sort();
      setGamesList(unique);
    } catch(e) { console.error(e); }
  };

  const showToast = (message, type='default') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Upload ────────────────────────────────────────────────
  const uploadToCloudinary = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', 'sale_photos');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method:'POST', body:fd });
    if (!res.ok) throw new Error('Upload echoue');
    const data = await res.json();
    return { url: data.secure_url, publicId: data.public_id };
  };

  const handleFileDrop = useCallback(async (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!valid.length) return;
    setUploading(true); setUploadProgress(0);
    let done = 0;
    for (const file of valid) {
      try {
        const { url, publicId } = await uploadToCloudinary(file);
        const { data, error } = await supabase.from('sale_photos').insert({
          user_id: username, image_url: url, cloudinary_public_id: publicId,
          status: 'pas_encore_en_vente', position: Date.now(),
        }).select().single();
        if (error) throw error;
        setPhotos(prev => ({ ...prev, pas_encore_en_vente: [...prev.pas_encore_en_vente, data] }));
      } catch { showToast(`Erreur upload: ${file.name}`, 'error'); }
      done++;
      setUploadProgress(Math.round((done/valid.length)*100));
    }
    setUploading(false); setUploadProgress(0);
    showToast(`${done} photo${done>1?'s':''} ajoutee${done>1?'s':''}`, 'success');
  }, [username]);

  const onDropZoneDragOver  = (e) => { e.preventDefault(); setIsDraggingFile(true); };
  const onDropZoneDragLeave = ()  => setIsDraggingFile(false);
  const onDropZoneDrop      = (e) => { e.preventDefault(); setIsDraggingFile(false); handleFileDrop(e.dataTransfer.files); };

  // ── Drag between columns ──────────────────────────────────
  const onPhotoDragStart = (e, photo, fromColumn) => {
    const sel = selectedPhotos[fromColumn];
    const isInSel = sel && sel.size > 0 && sel.has(photo.id);
    let photosToMove;
    if (selectMode && isInSel) {
      photosToMove = COLUMNS.flatMap(col =>
        (photos[col.id]||[]).filter(p => selectedPhotos[col.id]?.has(p.id))
      );
    } else {
      photosToMove = [photo];
    }
    if (photosToMove.length === 0) photosToMove = [photo];
    setDraggingPhoto({ photos: photosToMove });
    e.dataTransfer.effectAllowed = 'move';
  };

  const onPhotoDragEnd   = () => { setDraggingPhoto(null); setDragOverColumn(null); setDragOverPhotoId(null); };
  const onColumnDragOver = (e, colId) => { e.preventDefault(); setDragOverColumn(colId); };
  const onPhotoDragOverItem = (e, photoId) => { e.preventDefault(); setDragOverPhotoId(photoId); };

  const onColumnDrop = async (e, toColumn) => {
    e.preventDefault();
    if (!draggingPhoto) return;
    const { photos: ptm } = draggingPhoto;
    setDraggingPhoto(null); setDragOverColumn(null); setDragOverPhotoId(null);
    if (toColumn === 'vendu') { setPendingVendu({ photos: ptm }); return; }
    await movePhotos(ptm, toColumn, dragOverPhotoId);
  };

  const movePhotos = async (photosToMove, toColumn, beforePhotoId=null) => {
    const ids = photosToMove.map(p => p.id);
    setPhotos(prev => {
      const next = {};
      COLUMNS.forEach(col => { next[col.id] = (prev[col.id]||[]).filter(p => !ids.includes(p.id)); });
      let to = [...next[toColumn]];
      const updated = photosToMove.map(p => ({ ...p, status: toColumn }));
      if (beforePhotoId) {
        const idx = to.findIndex(p => p.id === beforePhotoId);
        to.splice(idx >= 0 ? idx : to.length, 0, ...updated);
      } else { to.push(...updated); }
      next[toColumn] = to;
      return next;
    });
    setSelectedPhotos({});
    try {
      await supabase.from('sale_photos')
        .update({ status: toColumn, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (ids.length > 1) showToast(`${ids.length} photos deplacees`, 'success');
    } catch { showToast('Erreur deplacement','error'); loadPhotos(); }
  };

  // ── Confirm vendu → delete ────────────────────────────────
  const confirmVendu = async () => {
    if (!pendingVendu) return;
    const { photos: toDelete } = pendingVendu;
    setPendingVendu(null);
    const ids = toDelete.map(p => p.id);
    setPhotos(prev => {
      const next = {};
      COLUMNS.forEach(col => { next[col.id] = (prev[col.id]||[]).filter(p => !ids.includes(p.id)); });
      return next;
    });
    setSelectedPhotos({});
    try {
      await Promise.all(toDelete.map(photo =>
        fetch('/api/delete-cloudinary', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ publicId: photo.cloudinary_public_id }),
        })
      ));
      await supabase.from('sale_photos').delete().in('id', ids);
      showToast(ids.length>1 ? `${ids.length} photos supprimees definitivement` : 'Photo supprimee definitivement', 'success');
    } catch { showToast('Erreur suppression','error'); loadPhotos(); }
  };

  // ── Global select helpers ─────────────────────────────────
  const toggleSelectMode = () => { setSelectMode(p => !p); setSelectedPhotos({}); setShowTagDropdown(false); };
  const toggleSelectPhoto = (colId, photoId) => {
    setSelectedPhotos(prev => {
      const set = new Set(prev[colId]||[]);
      if (set.has(photoId)) set.delete(photoId); else set.add(photoId);
      return { ...prev, [colId]: set };
    });
  };
  const selectAllInColumn = (colId) => setSelectedPhotos(prev => ({ ...prev, [colId]: new Set((photos[colId]||[]).map(p=>p.id)) }));
  const selectAll = () => {
    const next = {};
    COLUMNS.forEach(col => { next[col.id] = new Set((photos[col.id]||[]).map(p=>p.id)); });
    setSelectedPhotos(next);
  };
  const totalSelected = Object.values(selectedPhotos).reduce((acc,s) => acc+(s?.size||0), 0);

  // ── Assign tag with timestamp ─────────────────────────────
  const assignTag = async (gameName) => {
    if (totalSelected === 0) return;
    const tagLabel = `${gameName} \u2022 ${formatTagTimestamp()}`;
    setShowTagDropdown(false); setTagSearch('');
    const updates = Object.entries(selectedPhotos)
      .filter(([,s]) => s && s.size > 0)
      .map(([colId, s]) => ({ colId, ids: [...s] }));

    setPhotos(prev => {
      const next = { ...prev };
      updates.forEach(({ colId, ids }) => {
        next[colId] = next[colId].map(p => ids.includes(p.id) ? { ...p, game_tag: tagLabel } : p);
      });
      return next;
    });
    setSelectedPhotos({});
    try {
      const allIds = updates.flatMap(u => u.ids);
      await supabase.from('sale_photos')
        .update({ game_tag: tagLabel, updated_at: new Date().toISOString() })
        .in('id', allIds);
      showToast(`Tag "${gameName}" applique a ${allIds.length} photo${allIds.length>1?'s':''}`, 'success');
    } catch { showToast('Erreur tag','error'); loadPhotos(); }
  };

  // ── Folder helpers ────────────────────────────────────────
  const toggleFolderMode = (colId) => setFolderMode(prev => { const n=new Set(prev); if(n.has(colId)) n.delete(colId); else n.add(colId); return n; });
  const toggleFolder     = (colId, tagLabel) => setCollapsedFolders(prev => {
    const set = new Set(prev[colId]||[]);
    if (set.has(tagLabel)) set.delete(tagLabel); else set.add(tagLabel);
    return { ...prev, [colId]: set };
  });
  const groupByTag = (colPhotos) => {
    const groups = {}; const ungrouped = [];
    colPhotos.forEach(p => { if (p.game_tag) { if (!groups[p.game_tag]) groups[p.game_tag]=[]; groups[p.game_tag].push(p); } else ungrouped.push(p); });
    return { groups, ungrouped };
  };

  const filteredGames = gamesList.filter(g => g.toLowerCase().includes(tagSearch.toLowerCase()));
  const handleLogout = () => { localStorage.removeItem('username'); localStorage.removeItem('password'); router.push('/'); };

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode?'bg-gray-900':'bg-gray-50'}`}>
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
  if (!isLoggedIn) return null;

  const bg      = darkMode ? 'bg-gray-900' : 'bg-gray-50';
  const text    = darkMode ? 'text-gray-100' : 'text-gray-800';
  const subtext = darkMode ? 'text-gray-400' : 'text-gray-500';

  // ── Photo card ────────────────────────────────────────────
  const PhotoCard = ({ photo, columnId }) => {
    const isSelected = selectedPhotos[columnId]?.has(photo.id);
    const isDragged  = draggingPhoto?.photos?.some(p => p.id === photo.id);
    const isOverItem = dragOverPhotoId === photo.id;
    return (
      <div
        draggable
        onDragStart={e => onPhotoDragStart(e, photo, columnId)}
        onDragEnd={onPhotoDragEnd}
        onDragOver={e => onPhotoDragOverItem(e, photo.id)}
        onClick={() => selectMode && toggleSelectPhoto(columnId, photo.id)}
        className={`relative rounded-xl overflow-hidden transition-all duration-150 group
          ${isDragged ? 'opacity-30 scale-95' : 'opacity-100'}
          ${isOverItem ? 'ring-2 ring-blue-400' : ''}
          ${isSelected ? 'ring-2 ring-blue-500 scale-[0.96]' : ''}
          ${selectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
        `}
        style={{ aspectRatio: '1/1' }}
      >
        <img src={photo.image_url} alt={photo.game_tag||'photo'} className="w-full h-full object-cover" draggable={false} />
        {selectMode && (
          <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-blue-500/30' : 'bg-black/0 group-hover:bg-black/10'}`}>
            <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm
              ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/80 border-white'}`}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
        )}
        {photo.game_tag && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1.5 py-1">
            <p className="text-white text-xs font-medium truncate">{photo.game_tag}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${bg} ${text}`}>

      {/* Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur ${darkMode?'bg-gray-900/95 border-gray-700':'bg-white/95 border-gray-200'}`}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className={`p-2 rounded-lg transition-colors ${darkMode?'hover:bg-gray-800':'hover:bg-gray-100'} ${subtext}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-500" />
              <span className="font-bold text-lg">Photos Vente</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectMode}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors
                ${selectMode ? 'bg-blue-500 text-white' : darkMode?'bg-gray-700 text-gray-300 hover:bg-gray-600':'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Layers className="w-4 h-4" />
              {selectMode ? `Selection (${totalSelected})` : 'Selectionner'}
            </button>
            <button onClick={toggleDarkMode} className={`p-2 rounded-lg transition-colors ${darkMode?'hover:bg-gray-800':'hover:bg-gray-100'}`}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className={`p-2 rounded-lg transition-colors ${darkMode?'hover:bg-gray-800':'hover:bg-gray-100'} ${subtext}`}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating selection toolbar */}
      {selectMode && totalSelected > 0 && (
        <div className="sticky top-[57px] z-20 flex justify-center px-4 py-2 pointer-events-none">
          <div className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl border
            ${darkMode?'bg-gray-800 border-gray-600':'bg-white border-gray-200'}`}>
            <span className={`text-sm font-medium ${subtext}`}>{totalSelected} photo{totalSelected>1?'s':''}</span>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <button onClick={selectAll}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${darkMode?'bg-gray-700 hover:bg-gray-600 text-gray-200':'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
              Tout
            </button>
            <button onClick={() => setSelectedPhotos({})}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${darkMode?'bg-gray-700 hover:bg-gray-600 text-gray-200':'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
              Aucun
            </button>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(p => !p)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                <Tag className="w-3.5 h-3.5" />
                Tagger
                <ChevronDown className="w-3 h-3" />
              </button>
              {showTagDropdown && (
                <div className={`absolute top-full mt-1 right-0 w-64 rounded-xl border shadow-2xl overflow-hidden z-50
                  ${darkMode?'bg-gray-800 border-gray-600':'bg-white border-gray-200'}`}>
                  <div className={`p-2 border-b ${darkMode?'border-gray-700':'border-gray-100'}`}>
                    <input
                      autoFocus type="text" placeholder="Rechercher un jeu..."
                      value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                      className={`w-full text-sm px-3 py-1.5 rounded-lg border outline-none
                        ${darkMode?'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400':'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`}
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredGames.length === 0
                      ? <p className={`text-sm px-4 py-3 ${subtext}`}>Aucun jeu trouve</p>
                      : filteredGames.map(game => (
                          <button key={game} onClick={() => assignTag(game)}
                            className={`w-full text-left text-sm px-4 py-2 transition-colors
                              ${darkMode?'hover:bg-gray-700 text-gray-200':'hover:bg-blue-50 text-gray-700'}`}>
                            <span className="font-medium">{game}</span>
                            <span className={`ml-2 text-xs ${subtext}`}>• {formatTagTimestamp()}</span>
                          </button>
                        ))
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">

        {/* Upload zone */}
        <div
          onDragOver={onDropZoneDragOver} onDragLeave={onDropZoneDragLeave} onDrop={onDropZoneDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
            ${isDraggingFile
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 scale-[1.01]'
              : darkMode ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-800/50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
            }`}
        >
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFileDrop(e.target.files)} />
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
              <p className={`text-sm font-medium ${subtext}`}>Upload en cours... {uploadProgress}%</p>
              <div className="w-64 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className={`w-10 h-10 mx-auto ${isDraggingFile ? 'text-blue-500' : subtext}`} />
              <p className={`font-semibold ${isDraggingFile ? 'text-blue-500' : text}`}>
                {isDraggingFile ? 'Relacher pour uploader' : 'Glisser vos photos ici'}
              </p>
              <p className={`text-sm ${subtext}`}>ou cliquer pour selectionner - JPG, PNG, WEBP</p>
            </div>
          )}
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMNS.map(col => {
            const colPhotos = photos[col.id] || [];
            const isOver    = dragOverColumn === col.id;
            const isVendu   = col.id === 'vendu';
            const isFolded  = folderMode.has(col.id);
            const selCount  = selectedPhotos[col.id]?.size || 0;
            const { groups, ungrouped } = groupByTag(colPhotos);
            const hasTagged = colPhotos.some(p => p.game_tag);

            return (
              <div
                key={col.id}
                onDragOver={e => onColumnDragOver(e, col.id)}
                onDrop={e => onColumnDrop(e, col.id)}
                onDragLeave={() => setDragOverColumn(null)}
                className={`flex flex-col rounded-2xl border-2 transition-all duration-150
                  ${isOver
                    ? `${col.border} ${isVendu?'bg-green-50 dark:bg-green-900/20':'bg-blue-50 dark:bg-blue-900/10'} scale-[1.01]`
                    : darkMode ? 'border-gray-700 bg-gray-800/60' : `border-gray-200 ${col.light}`
                  }`}
                style={{ minHeight: '420px' }}
              >
                {/* Column header */}
                <div className={`px-3 py-2.5 rounded-t-2xl border-b
                  ${darkMode?'bg-gray-700/80 border-gray-600':`${col.light} border-gray-200`}`}>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
                      <span className="font-semibold text-sm truncate">{col.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono flex-shrink-0
                        ${darkMode?'bg-gray-600 text-gray-300':'bg-white/70 text-gray-600'}`}>
                        {colPhotos.length}{selCount > 0 && <span className="text-blue-400 ml-0.5">·{selCount}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {selectMode && colPhotos.length > 0 && (
                        <button onClick={() => selectAllInColumn(col.id)} title="Tout selectionner dans cette colonne"
                          className={`p-1 rounded-lg transition-colors ${darkMode?'hover:bg-gray-600 text-gray-400':'hover:bg-white text-gray-500'}`}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {hasTagged && (
                        <button onClick={() => toggleFolderMode(col.id)} title={isFolded?'Vue grille':'Vue dossiers'}
                          className={`p-1 rounded-lg transition-colors
                            ${isFolded ? 'text-blue-400 bg-blue-100 dark:bg-blue-900/30' : darkMode?'hover:bg-gray-600 text-gray-400':'hover:bg-white text-gray-500'}`}>
                          {isFolded ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Photos area */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {colPhotos.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center py-10 gap-2 rounded-xl border-2 border-dashed
                      ${darkMode?'border-gray-600':'border-gray-300'}`}>
                      <ImageIcon className={`w-8 h-8 ${subtext}`} />
                      <p className={`text-xs ${subtext}`}>Deposer ici</p>
                    </div>
                  ) : isFolded ? (
                    <>
                      {Object.entries(groups).map(([tagLabel, groupPhotos]) => {
                        const isCollapsed = collapsedFolders[col.id]?.has(tagLabel);
                        const parts = tagLabel.split(' \u2022 ');
                        const bName = parts[0];
                        const ts    = parts[1] || '';
                        const gSel  = groupPhotos.filter(p => selectedPhotos[col.id]?.has(p.id)).length;
                        return (
                          <div key={tagLabel} className={`rounded-xl overflow-hidden border ${darkMode?'border-gray-600 bg-gray-700/50':'border-gray-200 bg-white/60'}`}>
                            <div className={`flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors
                              ${darkMode?'hover:bg-gray-600/50':'hover:bg-gray-50'}`}
                              onClick={() => toggleFolder(col.id, tagLabel)}>
                              {isCollapsed
                                ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                                : <ChevronDown  className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
                              }
                              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold truncate">{bName}</p>
                                {ts && <p className={`text-xs ${subtext}`}>{ts}</p>}
                              </div>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono flex-shrink-0
                                ${darkMode?'bg-gray-600 text-gray-300':'bg-gray-100 text-gray-500'}`}>
                                {groupPhotos.length}{gSel > 0 && <span className="text-blue-400 ml-0.5">·{gSel}</span>}
                              </span>
                            </div>
                            {!isCollapsed && (
                              <div className="grid grid-cols-3 gap-1 p-1.5 pt-0">
                                {groupPhotos.map(photo => <PhotoCard key={photo.id} photo={photo} columnId={col.id} />)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {ungrouped.length > 0 && (
                        <div className={`rounded-xl overflow-hidden border ${darkMode?'border-gray-600 bg-gray-700/30':'border-gray-200 bg-white/40'}`}>
                          <div className={`flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors
                            ${darkMode?'hover:bg-gray-600/30':'hover:bg-gray-50'}`}
                            onClick={() => toggleFolder(col.id, '__ungrouped__')}>
                            {collapsedFolders[col.id]?.has('__ungrouped__')
                              ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                              : <ChevronDown  className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                            }
                            <ImageIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                            <span className={`text-xs font-medium flex-1 ${subtext}`}>Sans tag</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${darkMode?'bg-gray-600 text-gray-300':'bg-gray-100 text-gray-500'}`}>
                              {ungrouped.length}
                            </span>
                          </div>
                          {!collapsedFolders[col.id]?.has('__ungrouped__') && (
                            <div className="grid grid-cols-3 gap-1 p-1.5 pt-0">
                              {ungrouped.map(photo => <PhotoCard key={photo.id} photo={photo} columnId={col.id} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {colPhotos.map(photo => <PhotoCard key={photo.id} photo={photo} columnId={col.id} />)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm Vendu modal */}
      {pendingVendu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4 ${darkMode?'bg-gray-800':'bg-white'}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-base">Supprimer definitivement ?</h3>
                <p className={`text-sm mt-1 ${subtext}`}>
                  {pendingVendu.photos.length > 1
                    ? `${pendingVendu.photos.length} photos seront supprimees de Cloudinary et de la base de donnees.`
                    : 'Cette photo sera supprimee de Cloudinary et de la base de donnees.'
                  } Cette action est irreversible.
                </p>
              </div>
            </div>
            {pendingVendu.photos.length === 1 && (
              <img src={pendingVendu.photos[0].image_url} alt="" className="w-full h-32 object-cover rounded-xl" />
            )}
            {pendingVendu.photos.length > 1 && (
              <div className="flex gap-1 overflow-hidden rounded-xl">
                {pendingVendu.photos.slice(0,4).map(p => <img key={p.id} src={p.image_url} alt="" className="flex-1 h-20 object-cover" />)}
                {pendingVendu.photos.length > 4 && (
                  <div className={`flex-1 h-20 flex items-center justify-center text-sm font-bold ${darkMode?'bg-gray-700 text-gray-300':'bg-gray-100 text-gray-500'}`}>
                    +{pendingVendu.photos.length - 4}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setPendingVendu(null)}
                className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${darkMode?'bg-gray-700 hover:bg-gray-600':'bg-gray-100 hover:bg-gray-200'}`}>
                Annuler
              </button>
              <button onClick={confirmVendu}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 text-white transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl font-medium text-sm flex items-center gap-2
          ${toast.type==='error'?'bg-red-500 text-white':toast.type==='success'?'bg-green-500 text-white':darkMode?'bg-gray-700 text-white':'bg-gray-800 text-white'}`}>
          {toast.type==='success' && <Check className="w-4 h-4" />}
          {toast.type==='error'   && <X     className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
