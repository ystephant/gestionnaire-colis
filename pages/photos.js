import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';
import {
  Upload, Tag, Trash2, X, Check, ChevronDown, ChevronRight,
  Image as ImageIcon, Loader2, Sun, Moon, LogOut, ArrowLeft,
  Folder, FolderOpen, Download, ZoomIn,
  RotateCcw, RotateCw, ChevronLeft,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CLOUDINARY_CLOUD_NAME    = 'dfnwxqjey';
const CLOUDINARY_UPLOAD_PRESET = 'boardgames_upload';

const COLUMNS = [
  {
    id: 'pas_encore_en_vente', label: 'Pas encore en vente',
    lightBg: 'bg-rose-50', lightBorder: 'border-rose-200', lightHeader: 'bg-rose-100/70',
    darkRgba: 'rgba(159,18,57,0.12)', darkBorderRgba: 'rgba(159,18,57,0.35)', darkHeaderRgba: 'rgba(159,18,57,0.18)',
    dot: 'bg-rose-400',
  },
  {
    id: 'en_cours_de_vente', label: 'En cours de vente',
    lightBg: 'bg-amber-50', lightBorder: 'border-amber-200', lightHeader: 'bg-amber-100/70',
    darkRgba: 'rgba(146,64,14,0.13)', darkBorderRgba: 'rgba(146,64,14,0.35)', darkHeaderRgba: 'rgba(146,64,14,0.20)',
    dot: 'bg-amber-400',
  },
  {
    id: 'en_vente', label: 'En vente',
    lightBg: 'bg-sky-50', lightBorder: 'border-sky-200', lightHeader: 'bg-sky-100/70',
    darkRgba: 'rgba(7,89,133,0.13)', darkBorderRgba: 'rgba(7,89,133,0.35)', darkHeaderRgba: 'rgba(7,89,133,0.20)',
    dot: 'bg-sky-400',
  },
  {
    id: 'en_attente_reception', label: 'En attente reception',
    lightBg: 'bg-violet-50', lightBorder: 'border-violet-200', lightHeader: 'bg-violet-100/70',
    darkRgba: 'rgba(76,29,149,0.13)', darkBorderRgba: 'rgba(76,29,149,0.35)', darkHeaderRgba: 'rgba(76,29,149,0.20)',
    dot: 'bg-violet-400',
  },
  {
    id: 'vendu', label: 'Vendu \u2713',
    lightBg: 'bg-emerald-50', lightBorder: 'border-emerald-200', lightHeader: 'bg-emerald-100/70',
    darkRgba: 'rgba(6,78,59,0.13)', darkBorderRgba: 'rgba(6,78,59,0.35)', darkHeaderRgba: 'rgba(6,78,59,0.20)',
    dot: 'bg-emerald-500',
  },
];

const formatTagTimestamp = () => {
  const n = new Date();
  return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')} ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
};
const baseGameName = (tag) => (tag ? tag.split(' \u2022 ')[0] : '');

// Horodatage court depuis le tag : "11/03 14:32" → "1103-1432"
const shortTs = (tag) => {
  if (!tag) return '';
  const ts = tag.split(' \u2022 ')[1]; // "11/03 14:32"
  if (!ts) return '';
  return ts.replace('/', '').replace(' ', '-').replace(':', ''); // "1103-1432"
};

// Nom de fichier propre : Catan_1103-1432_1.jpg
const makeFilename = (photo, index, ext) => {
  if (photo.game_tag) {
    const name = baseGameName(photo.game_tag).replace(/\s+/g, '_');
    const ts   = shortTs(photo.game_tag);
    return `${name}_${ts}_${index}.${ext}`;
  }
  return `photo_${index}.${ext}`;
};

// ─────────────────────────────────────────────────────────────
// PhotoCard défini EN DEHORS du composant principal — ne jamais
// redéfinir dans le render, sinon React démonte/remonte à chaque
// render et casse le drag, la lightbox, etc.
// ─────────────────────────────────────────────────────────────
const PhotoCard = ({
  photo, columnId, siblingPhotos,
  isSelected, isDragged, isOverItem, inFolder,
  onDragStart, onDragEnd, onDragOver,
  onToggleSelect, onCtrlSelect, onOpenLightbox, onDownloadSingle, onDeletePhoto,
}) => {
  const rot = photo.rotation || 0;
  return (
    <div
      data-photoid={photo.id}
      data-colid={columnId}
      draggable
      onDragStart={e => onDragStart(e, photo, columnId)}
      onDragEnd={onDragEnd}
      onDragOver={e => onDragOver(e, photo.id)}
      onClick={e => {
        if (e.ctrlKey || e.metaKey) { e.stopPropagation(); onCtrlSelect(columnId, photo.id); return; }
        onToggleSelect(columnId, photo.id);
      }}
      className={[
        'relative rounded-xl overflow-hidden transition-all duration-150 group cursor-pointer',
        isDragged  ? 'opacity-30 scale-95'               : 'opacity-100',
        isOverItem ? 'ring-2 ring-blue-400'               : '',
        isSelected ? 'ring-2 ring-blue-500 scale-[0.96]' : '',
      ].join(' ')}
      style={{ aspectRatio: '1/1' }}
    >
      {/* Image */}
      <div className="w-full h-full overflow-hidden">
        <img
          src={photo.image_url}
          alt={photo.game_tag || 'photo'}
          className="w-full h-full object-cover transition-transform duration-300"
          style={{ transform: `rotate(${rot}deg)`, transformOrigin: 'center' }}
          draggable={false}
        />
      </div>

      {/* Hover actions — toujours visibles au survol */}
      <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
        <button
          onClick={e => { e.stopPropagation(); onOpenLightbox(photo, siblingPhotos || [photo]); }}
          className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          title="Agrandir"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="flex gap-1">
          <button
            onClick={e => { e.stopPropagation(); onDownloadSingle(photo); }}
            className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            title="Telecharger"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDeletePhoto(photo); }}
            className="w-7 h-7 rounded-lg bg-red-500/80 hover:bg-red-600 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Selection overlay — masqué dans les dossiers (la coche est sur le dossier) */}
      {!inFolder && (
        <div className={`absolute inset-0 transition-colors ${isSelected ? 'bg-blue-500/30' : 'bg-black/0 group-hover:bg-black/10'}`}>
          <div className={`absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm
            ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/80 border-white'}`}>
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
        </div>
      )}

      {/* Tag badge */}
      {photo.game_tag && (() => {
        const [name, ts] = photo.game_tag.split(' \u2022 ');
        return (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1">
            <p className="text-white text-xs font-semibold truncate leading-tight">{name}</p>
            {ts && <p className="text-white/60 text-[9px] truncate leading-tight">{ts}</p>}
          </div>
        );
      })()}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
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

  // Upload depuis le bureau
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploading, setUploading]           = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Drag de photos entre colonnes
  const [draggingPhoto, setDraggingPhoto]     = useState(null);
  const [dragOverColumn, setDragOverColumn]   = useState(null);
  const [dragOverPhotoId, setDragOverPhotoId] = useState(null);

  // Drag de dossier entier entre colonnes
  const [draggingFolder, setDraggingFolder] = useState(null); // { tagLabel, fromColId, folderPhotos }
  const [dragOverFolderCol, setDragOverFolderCol] = useState(null);

  // Sélection multiple
  const [selectMode, setSelectMode]         = useState(true);
  const [selectedPhotos, setSelectedPhotos] = useState({});

  // Tagging
  const [gamesList, setGamesList]             = useState([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch]             = useState('');

  // Vue dossiers — active par défaut sur toutes les colonnes
  const [folderMode, setFolderMode]             = useState(new Set(COLUMNS.map(c => c.id)));
  const [collapsedFolders, setCollapsedFolders] = useState({});

  // Lightbox
  const [lightbox, setLightbox] = useState(null);

  // Download
  const [downloading, setDownloading] = useState(false);

  // Zoom molette par colonne — 1=très grand, 4=très petit
  const [colZoom, setColZoom] = useState(() => {
    const z = {};
    COLUMNS.forEach(c => { z[c.id] = 2; });
    return z;
  });
  const colRefs   = useRef({});
  const photosRef = useRef({});   // miroir de photos pour les handlers globaux
  const lassoRef  = useRef(null); // miroir de lasso pour les handlers globaux

  // Lasso — rectangle de sélection dessiné à la souris
  const [lasso, setLasso] = useState(null);
  // { colId, startX, startY, curX, curY }

  // Sync refs
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { lassoRef.current  = lasso;  }, [lasso]);

  // Handlers globaux mousemove / mouseup pour le lasso
  useEffect(() => {
    const onMove = (e) => {
      if (!lassoRef.current) return;
      setLasso(prev => prev ? { ...prev, curX: e.clientX, curY: e.clientY } : null);
    };

    const onUp = () => {
      const l = lassoRef.current;
      if (!l) return;

      const minX = Math.min(l.startX, l.curX);
      const maxX = Math.max(l.startX, l.curX);
      const minY = Math.min(l.startY, l.curY);
      const maxY = Math.max(l.startY, l.curY);

      // Seuil minimum pour ne pas déclencher sur un simple clic
      if (maxX - minX > 6 || maxY - minY > 6) {
        const colEl = colRefs.current[l.colId];
        if (colEl) {
          const hitPhotoIds = [];
          colEl.querySelectorAll('[data-photoid]').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.left < maxX && r.right > minX && r.top < maxY && r.bottom > minY) {
              hitPhotoIds.push(el.dataset.photoid);
            }
          });

          // En vue dossiers : sélectionner aussi les dossiers entiers
          const hitFolderTags = [];
          colEl.querySelectorAll('[data-folderid]').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.left < maxX && r.right > minX && r.top < maxY && r.bottom > minY) {
              hitFolderTags.push(el.dataset.folderid);
            }
          });

          const colPhotos = photosRef.current[l.colId] || [];
          hitFolderTags.forEach(tag => {
            colPhotos.filter(p => p.game_tag === tag).forEach(p => hitPhotoIds.push(p.id));
          });

          if (hitPhotoIds.length > 0) {
            setSelectedPhotos(prev => {
              const s = new Set(prev[l.colId] || []);
              hitPhotoIds.forEach(id => s.add(id));
              return { ...prev, [l.colId]: s };
            });
          }
        }
      } else {
        // Clic simple sur le fond → désélectionner tout
        setSelectedPhotos({});
      }
      setLasso(null);
    };

    // Clic hors de toute colonne → désélectionner
    const onGlobalDown = (e) => {
      if (e.target.closest('[data-photoid],[data-folderid],button,a,input,[role="dialog"],[data-noclr]')) return;
      setSelectedPhotos({});
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('mousedown', onGlobalDown);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('mousedown', onGlobalDown);
    };
  }, []); // stable — utilise les refs

  // ── Molette : replier/déplier les dossiers de la colonne ───
  // Ref vers collapsedFolders + folderMode + photos pour les handlers non-passifs
  const collapsedFoldersRef = useRef({});
  const folderModeRef       = useRef(new Set());
  const groupsRef           = useRef({});

  useEffect(() => { collapsedFoldersRef.current = collapsedFolders; }, [collapsedFolders]);
  useEffect(() => { folderModeRef.current       = folderMode;       }, [folderMode]);
  // groupsRef mis à jour dans le render — on le met ici via photos
  useEffect(() => {
    const g = {};
    COLUMNS.forEach(col => {
      const colPhotos = photos[col.id] || [];
      const grp = {};
      colPhotos.forEach(p => { if (p.game_tag) { if (!grp[p.game_tag]) grp[p.game_tag] = []; grp[p.game_tag].push(p); } });
      g[col.id] = grp;
    });
    groupsRef.current = g;
  }, [photos]);

  const onColWheel = useCallback((e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!folderModeRef.current.has(colId)) return;
    const taggedKeys = Object.keys(groupsRef.current[colId] || {});
    const hasUngrouped = (photosRef.current[colId] || []).some(p => !p.game_tag);
    const allKeys = [...taggedKeys, ...(hasUngrouped ? ['__ungrouped__'] : [])];
    if (!allKeys.length) return;
    if (e.deltaY > 0) {
      setCollapsedFolders(prev => ({ ...prev, [colId]: new Set(allKeys) }));
    } else {
      setCollapsedFolders(prev => ({ ...prev, [colId]: new Set() }));
    }
  }, []);

  // Wheel non-passif — isLoggedIn en dep pour attendre que les colonnes soient rendues
  useEffect(() => {
    if (!isLoggedIn) return;
    const handlers = {};
    COLUMNS.forEach(col => {
      const el = colRefs.current[col.id];
      if (!el) return;
      const h = (e) => onColWheel(e, col.id);
      handlers[col.id] = h;
      el.addEventListener('wheel', h, { passive: false });
    });
    return () => {
      COLUMNS.forEach(col => {
        const el = colRefs.current[col.id];
        if (el && handlers[col.id]) el.removeEventListener('wheel', handlers[col.id]);
      });
    };
  }, [onColWheel, isLoggedIn]);

  // Modale suppression / toast
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toast, setToast]                 = useState(null);

  // ── Auth ─────────────────────────────────────────────────────
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
      (data || []).forEach(p => { if (g[p.status]) g[p.status].push(p); });
      setPhotos(g);
    } catch { showToast('Erreur chargement photos', 'error'); }
  };

  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions').select('game_name')
        .eq('user_id', username).not('game_name', 'is', null);
      if (error) throw error;
      const unique = [...new Set((data || []).map(t => t.game_name).filter(Boolean))].sort();
      setGamesList(unique);
    } catch (e) { console.error(e); }
  };

  const showToast = useCallback((message, type = 'default') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Upload ───────────────────────────────────────────────────
  const uploadToCloudinary = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fd.append('folder', 'sale_photos');
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: fd }
    );
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
          status: 'pas_encore_en_vente', position: Date.now(), rotation: 0,
        }).select().single();
        if (error) throw error;
        setPhotos(prev => ({ ...prev, pas_encore_en_vente: [...prev.pas_encore_en_vente, data] }));
      } catch { showToast(`Erreur upload: ${file.name}`, 'error'); }
      done++;
      setUploadProgress(Math.round((done / valid.length) * 100));
    }
    setUploading(false); setUploadProgress(0);
    showToast(`${done} photo${done > 1 ? 's' : ''} ajoutee${done > 1 ? 's' : ''}`, 'success');
  }, [username]);

  const onDropZoneDragOver  = (e) => { e.preventDefault(); setIsDraggingFile(true); };
  const onDropZoneDragLeave = ()  => setIsDraggingFile(false);
  const onDropZoneDrop      = (e) => {
    e.preventDefault(); setIsDraggingFile(false);
    // Ne pas déclencher si c'est un drag interne (photo ou dossier)
    if (draggingPhoto || draggingFolder) return;
    handleFileDrop(e.dataTransfer.files);
  };

  // ── Drag de photos entre colonnes ───────────────────────────
  const onPhotoDragStart = useCallback((e, photo, fromColumn) => {
    e.stopPropagation();
    const sel = selectedPhotos[fromColumn];
    const isInSel = sel && sel.size > 0 && sel.has(photo.id);
    let ptm = (selectMode && isInSel)
      ? COLUMNS.flatMap(col => (photos[col.id] || []).filter(p => selectedPhotos[col.id]?.has(p.id)))
      : [photo];
    if (!ptm.length) ptm = [photo];
    setDraggingPhoto({ photos: ptm });
    e.dataTransfer.effectAllowed = 'move';
  }, [selectMode, selectedPhotos, photos]);

  const onPhotoDragEnd = useCallback(() => {
    setDraggingPhoto(null); setDragOverColumn(null); setDragOverPhotoId(null);
  }, []);

  const onPhotoDragOverItem = useCallback((e, photoId) => {
    e.preventDefault(); e.stopPropagation();
    setDragOverPhotoId(photoId);
  }, []);

  // ── Drag de DOSSIER entier entre colonnes ───────────────────
  const onFolderDragStart = useCallback((e, tagLabel, fromColId, folderPhotos) => {
    e.stopPropagation();
    setDraggingFolder({ tagLabel, fromColId, folderPhotos });
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const onFolderDragEnd = useCallback(() => {
    setDraggingFolder(null); setDragOverFolderCol(null);
  }, []);

  // ── Drop sur une colonne (photo OU dossier) ─────────────────
  const onColumnDragOver = (e, colId) => {
    e.preventDefault();
    if (draggingFolder) setDragOverFolderCol(colId);
    else setDragOverColumn(colId);
  };

  const onColumnDrop = async (e, toColumn) => {
    e.preventDefault();

    // Priorité : drag de dossier
    if (draggingFolder) {
      const { tagLabel, fromColId, folderPhotos } = draggingFolder;
      setDraggingFolder(null); setDragOverFolderCol(null);
      if (fromColId === toColumn) return;
      if (toColumn === 'vendu') { setPendingDelete({ photos: folderPhotos }); return; }
      await movePhotos(folderPhotos, toColumn, null);
      showToast(`Dossier "${baseGameName(tagLabel)}" déplacé`, 'success');
      return;
    }

    // Drag de photo(s)
    if (!draggingPhoto) return;
    const { photos: ptm } = draggingPhoto;
    const capturedBeforeId = dragOverPhotoId;
    setDraggingPhoto(null); setDragOverColumn(null); setDragOverPhotoId(null);
    if (toColumn === 'vendu') { setPendingDelete({ photos: ptm }); return; }
    await movePhotos(ptm, toColumn, capturedBeforeId);
  };

  const movePhotos = async (ptm, toColumn, beforePhotoId = null) => {
    const ids = ptm.map(p => p.id);
    setPhotos(prev => {
      const next = {};
      COLUMNS.forEach(col => { next[col.id] = (prev[col.id] || []).filter(p => !ids.includes(p.id)); });
      const to = [...next[toColumn]];
      const updated = ptm.map(p => ({ ...p, status: toColumn }));
      if (beforePhotoId) {
        const idx = to.findIndex(p => p.id === beforePhotoId);
        to.splice(idx >= 0 ? idx : to.length, 0, ...updated);
      } else {
        to.push(...updated);
      }
      next[toColumn] = to;
      return next;
    });
    setSelectedPhotos({});
    try {
      await supabase.from('sale_photos')
        .update({ status: toColumn, updated_at: new Date().toISOString() })
        .in('id', ids);
    } catch { showToast('Erreur deplacement', 'error'); loadPhotos(); }
  };

  // ── Suppression ──────────────────────────────────────────────
  const handleDeletePhoto = useCallback((photo) => {
    setPendingDelete({ photos: [photo] });
  }, []);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { photos: toDelete } = pendingDelete;
    setPendingDelete(null);
    const ids = toDelete.map(p => p.id);
    setPhotos(prev => {
      const next = {};
      COLUMNS.forEach(col => { next[col.id] = (prev[col.id] || []).filter(p => !ids.includes(p.id)); });
      return next;
    });
    setSelectedPhotos({});
    if (lightbox && ids.includes(lightbox.photo.id)) setLightbox(null);
    try {
      await Promise.all(toDelete.map(ph =>
        fetch('/api/delete-cloudinary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: ph.cloudinary_public_id }),
        })
      ));
      await supabase.from('sale_photos').delete().in('id', ids);
      showToast(
        ids.length > 1 ? `${ids.length} photos supprimees` : 'Photo supprimee',
        'success'
      );
    } catch { showToast('Erreur suppression', 'error'); loadPhotos(); }
  };

  const deleteSelected = () => {
    const all = COLUMNS.flatMap(col => (photos[col.id] || []).filter(p => selectedPhotos[col.id]?.has(p.id)));
    if (all.length) setPendingDelete({ photos: all });
  };

  // ── Sélection multiple ───────────────────────────────────────
  const toggleSelectPhoto = useCallback((colId, photoId) => {
    setSelectedPhotos(prev => {
      const s = new Set(prev[colId] || []);
      if (s.has(photoId)) s.delete(photoId); else s.add(photoId);
      return { ...prev, [colId]: s };
    });
  }, []);
  const onCtrlSelect = useCallback((colId, photoId) => {
    setSelectedPhotos(prev => {
      const s = new Set(prev[colId] || []);
      if (s.has(photoId)) s.delete(photoId); else s.add(photoId);
      return { ...prev, [colId]: s };
    });
  }, []);

  // Coche sur un dossier : sélectionne TOUTES ses photos (ou désélectionne si tout est déjà sélectionné)
  const toggleFolderSelection = useCallback((colId, folderPhotos) => {
    setSelectedPhotos(prev => {
      const s      = new Set(prev[colId] || []);
      const allIds = folderPhotos.map(p => p.id);
      const allSel = allIds.every(id => s.has(id));
      if (allSel) { allIds.forEach(id => s.delete(id)); }  // tout coché → tout décocher
      else        { allIds.forEach(id => s.add(id));    }  // partiel/vide → tout cocher
      return { ...prev, [colId]: s };
    });
  }, []);

  // Clic sur le fond (hors photo/dossier/bouton) → désélectionner tout
  const onZoneMouseDown = useCallback((e, colId) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-photoid],[data-folderid],button,a,input')) return;
    e.preventDefault();
    setSelectedPhotos({});
    setLasso({ colId, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY });
  }, []);

  const selectAllInColumn = (colId) => setSelectedPhotos(prev => ({
    ...prev, [colId]: new Set((photos[colId] || []).map(p => p.id))
  }));
  const selectAll = () => {
    const n = {};
    COLUMNS.forEach(col => { n[col.id] = new Set((photos[col.id] || []).map(p => p.id)); });
    setSelectedPhotos(n);
  };
  const totalSelected = Object.values(selectedPhotos).reduce((acc, s) => acc + (s?.size || 0), 0);

  // ── Tagging ──────────────────────────────────────────────────
  const assignTag = async (gameName) => {
    if (totalSelected === 0) return;
    const tagLabel = `${gameName} \u2022 ${formatTagTimestamp()}`;
    setShowTagDropdown(false); setTagSearch('');
    const updates = Object.entries(selectedPhotos)
      .filter(([, s]) => s && s.size > 0)
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
      showToast(`"${gameName}" taggué sur ${allIds.length} photo${allIds.length > 1 ? 's' : ''}`, 'success');
    } catch { showToast('Erreur tag', 'error'); loadPhotos(); }
  };

  // ── Dossiers ─────────────────────────────────────────────────
  const toggleFolderMode = (colId) => setFolderMode(prev => {
    const n = new Set(prev);
    if (n.has(colId)) n.delete(colId); else n.add(colId);
    return n;
  });
  const toggleFolder = (colId, tagLabel) => setCollapsedFolders(prev => {
    const s = new Set(prev[colId] || []);
    if (s.has(tagLabel)) s.delete(tagLabel); else s.add(tagLabel);
    return { ...prev, [colId]: s };
  });
  const groupByTag = (colPhotos) => {
    const groups = {}; const ungrouped = [];
    colPhotos.forEach(p => {
      if (p.game_tag) { if (!groups[p.game_tag]) groups[p.game_tag] = []; groups[p.game_tag].push(p); }
      else ungrouped.push(p);
    });
    return { groups, ungrouped };
  };

  // ── Lightbox ─────────────────────────────────────────────────
  const openLightbox = useCallback((photo, siblingPhotos) => {
    const index = siblingPhotos.findIndex(p => p.id === photo.id);
    setLightbox({ photo, rotation: photo.rotation || 0, siblingPhotos, index });
  }, []);
  const closeLightbox = () => setLightbox(null);
  const lightboxNav = (dir) => {
    if (!lightbox) return;
    const idx = (lightbox.index + dir + lightbox.siblingPhotos.length) % lightbox.siblingPhotos.length;
    const ph = lightbox.siblingPhotos[idx];
    setLightbox(prev => ({ ...prev, photo: ph, rotation: ph.rotation || 0, index: idx }));
  };
  const rotateLightbox = async (dir) => {
    const newRot = ((lightbox.rotation + dir) + 360) % 360;
    setLightbox(prev => ({ ...prev, rotation: newRot }));
    const colId = lightbox.photo.status;
    setPhotos(prev => ({
      ...prev,
      [colId]: prev[colId].map(p => p.id === lightbox.photo.id ? { ...p, rotation: newRot } : p),
    }));
    try {
      await supabase.from('sale_photos')
        .update({ rotation: newRot, updated_at: new Date().toISOString() })
        .eq('id', lightbox.photo.id);
    } catch { showToast('Erreur rotation', 'error'); }
  };

  // ── Téléchargement ───────────────────────────────────────────
  const triggerDownload = (url, filename) => {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const downloadSingle = useCallback(async (photo) => {
    try {
      const res  = await fetch(photo.image_url);
      const blob = await res.blob();
      const ext  = blob.type.includes('png') ? 'png' : 'jpg';
      const url  = URL.createObjectURL(blob);
      triggerDownload(url, makeFilename(photo, 1, ext));
      URL.revokeObjectURL(url);
    } catch { showToast('Erreur telechargement', 'error'); }
  }, []);

  const downloadMultiple = async (photosArr) => {
    if (!photosArr.length) return;
    if (photosArr.length === 1) { await downloadSingle(photosArr[0]); return; }
    setDownloading(true);
    for (let i = 0; i < photosArr.length; i++) {
      const ph = photosArr[i];
      try {
        const res  = await fetch(ph.image_url);
        const blob = await res.blob();
        const ext  = blob.type.includes('png') ? 'png' : 'jpg';
        const url  = URL.createObjectURL(blob);
        triggerDownload(url, makeFilename(ph, i + 1, ext));
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      } catch { /* skip */ }
    }
    setDownloading(false);
    showToast(`${photosArr.length} photos telechargees`, 'success');
  };
  const downloadSelected = () => {
    const all = COLUMNS.flatMap(col => (photos[col.id] || []).filter(p => selectedPhotos[col.id]?.has(p.id)));
    downloadMultiple(all);
  };

  const removeTag = async () => {
    if (totalSelected === 0) return;
    const updates = Object.entries(selectedPhotos)
      .filter(([, s]) => s && s.size > 0)
      .map(([colId, s]) => ({ colId, ids: [...s] }));
    setPhotos(prev => {
      const next = { ...prev };
      updates.forEach(({ colId, ids }) => {
        next[colId] = (prev[colId] || []).map(p => ids.includes(p.id) ? { ...p, game_tag: null } : p);
      });
      return next;
    });
    setSelectedPhotos({});
    try {
      const allIds = updates.flatMap(u => u.ids);
      await supabase.from('sale_photos').update({ game_tag: null, updated_at: new Date().toISOString() }).in('id', allIds);
      showToast('Tag retiré', 'success');
    } catch { showToast('Erreur retrait tag', 'error'); }
  };
  const handleLogout  = () => { localStorage.removeItem('username'); localStorage.removeItem('password'); router.push('/'); };

  // ── Rendu ────────────────────────────────────────────────────
  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
  if (!isLoggedIn) return null;

  const subtext  = darkMode ? 'text-gray-400' : 'text-gray-500';
  const textMain = darkMode ? 'text-gray-100' : 'text-gray-800';
  const cardBg   = darkMode ? 'bg-gray-800'   : 'bg-white';
  const inputCls = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400'
    : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400';
  const btnGhost = darkMode
    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700';
  const divider = darkMode ? 'bg-gray-600' : 'bg-gray-300';

  // Props partagés pour tous les PhotoCards — stables entre renders
  const cardProps = {
    onDragStart:      onPhotoDragStart,
    onDragEnd:        onPhotoDragEnd,
    onDragOver:       onPhotoDragOverItem,
    onToggleSelect:   toggleSelectPhoto,
    onCtrlSelect:     onCtrlSelect,
    onOpenLightbox:   openLightbox,
    onDownloadSingle: downloadSingle,
    onDeletePhoto:    handleDeletePhoto,
  };

  const renderCard = (colId, photo, sibs, inFolder = false) => (
    <PhotoCard
      key={photo.id}
      photo={photo}
      columnId={colId}
      siblingPhotos={sibs}
      isSelected={!!selectedPhotos[colId]?.has(photo.id)}
      isDragged={!!draggingPhoto?.photos?.some(p => p.id === photo.id)}
      isOverItem={dragOverPhotoId === photo.id}
      inFolder={inFolder}
      {...cardProps}
    />
  );

  // grid-cols selon zoom (1–4)
  const zoomGridCls = (z) => ['grid-cols-1','grid-cols-2','grid-cols-3','grid-cols-4'][z - 1] || 'grid-cols-2';

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>

      {/* ── Header ── */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur ${darkMode ? 'bg-gray-900/95 border-gray-700' : 'bg-white/95 border-gray-200'}`}>
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-500" />
              <span className="font-bold text-lg">Photos Vente</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Barre flottante de sélection ── */}
      {selectMode && totalSelected > 0 && (
        <div className="sticky top-[57px] z-20 flex justify-center px-4 py-2 pointer-events-none">
          <div className={`pointer-events-auto flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl border ${cardBg} ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <span className={`text-sm font-medium ${subtext}`}>{totalSelected} photo{totalSelected > 1 ? 's' : ''}</span>
            <div className={`w-px h-4 ${divider}`} />
            <button onClick={selectAll}              className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${btnGhost}`}>Tout</button>
            <button onClick={() => setSelectedPhotos({})} className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${btnGhost}`}>Aucun</button>
            <div className={`w-px h-4 ${divider}`} />
            <button
              onClick={downloadSelected} disabled={downloading}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${btnGhost}`}
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Telecharger
            </button>
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </button>
            <div className={`w-px h-4 ${divider}`} />
            {/* Retirer le tag */}
            <button
              onClick={removeTag}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${btnGhost}`}
              title="Retirer le tag des photos sélectionnées"
            >
              <X className="w-3.5 h-3.5" /> Retirer tag
            </button>
            {/* Dropdown tag */}
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(p => !p)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                <Tag className="w-3.5 h-3.5" /> Tagger <ChevronDown className="w-3 h-3" />
              </button>
              {showTagDropdown && (
                <div className={`absolute top-full mt-1 right-0 w-64 rounded-xl border shadow-2xl overflow-hidden z-50 ${cardBg} ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  <div className={`p-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                    <input
                      autoFocus type="text" placeholder="Rechercher un jeu..."
                      value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                      className={`w-full text-sm px-3 py-1.5 rounded-lg border outline-none ${inputCls}`}
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {gamesList.length === 0 && <p className={`text-sm px-4 py-3 ${subtext}`}>Chargement des jeux...</p>}
                    {gamesList.length > 0 && filteredGames.length === 0 && <p className={`text-sm px-4 py-3 ${subtext}`}>Aucun jeu trouve</p>}
                    {filteredGames.map(game => (
                      <button
                        key={game} onClick={() => assignTag(game)}
                        className={`w-full text-left text-sm px-4 py-2.5 transition-colors border-b last:border-0 ${darkMode ? 'hover:bg-gray-700 text-gray-200 border-gray-700' : 'hover:bg-blue-50 text-gray-700 border-gray-100'}`}
                      >
                        <span className="font-semibold">{game}</span>
                        <span className={`block text-xs mt-0.5 ${subtext}`}>{formatTagTimestamp()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">

        {/* ── Zone d'upload ── */}
        <div
          onDragOver={onDropZoneDragOver}
          onDragLeave={onDropZoneDragLeave}
          onDrop={onDropZoneDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
            ${isDraggingFile && !draggingPhoto && !draggingFolder
              ? 'border-blue-400 bg-blue-50 scale-[1.01]'
              : darkMode
                ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-800/50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
            }`}
        >
          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
            onChange={e => handleFileDrop(e.target.files)} />
          {uploading ? (
            <div className="space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
              <p className={`text-sm font-medium ${subtext}`}>Upload en cours… {uploadProgress}%</p>
              <div className={`w-64 mx-auto rounded-full h-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className={`w-10 h-10 mx-auto ${subtext}`} />
              <p className={`font-semibold ${textMain}`}>Glisser vos photos depuis le bureau ici</p>
              <p className={`text-sm ${subtext}`}>ou cliquer pour selectionner — JPG, PNG, WEBP</p>
            </div>
          )}
        </div>

        {/* ── Kanban ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {COLUMNS.map(col => {
            const colPhotos  = photos[col.id] || [];
            const isPhotoOver  = dragOverColumn === col.id;
            const isFolderOver = dragOverFolderCol === col.id;
            const isOver     = isPhotoOver || isFolderOver;
            const isFolded   = folderMode.has(col.id);
            const selCount   = selectedPhotos[col.id]?.size || 0;
            const hasTagged  = colPhotos.some(p => p.game_tag);
            const { groups, ungrouped } = groupByTag(colPhotos);
            const zoom       = colZoom[col.id] ?? 2;
            const gridCls    = zoomGridCls(zoom);

            const colBgStyle     = darkMode ? { backgroundColor: isOver
              ? col.darkRgba.replace('0.12','0.25').replace('0.13','0.25')
              : col.darkRgba } : {};
            const colBorderStyle = darkMode ? { borderColor: isOver ? '#60a5fa' : col.darkBorderRgba } : {};
            const headerStyle    = darkMode ? { backgroundColor: col.darkHeaderRgba } : {};

            return (
              <div
                key={col.id}
                data-kanban-col={col.id}
                ref={el => { colRefs.current[col.id] = el; }}
                onDragOver={e => onColumnDragOver(e, col.id)}
                onDrop={e => onColumnDrop(e, col.id)}
                onDragLeave={() => { setDragOverColumn(null); setDragOverFolderCol(null); }}
                className={[
                  'flex flex-col rounded-2xl border-2 transition-all duration-150',
                  isOver && !darkMode ? 'scale-[1.01] border-blue-300' : '',
                  !darkMode ? `${col.lightBg} ${isOver ? 'border-blue-300' : col.lightBorder}` : '',
                  isFolderOver ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                ].join(' ')}
                style={{ minHeight: '420px', position: 'relative', ...colBgStyle, ...(darkMode ? colBorderStyle : {}) }}
              >
                {/* En-tête de colonne */}
                <div
                  className={`px-3 py-2.5 rounded-t-2xl border-b ${darkMode ? 'border-white/10' : col.lightBorder} ${!darkMode ? col.lightHeader : ''}`}
                  style={darkMode ? headerStyle : {}}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
                      <span className="font-semibold text-sm truncate">{col.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono flex-shrink-0 ${darkMode ? 'bg-black/20 text-gray-300' : 'bg-white/70 text-gray-600'}`}>
                        {colPhotos.length}{selCount > 0 && <span className="text-blue-400 ml-0.5">·{selCount}</span>}
                      </span>
                      {/* Indicateur + boutons de zoom */}
                      <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                        <button
                          onClick={() => setColZoom(prev => ({ ...prev, [col.id]: Math.min((prev[col.id] ?? 2) + 1, 4) }))}
                          title="Photos plus petites"
                          disabled={(colZoom[col.id] ?? 2) >= 4}
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-colors
                            ${(colZoom[col.id] ?? 2) >= 4
                              ? 'opacity-30 cursor-not-allowed'
                              : darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-white/80 text-gray-500'}`}
                        >−</button>
                        <span className={`text-[9px] font-mono w-3 text-center select-none ${subtext}`}>{colZoom[col.id] ?? 2}</span>
                        <button
                          onClick={() => setColZoom(prev => ({ ...prev, [col.id]: Math.max((prev[col.id] ?? 2) - 1, 1) }))}
                          title="Photos plus grandes"
                          disabled={(colZoom[col.id] ?? 2) <= 1}
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-colors
                            ${(colZoom[col.id] ?? 2) <= 1
                              ? 'opacity-30 cursor-not-allowed'
                              : darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-white/80 text-gray-500'}`}
                        >+</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {colPhotos.length > 0 && (
                        <button
                          onClick={() => downloadMultiple(colPhotos)}
                          disabled={downloading}
                          title="Telecharger toute la colonne"
                          className={`p-1 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-white text-gray-500'}`}
                        >
                          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {/* Bouton vue dossiers — toujours visible */}
                      <button
                        onClick={() => toggleFolderMode(col.id)}
                        title={isFolded ? 'Vue grille' : 'Vue dossiers'}
                        className={`p-1 rounded-lg transition-colors ${isFolded
                          ? 'text-amber-500 bg-amber-500/15 hover:bg-amber-500/25'
                          : darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-white text-gray-500'}`}
                      >
                        {isFolded ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Lasso overlay ── */}
                {lasso && lasso.colId === col.id && (() => {
                  const colEl  = colRefs.current[col.id];
                  const rect   = colEl ? colEl.getBoundingClientRect() : { left: 0, top: 0 };
                  const x      = Math.min(lasso.startX, lasso.curX) - rect.left;
                  const y      = Math.min(lasso.startY, lasso.curY) - rect.top;
                  const w      = Math.abs(lasso.curX - lasso.startX);
                  const h      = Math.abs(lasso.curY - lasso.startY);
                  return (
                    <div
                      className="absolute pointer-events-none z-20 rounded border border-blue-400 bg-blue-400/15"
                      style={{ left: x, top: y, width: w, height: h }}
                    />
                  );
                })()}

                {/* Zone de photos */}
                <div
                  className="flex-1 p-2 space-y-2 overflow-y-auto select-none"
                  onMouseDown={e => onZoneMouseDown(e, col.id)}
                >
                  {colPhotos.length === 0 ? (
                    <div className={[
                      'flex flex-col items-center justify-center py-10 gap-2 rounded-xl border-2 border-dashed transition-colors',
                      isFolderOver ? 'border-blue-400 bg-blue-50/30' : darkMode ? 'border-white/10' : 'border-gray-300',
                    ].join(' ')}>
                      {isFolderOver
                        ? <FolderOpen className="w-8 h-8 text-blue-400" />
                        : <ImageIcon  className={`w-8 h-8 ${subtext}`} />
                      }
                      <p className={`text-xs ${isFolderOver ? 'text-blue-400 font-medium' : subtext}`}>
                        {isFolderOver ? 'Deposer le dossier ici' : 'Deposer ici'}
                      </p>
                    </div>
                  ) : isFolded ? (
                    <>
                      {/* ── Dossiers tagués ── */}
                      {Object.entries(groups).map(([tagLabel, gPhotos]) => {
                        const isCollapsed    = collapsedFolders[col.id]?.has(tagLabel);
                        const isFolderBeingDragged = draggingFolder?.tagLabel === tagLabel && draggingFolder?.fromColId === col.id;
                        const [bName, ts]    = tagLabel.split(' \u2022 ');
                        const gSel           = gPhotos.filter(p => selectedPhotos[col.id]?.has(p.id)).length;
                        const allSelected    = gPhotos.length > 0 && gSel === gPhotos.length;
                        const someSelected   = gSel > 0 && !allSelected;
                        const coverPhotos    = gPhotos.slice(0, 3);

                        return (
                          <div
                            key={tagLabel}
                            data-folderid={tagLabel}
                            draggable
                            onDragStart={e => onFolderDragStart(e, tagLabel, col.id, gPhotos)}
                            onDragEnd={onFolderDragEnd}
                            className={[
                              'rounded-xl overflow-hidden border transition-all duration-150',
                              isFolderBeingDragged ? 'opacity-40 scale-95' : '',
                              darkMode ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-200 bg-amber-50/60',
                            ].join(' ')}
                          >
                            {/* En-tête du dossier */}
                            <div
                              className={[
                                'flex items-center gap-2 px-2.5 py-2.5 select-none',
                                'cursor-grab active:cursor-grabbing transition-colors',
                                darkMode ? 'hover:bg-amber-500/10' : 'hover:bg-amber-100/60',
                              ].join(' ')}
                              onClick={() => toggleFolder(col.id, tagLabel)}
                            >
                              {/* Checkbox dossier — sélectionne/désélectionne toutes les photos */}
                              <button
                                onClick={e => { e.stopPropagation(); toggleFolderSelection(col.id, gPhotos); }}                                title={allSelected ? 'Désélectionner le dossier' : 'Sélectionner le dossier'}
                                className={[
                                  'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                                  allSelected
                                    ? 'bg-blue-500 border-blue-500'
                                    : someSelected
                                      ? 'bg-blue-200 border-blue-400'
                                      : darkMode ? 'border-gray-500 bg-transparent hover:border-blue-400' : 'border-gray-300 bg-white hover:border-blue-400',
                                ].join(' ')}
                              >
                                {allSelected && <Check className="w-3 h-3 text-white" />}
                                {someSelected && <div className="w-2 h-0.5 bg-blue-500 rounded" />}
                              </button>
                              {/* Poignée de drag */}
                              <div className="flex-shrink-0 flex flex-col gap-[3px] opacity-40 mr-0.5">
                                <div className="flex gap-[3px]">
                                  <div className="w-[3px] h-[3px] rounded-full bg-current" />
                                  <div className="w-[3px] h-[3px] rounded-full bg-current" />
                                </div>
                                <div className="flex gap-[3px]">
                                  <div className="w-[3px] h-[3px] rounded-full bg-current" />
                                  <div className="w-[3px] h-[3px] rounded-full bg-current" />
                                </div>
                                <div className="flex gap-[3px]">
                                  <div className="w-[3px] h-[3px] rounded-full bg-current" />
                                  <div className="w-[3px] h-[3px] rounded-full bg-current" />
                                </div>
                              </div>
                              {isCollapsed
                                ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                                : <ChevronDown  className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                              }
                              <FolderOpen className="w-4 h-4 flex-shrink-0 text-amber-500" />
                              {/* Aperçu miniature des 3 premières photos */}
                              {isCollapsed && coverPhotos.length > 0 && (
                                <div className="flex -space-x-2 flex-shrink-0">
                                  {coverPhotos.map((p, i) => (
                                    <img
                                      key={p.id}
                                      src={p.image_url}
                                      alt=""
                                      className="w-6 h-6 rounded-md object-cover border-2 border-white shadow-sm"
                                      style={{ zIndex: coverPhotos.length - i }}
                                      draggable={false}
                                    />
                                  ))}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate">{bName}</p>
                                {ts && <p className={`text-[10px] ${subtext} truncate`}>{ts}</p>}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); downloadMultiple(gPhotos); }}
                                disabled={downloading}
                                className={`p-1 rounded-lg transition-colors flex-shrink-0 ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-amber-200 text-amber-700'}`}
                                title="Telecharger ce dossier"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono flex-shrink-0 ${darkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                                {gPhotos.length}{gSel > 0 && <span className="text-blue-400 ml-0.5">·{gSel}</span>}
                              </span>
                            </div>
                            {!isCollapsed && (
                              <div className={`grid ${gridCls} gap-1 p-1.5 pt-0`}>
                                {gPhotos.map(photo => renderCard(col.id, photo, gPhotos, true))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* ── Photos sans tag ── */}
                      {ungrouped.length > 0 && (
                        <div className={`rounded-xl overflow-hidden border ${darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white/40'}`}>
                          <div
                            className={`flex items-center gap-2 px-2.5 py-2 cursor-pointer transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-50'}`}
                            onClick={() => toggleFolder(col.id, '__ungrouped__')}
                          >
                            {collapsedFolders[col.id]?.has('__ungrouped__')
                              ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                              : <ChevronDown  className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                            }
                            <ImageIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                            <span className={`text-xs font-medium flex-1 ${subtext}`}>Sans tag</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${darkMode ? 'bg-black/20 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                              {ungrouped.length}
                            </span>
                          </div>
                          {!collapsedFolders[col.id]?.has('__ungrouped__') && (
                            <div className={`grid ${gridCls} gap-1 p-1.5 pt-0`}>
                              {ungrouped.map(photo => renderCard(col.id, photo, ungrouped))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    /* Vue grille simple */
                    <div className={`grid ${gridCls} gap-2`}>
                      {colPhotos.map(photo => renderCard(col.id, photo, colPhotos))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm" onClick={closeLightbox}>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <button onClick={closeLightbox} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              {lightbox.siblingPhotos.length > 1 && (
                <span className="text-sm text-gray-400">{lightbox.index + 1} / {lightbox.siblingPhotos.length}</span>
              )}
            </div>
            <div className="flex-1 mx-4 min-w-0 text-center">
              {lightbox.photo.game_tag && (
                <p className="text-sm text-gray-300 truncate">
                  {baseGameName(lightbox.photo.game_tag)}
                  {lightbox.photo.game_tag.includes(' \u2022 ') && (
                    <span className="text-gray-500 ml-2 text-xs">{lightbox.photo.game_tag.split(' \u2022 ')[1]}</span>
                  )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); downloadSingle(lightbox.photo); }}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                title="Telecharger"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setPendingDelete({ photos: [lightbox.photo] }); }}
                className="w-9 h-9 rounded-xl bg-red-500/70 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-16" onClick={e => e.stopPropagation()}>
            {lightbox.siblingPhotos.length > 1 && (
              <button onClick={() => lightboxNav(-1)} className="absolute left-3 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <img
              src={lightbox.photo.image_url}
              alt={lightbox.photo.game_tag || 'photo'}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-300"
              style={{ transform: `rotate(${lightbox.rotation}deg)`, maxHeight: 'calc(100vh - 160px)' }}
              draggable={false}
            />
            {lightbox.siblingPhotos.length > 1 && (
              <button onClick={() => lightboxNav(1)} className="absolute right-3 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 px-4 py-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => rotateLightbox(-90)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors">
              <RotateCcw className="w-4 h-4" /> Gauche
            </button>
            <span className="text-gray-500 text-xs font-mono w-10 text-center">{lightbox.rotation}°</span>
            <button onClick={() => rotateLightbox(90)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors">
              Droite <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modale suppression ── */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4 ${cardBg}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-base">Supprimer definitivement ?</h3>
                <p className={`text-sm mt-1 ${subtext}`}>
                  {pendingDelete.photos.length > 1
                    ? `${pendingDelete.photos.length} photos seront supprimees de Cloudinary et de la base de donnees.`
                    : 'Cette photo sera supprimee de Cloudinary et de la base de donnees.'
                  } Cette action est irreversible.
                </p>
              </div>
            </div>
            {pendingDelete.photos.length === 1 && (
              <img src={pendingDelete.photos[0].image_url} alt="" className="w-full h-32 object-cover rounded-xl" />
            )}
            {pendingDelete.photos.length > 1 && (
              <div className="flex gap-1 overflow-hidden rounded-xl">
                {pendingDelete.photos.slice(0, 4).map(p => <img key={p.id} src={p.image_url} alt="" className="flex-1 h-20 object-cover" />)}
                {pendingDelete.photos.length > 4 && (
                  <div className={`flex-1 h-20 flex items-center justify-center text-sm font-bold ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                    +{pendingDelete.photos.length - 4}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setPendingDelete(null)} className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${btnGhost}`}>
                Annuler
              </button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 text-white transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl font-medium text-sm flex items-center gap-2 max-w-sm text-center
          ${toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'success' ? 'bg-green-500 text-white' : darkMode ? 'bg-gray-700 text-white' : 'bg-gray-800 text-white'}`}>
          {toast.type === 'success' && <Check className="w-4 h-4 flex-shrink-0" />}
          {toast.type === 'error'   && <X     className="w-4 h-4 flex-shrink-0" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
