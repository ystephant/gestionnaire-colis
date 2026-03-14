import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';
import {
  Upload, Tag, Trash2, X, Check, ChevronDown, ChevronRight,
  Image as ImageIcon, Loader2, Sun, Moon, LogOut, ArrowLeft,
  Folder, FolderOpen, Download, ZoomIn, Clipboard, Search,
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
    toastBg: '#f43f5e', // rose-500
  },
  {
    id: 'en_cours_de_vente', label: 'En cours de vente',
    lightBg: 'bg-emerald-50', lightBorder: 'border-emerald-200', lightHeader: 'bg-emerald-100/70',
    darkRgba: 'rgba(6,78,59,0.13)', darkBorderRgba: 'rgba(6,78,59,0.35)', darkHeaderRgba: 'rgba(6,78,59,0.20)',
    dot: 'bg-emerald-500',
    toastBg: '#10b981', // emerald-500
  },
  {
    id: 'en_vente', label: 'En vente',
    lightBg: 'bg-sky-50', lightBorder: 'border-sky-200', lightHeader: 'bg-sky-100/70',
    darkRgba: 'rgba(7,89,133,0.13)', darkBorderRgba: 'rgba(7,89,133,0.35)', darkHeaderRgba: 'rgba(7,89,133,0.20)',
    dot: 'bg-sky-400',
    toastBg: '#0ea5e9', // sky-500
  },
  {
    id: 'en_attente_reception', label: 'En attente reception',
    lightBg: 'bg-violet-50', lightBorder: 'border-violet-200', lightHeader: 'bg-violet-100/70',
    darkRgba: 'rgba(76,29,149,0.13)', darkBorderRgba: 'rgba(76,29,149,0.35)', darkHeaderRgba: 'rgba(76,29,149,0.20)',
    dot: 'bg-violet-400',
    toastBg: '#8b5cf6', // violet-500
  },
  {
    id: 'vendu', label: 'Vendu \u2713',
    lightBg: 'bg-red-50', lightBorder: 'border-red-200', lightHeader: 'bg-red-100/70',
    darkRgba: 'rgba(153,27,27,0.13)', darkBorderRgba: 'rgba(153,27,27,0.35)', darkHeaderRgba: 'rgba(153,27,27,0.20)',
    dot: 'bg-red-500',
    toastBg: '#ef4444', // red-500
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
  onToggleSelect, onCtrlSelect, onOpenLightbox, onDownloadSingle, onDeletePhoto, onCopyImage,
}) => {
  const rot        = photo.rotation || 0;
  const blobCache  = React.useRef(null); // { url, file } — pré-chargé au survol

  // Pré-charger le blob dès le survol pour l'avoir prêt au dragstart
  const handleMouseEnter = async () => {
    if (blobCache.current?.url === photo.image_url) return;
    try {
      const res  = await fetch(photo.image_url);
      const blob = await res.blob();
      const ext  = blob.type.includes('png') ? 'png' : 'jpg';
      const name = makeFilename(photo, 1, ext);
      blobCache.current = { url: photo.image_url, file: new File([blob], name, { type: blob.type }) };
    } catch { /* ignore */ }
  };

  const handleDragStart = (e) => {
    // Si le blob est prêt, on l'injecte comme vrai fichier — LeBonCoin/Vinted le reconnaît
    if (blobCache.current?.file) {
      try { e.dataTransfer.items.add(blobCache.current.file); } catch { /* ignore */ }
    }
    // Fallbacks
    try {
      const ext  = photo.image_url.includes('.png') ? 'png' : 'jpg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const name = makeFilename(photo, 1, ext);
      e.dataTransfer.setData('DownloadURL', `${mime}:${name}:${photo.image_url}`);
      e.dataTransfer.setData('text/uri-list', photo.image_url);
      e.dataTransfer.setData('text/plain', photo.image_url);
    } catch { /* ignore */ }
    e.dataTransfer.effectAllowed = 'copyMove';
    onDragStart(e, photo, columnId);
  };

  return (
    <div
      data-photoid={photo.id}
      data-colid={columnId}
      draggable
      onMouseEnter={handleMouseEnter}
      onDragStart={handleDragStart}
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
            onClick={e => { e.stopPropagation(); onCopyImage(photo, siblingPhotos || [photo]); }}
            className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
            title="Ouvrir dans une fenêtre (glisser vers LeBonCoin)"
          >
            <Clipboard className="w-3 h-3" />
          </button>
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
        <div className={`absolute inset-0 pointer-events-none transition-colors ${isSelected ? 'bg-blue-500/30' : 'bg-black/0 group-hover:bg-black/10'}`}>
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
  const [folderSearch, setFolderSearch]         = useState('');
  const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);
  // Onglet colonne actif sur mobile
  const [mobileCol, setMobileCol] = useState('pas_encore_en_vente');

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
  const colRefs    = useRef({});
  const headerRefs = useRef({}); // wheel uniquement sur le header
  const photosRef  = useRef({});  // miroir de photos pour les handlers globaux
  const lassoRef   = useRef(null); // miroir de lasso pour les handlers globaux
  const swipeTouchX = useRef(null); // swipe lightbox mobile

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

  // Wheel non-passif sur le header de colonne — ré-attaché aussi quand les photos chargent
  useEffect(() => {
    if (!isLoggedIn) return;
    const handlers = {};
    let attached = 0;
    COLUMNS.forEach(col => {
      const el = headerRefs.current[col.id];
      if (!el) return;
      const h = (e) => onColWheel(e, col.id);
      handlers[col.id] = h;
      el.addEventListener('wheel', h, { passive: false });
      attached++;
    });
    // Si aucun header n'était encore rendu, on planifie un ré-essai
    if (attached === 0) return;
    return () => {
      COLUMNS.forEach(col => {
        const el = headerRefs.current[col.id];
        if (el && handlers[col.id]) el.removeEventListener('wheel', handlers[col.id]);
      });
    };
  // photos en dep pour ré-attacher après le premier render des colonnes
  }, [onColWheel, isLoggedIn, photos]);

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

  // ── Realtime — synchronisation entre appareils ───────────────
  useEffect(() => {
    if (!isLoggedIn || !username) return;
    const channel = supabase
      .channel(`sale_photos:${username}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sale_photos',
        filter: `user_id=eq.${username}`,
      }, () => {
        // Recharger silencieusement sans toast ni reset de sélection
        supabase
          .from('sale_photos').select('*')
          .eq('user_id', username).order('position', { ascending: true })
          .then(({ data }) => {
            if (!data) return;
            const next = { pas_encore_en_vente:[], en_cours_de_vente:[], en_vente:[], en_attente_reception:[], vendu:[] };
            data.forEach(p => { if (next[p.status]) next[p.status].push(p); });
            setPhotos(next);
            // Replier les nouveaux dossiers apparus
            setCollapsedFolders(prev => {
              const updated = { ...prev };
              COLUMNS.forEach(col => {
                const tags = [...new Set((next[col.id] || []).filter(p => p.game_tag).map(p => p.game_tag))];
                const hasUngrouped = (next[col.id] || []).some(p => !p.game_tag);
                const allKeys = [...tags, ...(hasUngrouped ? ['__ungrouped__'] : [])];
                const existing = updated[col.id] || new Set();
                // Ajouter seulement les nouveaux tags pas encore connus
                const merged = new Set(existing);
                allKeys.forEach(k => { if (!existing.has || !existing.has(k)) merged.add(k); });
                updated[col.id] = merged;
              });
              return updated;
            });
          });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      // Replier tous les dossiers par défaut
      const collapsed = {};
      COLUMNS.forEach(col => {
        const tags = [...new Set((g[col.id] || []).filter(p => p.game_tag).map(p => p.game_tag))];
        const hasUngrouped = (g[col.id] || []).some(p => !p.game_tag);
        collapsed[col.id] = new Set([...tags, ...(hasUngrouped ? ['__ungrouped__'] : [])]);
      });
      setCollapsedFolders(collapsed);
    } catch { showToast('Erreur chargement photos', 'error'); }
  };

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
    } catch (e) { console.error(e); }
  };

  const showToast = useCallback((message, type = 'default', color = null) => {
    setToast({ message, type, color });
    setTimeout(() => setToast(null), 3500);
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
    e.dataTransfer.effectAllowed = 'copyMove';
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
      // Replier le dossier dans la colonne de destination
      setCollapsedFolders(prev => {
        const s = new Set(prev[toColumn] || []);
        s.add(tagLabel);
        return { ...prev, [toColumn]: s };
      });
      const destCol  = COLUMNS.find(c => c.id === toColumn);
      const destLabel = destCol ? destCol.label : toColumn;
      const toastColor = destCol ? destCol.toastBg : null;
      showToast(`"${tagLabel === '__ungrouped__' ? 'Sans tag' : baseGameName(tagLabel)}" déplacé vers "${destLabel}"`, 'success', toastColor);
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
    // Garder "__ungrouped__" replié dans la colonne de destination si des photos sans tag arrivent
    const hasUntaggedInMove = ptm.some(p => !p.game_tag);
    if (hasUntaggedInMove) {
      setCollapsedFolders(prev => {
        const s = new Set(prev[toColumn] || []);
        s.add('__ungrouped__');
        return { ...prev, [toColumn]: s };
      });
    }
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
    setShowTagDropdown(false);
    setSelectedPhotos(prev => {
      const s = new Set(prev[colId] || []);
      if (s.has(photoId)) s.delete(photoId); else s.add(photoId);
      return { ...prev, [colId]: s };
    });
  }, []);
  const onCtrlSelect = useCallback((colId, photoId) => {
    setShowTagDropdown(false);
    setSelectedPhotos(prev => {
      const s = new Set(prev[colId] || []);
      if (s.has(photoId)) s.delete(photoId); else s.add(photoId);
      return { ...prev, [colId]: s };
    });
  }, []);

  // Coche sur un dossier : sélectionne TOUTES ses photos (ou désélectionne si tout est déjà sélectionné)
  const toggleFolderSelection = useCallback((colId, folderPhotos) => {
    setShowTagDropdown(false);
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

    // Si le jeu n'existe pas encore, l'enregistrer dans transactions (type game_ref)
    // → disponible dans l'autocomplétion de transactions.js sans créer de nouvelle table
    if (!gamesList.includes(gameName)) {
      try {
        const { error: insertError } = await supabase.from('transactions').insert([{
          user_id: username,
          type: 'game_ref',
          game_name: gameName,
          price: 0,
          created_at: new Date().toISOString(),
        }]);
        if (insertError) {
          console.error('Erreur enregistrement jeu:', insertError);
          showToast(`Jeu non sauvegardé : ${insertError.message}`, 'error');
        } else {
          setGamesList(prev => [...prev, gameName].sort());
        }
      } catch (e) {
        console.error('Erreur enregistrement jeu:', e);
        showToast('Erreur lors de la sauvegarde du jeu', 'error');
      }
    }

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
    const rot = photo.rotation || 0;
    setLightbox({ photo, rotation: rot, displayRotation: rot, siblingPhotos, index });
  }, []);
  const closeLightbox = () => setLightbox(null);
  const lightboxNav = (dir) => {
    if (!lightbox) return;
    // Si des photos sont sélectionnées, naviguer dans la sélection globale
    const selPhotos = COLUMNS.flatMap(col => (photos[col.id] || []).filter(p => selectedPhotos[col.id]?.has(p.id)));
    const pool = selPhotos.length > 1 ? selPhotos : lightbox.siblingPhotos;
    const curIdx = pool.findIndex(p => p.id === lightbox.photo.id);
    const base = curIdx >= 0 ? curIdx : lightbox.index;
    const idx = ((base + dir) % pool.length + pool.length) % pool.length;
    const ph = pool[idx];
    setLightbox(prev => ({ ...prev, photo: ph, rotation: ph.rotation || 0, displayRotation: ph.rotation || 0, siblingPhotos: pool, index: idx }));
  };
  const rotateLightbox = async (dir) => {
    // displayRotation s'accumule sans modulo → la transition CSS ne revient jamais en arrière
    const newDisplay = (lightbox.displayRotation ?? lightbox.rotation ?? 0) + dir;
    const newRot = ((newDisplay % 360) + 360) % 360; // normalisé pour la DB
    setLightbox(prev => ({ ...prev, rotation: newRot, displayRotation: newDisplay }));
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

  // ── Popup de glisser-déposer vers LeBonCoin/Vinted ─────────
  const openPhotoPopup = useCallback((photo, siblings) => {
    const allPhotos = siblings && siblings.length > 0 ? siblings : [photo];
    const startIdx  = allPhotos.findIndex(p => p.id === photo.id);
    const idx       = startIdx < 0 ? 0 : startIdx;

    const w = 580, h = 630;
    const left = Math.round(window.screenX + (window.outerWidth  - w) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const popup = window.open('', '_blank',
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
    );
    if (!popup) { showToast('Autorise les popups pour cette page', 'error'); return; }

    const photosJson = JSON.stringify(allPhotos.map(p => ({
      url: p.image_url,
      name: (baseGameName(p.game_tag) || 'photo'),
    })));

    popup.document.write(`<!DOCTYPE html><html><head>
      <title>Photos — LeBonCoin / Vinted</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:#111;display:flex;flex-direction:column;height:100vh;font-family:sans-serif;overflow:hidden;user-select:none}
        #top{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#1a1a1a;flex-shrink:0}
        #counter{color:#888;font-size:12px;white-space:nowrap}
        #name{color:#fff;font-size:13px;font-weight:600;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:center}
        #imgWrap{flex:1;display:flex;align-items:center;justify-content:center;padding:10px;min-height:0}
        #mainImg{max-width:100%;max-height:100%;object-fit:contain;cursor:grab;border-radius:8px;display:block}
        #mainImg:active{cursor:grabbing}
        #bot{display:flex;align-items:center;gap:8px;padding:6px 12px;background:#1a1a1a;flex-shrink:0;border-top:1px solid #222}
        .navBtn{background:#2a2a2a;color:#ccc;border:1px solid #444;border-radius:8px;padding:5px 14px;font-size:13px;cursor:pointer;transition:background .15s;flex-shrink:0}
        .navBtn:hover:not(:disabled){background:#383838}
        .navBtn:disabled{opacity:.25;cursor:default}
        #hint{color:#555;font-size:11px;text-align:center;flex:1;line-height:1.4}
        #thumbsRow{display:flex;gap:5px;overflow-x:auto;padding:6px 10px;background:#161616;flex-shrink:0;border-top:1px solid #222;scrollbar-width:thin}
        .thumb{width:54px;height:54px;object-fit:cover;border-radius:6px;cursor:grab;border:2px solid transparent;flex-shrink:0;opacity:.5;transition:opacity .15s,border-color .15s}
        .thumb:hover{opacity:.85}
        .thumb:active{cursor:grabbing;opacity:1}
        .thumb.active{border-color:#3b82f6;opacity:1}
      </style>
    </head><body>
      <div id="top">
        <span id="counter"></span>
        <span id="name"></span>
      </div>
      <div id="imgWrap"><img id="mainImg" draggable="true" /></div>
      <div id="bot">
        <button class="navBtn" id="prev">&#8592;</button>
        <span id="hint">Glisse l'image principale<br>ou une miniature vers LeBonCoin · molette · ← →</span>
        <button class="navBtn" id="next">&#8594;</button>
      </div>
      <div id="thumbsRow"></div>
      <script>
        const photos = ${photosJson};
        let cur = ${idx};

        const mainImg  = document.getElementById('mainImg');
        const nameEl   = document.getElementById('name');
        const cntEl    = document.getElementById('counter');
        const prevBtn  = document.getElementById('prev');
        const nextBtn  = document.getElementById('next');
        const thumbsRow= document.getElementById('thumbsRow');

        function dragData(e, url, name) {
          const ext  = url.toLowerCase().includes('.png') ? 'png' : 'jpg';
          const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
          e.dataTransfer.effectAllowed = 'copy';
          try { e.dataTransfer.setData('DownloadURL', mime+':'+name+'.'+ext+':'+url); } catch(_){}
          try { e.dataTransfer.setData('text/uri-list', url); } catch(_){}
          try { e.dataTransfer.setData('text/plain',    url); } catch(_){}
        }

        function show(i) {
          cur = ((i % photos.length) + photos.length) % photos.length;
          const p = photos[cur];
          mainImg.src = p.url;
          mainImg.alt = p.name;
          nameEl.textContent = p.name;
          cntEl.textContent  = photos.length > 1 ? (cur+1)+' / '+photos.length : '';
          prevBtn.disabled   = photos.length <= 1;
          nextBtn.disabled   = photos.length <= 1;
          document.querySelectorAll('.thumb').forEach((t,j) => t.classList.toggle('active', j===cur));
          const active = thumbsRow.children[cur];
          if (active) active.scrollIntoView({block:'nearest',inline:'center'});
        }

        // Image principale
        mainImg.addEventListener('dragstart', e => dragData(e, photos[cur].url, photos[cur].name));

        // Miniatures — draggables et cliquables
        photos.forEach((p, i) => {
          const t = document.createElement('img');
          t.src = p.url; t.className = 'thumb'; t.draggable = true; t.title = p.name;
          t.addEventListener('click',     () => show(i));
          t.addEventListener('dragstart', e => { e.stopPropagation(); dragData(e, p.url, p.name); });
          thumbsRow.appendChild(t);
        });

        // Navigation clavier
        document.addEventListener('keydown', e => {
          if (e.key === 'ArrowLeft')  show(cur - 1);
          if (e.key === 'ArrowRight') show(cur + 1);
        });

        // Navigation molette
        document.addEventListener('wheel', e => {
          e.preventDefault();
          show(e.deltaY > 0 ? cur + 1 : cur - 1);
        }, { passive: false });

        prevBtn.addEventListener('click', () => show(cur - 1));
        nextBtn.addEventListener('click', () => show(cur + 1));

        show(cur);
      <\/script>
    </body></html>`);
    popup.document.close();
  }, [showToast]);

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
  const filteredGames = gamesList.filter(g => g.toLowerCase().includes(tagSearch.toLowerCase()));
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
    onCopyImage:      openPhotoPopup,
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
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-4 relative">
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => router.push('/')} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              <span className="font-bold text-base sm:text-lg">Suivi des photos</span>
            </div>
          </div>
          {/* Barre de recherche — desktop uniquement dans le header */}
          {(() => {
            const allGameNames = [...new Set(
              COLUMNS.flatMap(col => (photos[col.id] || []).map(p => baseGameName(p.game_tag)).filter(Boolean))
            )].sort();
            const suggestions = folderSearch.trim()
              ? allGameNames.filter(n => n.toLowerCase().includes(folderSearch.trim().toLowerCase()) && n.toLowerCase() !== folderSearch.trim().toLowerCase())
              : allGameNames;
            return (
              <div className="hidden sm:block fixed left-1/2 -translate-x-1/2 w-72 z-10">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Rechercher un jeu..."
                  value={folderSearch}
                  onChange={e => { setFolderSearch(e.target.value); setShowFolderSuggestions(true); }}
                  onFocus={() => setShowFolderSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowFolderSuggestions(false), 150)}
                  className={`w-full pl-9 pr-9 py-1.5 text-sm rounded-xl border outline-none transition-colors ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400 focus:border-blue-400'}`}
                />
                {folderSearch && (
                  <button onClick={() => { setFolderSearch(''); setShowFolderSuggestions(false); }} className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                    <X className="w-3 h-3" />
                  </button>
                )}
                {showFolderSuggestions && suggestions.length > 0 && (
                  <div className={`absolute top-full mt-1 left-0 right-0 rounded-xl border shadow-2xl overflow-hidden z-50 max-h-52 overflow-y-auto ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                    {suggestions.map(name => (
                      <button key={name} onMouseDown={() => { setFolderSearch(name); setShowFolderSuggestions(false); }}
                        className={`w-full text-left text-sm px-3 py-2.5 border-b last:border-0 ${darkMode ? 'hover:bg-gray-700 text-gray-200 border-gray-700' : 'hover:bg-blue-50 text-gray-700 border-gray-100'}`}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto">
            <button onClick={toggleDarkMode} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
              {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>
        {/* Barre de recherche mobile — sous le header */}
        {(() => {
          const allGameNames = [...new Set(
            COLUMNS.flatMap(col => (photos[col.id] || []).map(p => baseGameName(p.game_tag)).filter(Boolean))
          )].sort();
          const suggestions = folderSearch.trim()
            ? allGameNames.filter(n => n.toLowerCase().includes(folderSearch.trim().toLowerCase()) && n.toLowerCase() !== folderSearch.trim().toLowerCase())
            : allGameNames;
          return (
            <div className={`sm:hidden px-3 pb-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="relative mt-2">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <input
                  type="text"
                  placeholder="Rechercher un jeu..."
                  value={folderSearch}
                  onChange={e => { setFolderSearch(e.target.value); setShowFolderSuggestions(true); }}
                  onFocus={() => setShowFolderSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowFolderSuggestions(false), 150)}
                  className={`w-full pl-9 pr-9 py-2 text-sm rounded-xl border outline-none ${darkMode ? 'bg-gray-800 border-gray-600 text-gray-200 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-800 placeholder-gray-400'}`}
                />
                {folderSearch && (
                  <button onClick={() => { setFolderSearch(''); setShowFolderSuggestions(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                )}
                {showFolderSuggestions && suggestions.length > 0 && (
                  <div className={`absolute top-full mt-1 left-0 right-0 rounded-xl border shadow-2xl overflow-hidden z-50 max-h-48 overflow-y-auto ${darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}>
                    {suggestions.map(name => (
                      <button key={name} onMouseDown={() => { setFolderSearch(name); setShowFolderSuggestions(false); }}
                        className={`w-full text-left text-sm px-3 py-3 border-b last:border-0 ${darkMode ? 'hover:bg-gray-700 text-gray-200 border-gray-700' : 'hover:bg-blue-50 text-gray-700 border-gray-100'}`}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Barre flottante de sélection ── */}
      {selectMode && totalSelected > 0 && (
        <div className="sticky top-[57px] sm:top-[57px] z-20 flex justify-center px-2 sm:px-4 py-1.5 sm:py-2 pointer-events-none">
          <div className={`pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-2xl border ${cardBg} ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <span className={`text-xs sm:text-sm font-medium ${subtext}`}>{totalSelected}<span className="hidden sm:inline"> photo{totalSelected > 1 ? 's' : ''}</span></span>
            <div className={`w-px h-4 ${divider}`} />
            {/* Bouton Ouvrir — principal, jaune */}
            <button
              onClick={() => {
                const all = COLUMNS.flatMap(col => (photos[col.id] || []).filter(p => selectedPhotos[col.id]?.has(p.id)));
                if (all.length) openPhotoPopup(all[0], all);
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm bg-amber-400 hover:bg-amber-300 text-amber-900 shadow-md shadow-amber-400/30 transition-all"
              title="Ouvrir pour LeBonCoin / Vinted"
            >
              <Clipboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Ouvrir</span>
            </button>
            <div className={`w-px h-4 ${divider}`} />
            <button onClick={() => setSelectedPhotos({})} className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${btnGhost}`} title="Désélectionner tout">
              <span className="hidden sm:inline">Aucun</span>
              <X className="w-3.5 h-3.5 sm:hidden" />
            </button>
            <div className={`w-px h-4 ${divider}`} />
            <button
              onClick={downloadSelected} disabled={downloading}
              className={`flex items-center gap-1 sm:gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-colors ${btnGhost}`}
              title="Télécharger"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Télécharger</span>
            </button>
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1 sm:gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-lg font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
              title="Supprimer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Supprimer</span>
            </button>
            <div className={`w-px h-4 ${divider}`} />
            <button
              onClick={removeTag}
              className={`flex items-center gap-1 sm:gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-colors ${btnGhost}`}
              title="Retirer le tag"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Retirer tag</span>
            </button>
            {/* Dropdown tag */}
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(p => !p)}
                className="flex items-center gap-1 sm:gap-1.5 text-xs px-2 sm:px-3 py-1.5 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                title="Tagger"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tagger</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {showTagDropdown && (
                <div className={`absolute top-full mt-1 right-0 w-64 rounded-xl border shadow-2xl overflow-hidden z-50 ${cardBg} ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  <div className={`p-2 border-b ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
                    <input
                      autoFocus type="text" placeholder="Rechercher ou créer un tag..."
                      value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && tagSearch.trim()) assignTag(tagSearch.trim()); }}
                      className={`w-full text-sm px-3 py-1.5 rounded-lg border outline-none ${inputCls}`}
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {/* Option créer un nouveau tag si la saisie ne correspond à aucun jeu existant */}
                    {tagSearch.trim() && !gamesList.some(g => g.toLowerCase() === tagSearch.trim().toLowerCase()) && (
                      <button
                        onClick={() => assignTag(tagSearch.trim())}
                        className={`w-full text-left text-sm px-4 py-2.5 transition-colors border-b font-medium text-blue-500 ${darkMode ? 'hover:bg-gray-700 border-gray-700' : 'hover:bg-blue-50 border-gray-100'}`}
                      >
                        + Créer « {tagSearch.trim()} »
                      </button>
                    )}
                    {gamesList.length === 0 && !tagSearch.trim() && <p className={`text-sm px-4 py-3 ${subtext}`}>Chargement des jeux...</p>}
                    {filteredGames.map(game => (
                      <button
                        key={game} onClick={() => assignTag(game)}
                        className={`w-full text-left text-sm px-4 py-2.5 transition-colors border-b last:border-0 ${darkMode ? 'hover:bg-gray-700 text-gray-200 border-gray-700' : 'hover:bg-blue-50 text-gray-700 border-gray-100'}`}
                      >
                        {game}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 py-3 sm:py-6 space-y-3 sm:space-y-6">

        {/* ── Zone d'upload ── */}
        <div
          onDragOver={onDropZoneDragOver}
          onDragLeave={onDropZoneDragLeave}
          onDrop={onDropZoneDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-4 sm:p-8 text-center cursor-pointer transition-all duration-200
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

        {/* ── Onglets colonnes sur mobile — grille compacte, pas de scroll ── */}
        {(() => {
          const q = folderSearch.trim().toLowerCase();
          // Colonnes qui contiennent au moins un dossier correspondant à la recherche
          const matchingCols = q ? new Set(
            COLUMNS.filter(col =>
              (photos[col.id] || []).some(p => p.game_tag && baseGameName(p.game_tag).toLowerCase().includes(q))
            ).map(c => c.id)
          ) : new Set();

          return (
            <div className="sm:hidden grid grid-cols-5 gap-1">
              {COLUMNS.map(c => {
                const isActive  = mobileCol === c.id;
                const isMatch   = matchingCols.has(c.id);
                const isDragOver = dragOverColumn === c.id || dragOverFolderCol === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setMobileCol(c.id)}
                    onDragOver={e => { e.preventDefault(); onColumnDragOver(e, c.id); }}
                    onDrop={e => { onColumnDrop(e, c.id); setMobileCol(c.id); }}
                    onDragLeave={() => { setDragOverColumn(null); setDragOverFolderCol(null); }}
                    className={[
                      'flex flex-col items-center py-2 px-1 rounded-xl border cursor-pointer transition-all duration-150 select-none',
                      isActive ? 'border-blue-500 bg-blue-500/10' : '',
                      isDragOver ? 'border-blue-400 bg-blue-400/15 scale-105' : '',
                      isMatch && q && !isActive ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20' : '',
                      !isActive && !isDragOver && !isMatch ? (darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white') : '',
                    ].join(' ')}
                  >
                    <div className={`w-2 h-2 rounded-full mb-1 ${c.dot}`} />
                    <span className={`text-[10px] font-semibold text-center leading-tight ${isActive ? 'text-blue-500' : darkMode ? 'text-gray-400' : 'text-gray-600'}`} style={{fontSize:'9px'}}>
                      {c.label.replace('Pas encore en vente','Pas encore').replace('En cours de vente','En cours').replace('En attente reception','En attente').replace(' ✓','')}
                    </span>
                    {(photos[c.id] || []).length > 0 && (
                      <span className={`text-[9px] font-mono mt-0.5 ${isMatch && q ? 'text-blue-500 font-bold' : darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {photos[c.id].length}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── Kanban — 4 colonnes principales ── */}
        {(() => {
          const mainCols  = COLUMNS.filter(c => c.id !== 'vendu');
          const venduCol  = COLUMNS.find(c => c.id === 'vendu');
          const renderCol = (col) => {
            const colPhotos  = photos[col.id] || [];
            const isPhotoOver  = dragOverColumn === col.id;
            const isFolderOver = dragOverFolderCol === col.id;
            const isOver     = isPhotoOver || isFolderOver;
            const isFolded   = folderMode.has(col.id);
            const selCount   = selectedPhotos[col.id]?.size || 0;
            const { groups, ungrouped } = groupByTag(colPhotos);
            const zoom       = colZoom[col.id] ?? 2;
            const gridCls    = zoomGridCls(zoom);

            const isVendu = col.id === 'vendu';
            const qCol = folderSearch.trim().toLowerCase();
            const colHasMatch = qCol && (photos[col.id] || []).some(p => p.game_tag && baseGameName(p.game_tag).toLowerCase().includes(qCol));

            const colBgStyle     = isVendu ? {} : darkMode ? { backgroundColor: isOver
              ? col.darkRgba.replace('0.12','0.25').replace('0.13','0.25')
              : col.darkRgba } : {};
            const colBorderStyle = isVendu
              ? (darkMode ? { borderColor: 'transparent' } : {})
              : darkMode ? { borderColor: isOver ? '#60a5fa' : colHasMatch ? '#3b82f6' : col.darkBorderRgba } : {};
            const headerStyle    = darkMode ? { backgroundColor: colHasMatch ? 'rgba(59,130,246,0.15)' : col.darkHeaderRgba } : {};

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
                  colHasMatch && !darkMode && !isOver ? 'border-blue-300' : '',
                  !darkMode && !isVendu ? `${col.lightBg} ${(isOver || colHasMatch) ? 'border-blue-300' : col.lightBorder}` : '',
                  !darkMode && isVendu ? (isOver ? 'border-blue-300' : 'border-transparent') : '',
                  isFolderOver ? 'ring-2 ring-blue-400 ring-offset-1' : '',
                ].join(' ')}
                style={{ minHeight: '420px', position: 'relative', ...colBgStyle, ...(darkMode ? colBorderStyle : {}) }}
              >
                {/* En-tête de colonne */}
                <div
                  ref={el => { headerRefs.current[col.id] = el; }}
                  className={`px-3 py-2.5 rounded-t-2xl border-b ${darkMode ? 'border-white/10' : col.lightBorder} ${!darkMode ? (colHasMatch ? 'bg-blue-100/70' : col.lightHeader) : ''}`}
                  style={darkMode ? headerStyle : {}}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
                      <span className="font-semibold text-sm">{col.label}</span>
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

                        // Filtrage par recherche — masquer les non-matchés
                        const q = folderSearch.trim().toLowerCase();
                        const isMatch = !q || bName.toLowerCase().includes(q);
                        if (!isMatch) return null;

                        return (
                          <div
                            key={tagLabel}
                            data-folderid={tagLabel}
                            draggable
                            onDragStart={e => onFolderDragStart(e, tagLabel, col.id, gPhotos)}
                            onDragEnd={onFolderDragEnd}
                            className={[
                              'rounded-xl overflow-hidden border transition-all duration-200',
                              isFolderBeingDragged ? 'opacity-40 scale-95' : '',
                              isMatch && q
                                ? darkMode
                                  ? 'border-blue-400 bg-blue-500/15 shadow-lg shadow-blue-500/20 scale-[1.02]'
                                  : 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-200 scale-[1.02]'
                                : darkMode ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-200 bg-amber-50/60',
                            ].join(' ')}
                          >
                            {/* En-tête du dossier */}
                            <div
                              className={[
                                'flex items-start gap-2 px-2.5 py-2.5 select-none',
                                'cursor-grab active:cursor-grabbing transition-colors',
                                darkMode ? 'hover:bg-amber-500/10' : 'hover:bg-amber-100/60',
                              ].join(' ')}
                              onClick={() => toggleFolder(col.id, tagLabel)}
                            >
                              {/* Checkbox dossier */}
                              <button
                                onClick={e => { e.stopPropagation(); toggleFolderSelection(col.id, gPhotos); }}
                                title={allSelected ? 'Désélectionner le dossier' : 'Sélectionner le dossier'}
                                className={[
                                  'flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
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
                              <div className="flex-shrink-0 mt-0.5">
                                {isCollapsed
                                  ? <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
                                  : <ChevronDown  className="w-3.5 h-3.5 text-amber-500" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold leading-tight break-words">{bName}</p>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); openPhotoPopup(gPhotos[0], gPhotos); }}
                                className={`p-1 rounded-lg transition-colors flex-shrink-0 ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-amber-200 text-amber-700'}`}
                                title="Ouvrir le dossier pour glisser vers LeBonCoin"
                              >
                                <Clipboard className="w-3 h-3" />
                              </button>
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
                      {ungrouped.length > 0 && (() => {
                        const ugSel     = ungrouped.filter(p => selectedPhotos[col.id]?.has(p.id)).length;
                        const ugAll     = ungrouped.length > 0 && ugSel === ungrouped.length;
                        const ugSome    = ugSel > 0 && !ugAll;
                        const isUgDragging = draggingFolder?.tagLabel === '__ungrouped__' && draggingFolder?.fromColId === col.id;
                        return (
                          <div
                            draggable
                            data-folderid="__ungrouped__"
                            onDragStart={e => onFolderDragStart(e, '__ungrouped__', col.id, ungrouped)}
                            onDragEnd={onFolderDragEnd}
                            className={[
                              'rounded-xl overflow-hidden border transition-all duration-150',
                              isUgDragging ? 'opacity-40 scale-95' : '',
                              darkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white/40',
                            ].join(' ')}
                          >
                            <div
                              className={`flex items-center gap-2 px-2.5 py-2 cursor-grab active:cursor-grabbing transition-colors ${darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-50'}`}
                              onClick={() => toggleFolder(col.id, '__ungrouped__')}
                            >
                              {/* Checkbox */}
                              <button
                                onClick={e => { e.stopPropagation(); toggleFolderSelection(col.id, ungrouped); }}
                                title={ugAll ? 'Désélectionner' : 'Sélectionner tout'}
                                className={[
                                  'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                                  ugAll ? 'bg-blue-500 border-blue-500' : ugSome ? 'bg-blue-200 border-blue-400' : darkMode ? 'border-gray-500 bg-transparent hover:border-blue-400' : 'border-gray-300 bg-white hover:border-blue-400',
                                ].join(' ')}
                                onMouseDown={e => e.stopPropagation()}
                              >
                                {ugAll && <Check className="w-3 h-3 text-white" />}
                                {ugSome && <div className="w-2 h-0.5 bg-blue-500 rounded" />}
                              </button>
                              {collapsedFolders[col.id]?.has('__ungrouped__')
                                ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                                : <ChevronDown  className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                              }
                              <span className={`text-xs font-medium flex-1 ${subtext}`}>Sans tag</span>
                              <button
                                onClick={e => { e.stopPropagation(); openPhotoPopup(ungrouped[0], ungrouped); }}
                                className={`p-1 rounded-lg transition-colors flex-shrink-0 ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                                title="Ouvrir pour glisser vers LeBonCoin"
                                onMouseDown={e => e.stopPropagation()}
                              >
                                <Clipboard className="w-3 h-3" />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); downloadMultiple(ungrouped); }}
                                disabled={downloading}
                                className={`p-1 rounded-lg transition-colors flex-shrink-0 ${darkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                                title="Télécharger les photos sans tag"
                                onMouseDown={e => e.stopPropagation()}
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${darkMode ? 'bg-black/20 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                                {ungrouped.length}{ugSel > 0 && <span className="text-blue-400 ml-0.5">·{ugSel}</span>}
                              </span>
                            </div>
                            {!collapsedFolders[col.id]?.has('__ungrouped__') && (
                              <div className={`grid ${gridCls} gap-1 p-1.5 pt-0`}>
                                {ungrouped.map(photo => renderCard(col.id, photo, ungrouped, true))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
          }; // fin renderCol
          return (
            <>
              {/* Desktop : grille 4 cols + vendu en dessous */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {mainCols.map(col => renderCol(col))}
              </div>
              {/* Desktop : vendu pleine largeur */}
              <div className="hidden sm:block">
                {venduCol && (
                  <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className={`w-2 h-2 rounded-full ${venduCol.dot}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wide ${subtext}`}>{venduCol.label} — archives</span>
                    </div>
                    {renderCol(venduCol)}
                  </div>
                )}
              </div>
              {/* Mobile : colonne active uniquement */}
              <div className="sm:hidden">
                {renderCol(COLUMNS.find(c => c.id === mobileCol) || COLUMNS[0])}
              </div>
            </>
          );
        })()}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
          onClick={closeLightbox}
          onWheel={e => { e.preventDefault(); lightboxNav(e.deltaY > 0 ? 1 : -1); }}
        >
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
          <div className="flex-1 flex items-center justify-center relative min-h-0 px-10 sm:px-16"
            onClick={e => e.stopPropagation()}
            onTouchStart={e => { swipeTouchX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              if (swipeTouchX.current === null) return;
              const dx = e.changedTouches[0].clientX - swipeTouchX.current;
              swipeTouchX.current = null;
              if (Math.abs(dx) > 40) lightboxNav(dx < 0 ? 1 : -1);
            }}
          >
            {lightbox.siblingPhotos.length > 1 && (
              <button onClick={() => lightboxNav(-1)} className="absolute left-1 sm:left-3 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
            <img
              src={lightbox.photo.image_url}
              alt={lightbox.photo.game_tag || 'photo'}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-transform duration-300"
              style={{ transform: `rotate(${lightbox.displayRotation ?? lightbox.rotation}deg)`, maxHeight: 'calc(100vh - 160px)' }}
              draggable={false}
            />
            {lightbox.siblingPhotos.length > 1 && (
              <button onClick={() => lightboxNav(1)} className="absolute right-1 sm:right-3 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10">
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 rotate-180" />
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
                <h3 className="font-bold text-base">Supprimer définitivement ?</h3>
                <p className={`text-sm mt-1 ${subtext}`}>
                  {pendingDelete.photos.length > 1
                    ? `Ces ${pendingDelete.photos.length} photos seront supprimées et ne pourront pas être récupérées.`
                    : 'Cette photo sera supprimée et ne pourra pas être récupérée.'
                  }
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
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-xl font-medium text-sm flex items-center gap-2 max-w-sm text-center text-white transition-all"
          style={toast.color ? { backgroundColor: toast.color } : {}}
        >
          {!toast.color && (
            <span className={`absolute inset-0 rounded-xl ${toast.type === 'error' ? 'bg-red-500' : toast.type === 'success' ? 'bg-green-500' : darkMode ? 'bg-gray-700' : 'bg-gray-800'}`} />
          )}
          <span className="relative flex items-center gap-2">
            {toast.type === 'success' && <Check className="w-4 h-4 flex-shrink-0" />}
            {toast.type === 'error'   && <X     className="w-4 h-4 flex-shrink-0" />}
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
}
