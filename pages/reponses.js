import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../lib/ThemeContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_CATEGORIES = [
  { id: 'remerciement', label: 'Remerciement', color: 'blue' },
  { id: 'refus-offre', label: 'Réponse négative à une offre', color: 'red' },
  { id: 'acceptation-offre', label: 'Réponse positive à une offre', color: 'green' },
  { id: 'excuse', label: "Mot d'excuse", color: 'yellow' },
  { id: 'info-profil', label: 'Informations déjà présentes dans mon profil', color: 'purple' },
  { id: 'refus-prix', label: 'Mot de refus', color: 'orange' }
];

const COLORS = {
  blue: { 
    light: { bg: 'bg-blue-100', hover: 'hover:bg-blue-200', text: 'text-blue-900', button: 'bg-blue-500 hover:bg-blue-600', border: 'border-blue-300' },
    dark: { bg: 'bg-blue-900', hover: 'hover:bg-blue-800', text: 'text-blue-100', button: 'bg-blue-600 hover:bg-blue-700', border: 'border-blue-700' }
  },
  red: { 
    light: { bg: 'bg-red-100', hover: 'hover:bg-red-200', text: 'text-red-900', button: 'bg-red-500 hover:bg-red-600', border: 'border-red-300' },
    dark: { bg: 'bg-red-900', hover: 'hover:bg-red-800', text: 'text-red-100', button: 'bg-red-600 hover:bg-red-700', border: 'border-red-700' }
  },
  green: { 
    light: { bg: 'bg-green-100', hover: 'hover:bg-green-200', text: 'text-green-900', button: 'bg-green-500 hover:bg-green-600', border: 'border-green-300' },
    dark: { bg: 'bg-green-900', hover: 'hover:bg-green-800', text: 'text-green-100', button: 'bg-green-600 hover:bg-green-700', border: 'border-green-700' }
  },
  yellow: { 
    light: { bg: 'bg-yellow-100', hover: 'hover:bg-yellow-200', text: 'text-yellow-900', button: 'bg-yellow-500 hover:bg-yellow-600', border: 'border-yellow-300' },
    dark: { bg: 'bg-yellow-900', hover: 'hover:bg-yellow-800', text: 'text-yellow-100', button: 'bg-yellow-600 hover:bg-yellow-700', border: 'border-yellow-700' }
  },
  purple: { 
    light: { bg: 'bg-purple-100', hover: 'hover:bg-purple-200', text: 'text-purple-900', button: 'bg-purple-500 hover:bg-purple-600', border: 'border-purple-300' },
    dark: { bg: 'bg-purple-900', hover: 'hover:bg-purple-800', text: 'text-purple-100', button: 'bg-purple-600 hover:bg-purple-700', border: 'border-purple-700' }
  },
  orange: { 
    light: { bg: 'bg-orange-100', hover: 'hover:bg-orange-200', text: 'text-orange-900', button: 'bg-orange-500 hover:bg-orange-600', border: 'border-orange-300' },
    dark: { bg: 'bg-orange-900', hover: 'hover:bg-orange-800', text: 'text-orange-100', button: 'bg-orange-600 hover:bg-orange-700', border: 'border-orange-700' }
  },
  rose: { 
    light: { bg: 'bg-rose-100', hover: 'hover:bg-rose-200', text: 'text-rose-900', button: 'bg-rose-500 hover:bg-rose-600', border: 'border-rose-300' },
    dark: { bg: 'bg-rose-900', hover: 'hover:bg-rose-800', text: 'text-rose-100', button: 'bg-rose-600 hover:bg-rose-700', border: 'border-rose-700' }
  },
  pink: { 
    light: { bg: 'bg-pink-100', hover: 'hover:bg-pink-200', text: 'text-pink-900', button: 'bg-pink-500 hover:bg-pink-600', border: 'border-pink-300' },
    dark: { bg: 'bg-pink-900', hover: 'hover:bg-pink-800', text: 'text-pink-100', button: 'bg-pink-600 hover:bg-pink-700', border: 'border-pink-700' }
  },
  fuchsia: { 
    light: { bg: 'bg-fuchsia-100', hover: 'hover:bg-fuchsia-200', text: 'text-fuchsia-900', button: 'bg-fuchsia-500 hover:bg-fuchsia-600', border: 'border-fuchsia-300' },
    dark: { bg: 'bg-fuchsia-900', hover: 'hover:bg-fuchsia-800', text: 'text-fuchsia-100', button: 'bg-fuchsia-600 hover:bg-fuchsia-700', border: 'border-fuchsia-700' }
  },
  violet: { 
    light: { bg: 'bg-violet-100', hover: 'hover:bg-violet-200', text: 'text-violet-900', button: 'bg-violet-500 hover:bg-violet-600', border: 'border-violet-300' },
    dark: { bg: 'bg-violet-900', hover: 'hover:bg-violet-800', text: 'text-violet-100', button: 'bg-violet-600 hover:bg-violet-700', border: 'border-violet-700' }
  },
  indigo: { 
    light: { bg: 'bg-indigo-100', hover: 'hover:bg-indigo-200', text: 'text-indigo-900', button: 'bg-indigo-500 hover:bg-indigo-600', border: 'border-indigo-300' },
    dark: { bg: 'bg-indigo-900', hover: 'hover:bg-indigo-800', text: 'text-indigo-100', button: 'bg-indigo-600 hover:bg-indigo-700', border: 'border-indigo-700' }
  },
  sky: { 
    light: { bg: 'bg-sky-100', hover: 'hover:bg-sky-200', text: 'text-sky-900', button: 'bg-sky-500 hover:bg-sky-600', border: 'border-sky-300' },
    dark: { bg: 'bg-sky-900', hover: 'hover:bg-sky-800', text: 'text-sky-100', button: 'bg-sky-600 hover:bg-sky-700', border: 'border-sky-700' }
  },
  cyan: { 
    light: { bg: 'bg-cyan-100', hover: 'hover:bg-cyan-200', text: 'text-cyan-900', button: 'bg-cyan-500 hover:bg-cyan-600', border: 'border-cyan-300' },
    dark: { bg: 'bg-cyan-900', hover: 'hover:bg-cyan-800', text: 'text-cyan-100', button: 'bg-cyan-600 hover:bg-cyan-700', border: 'border-cyan-700' }
  },
  teal: { 
    light: { bg: 'bg-teal-100', hover: 'hover:bg-teal-200', text: 'text-teal-900', button: 'bg-teal-500 hover:bg-teal-600', border: 'border-teal-300' },
    dark: { bg: 'bg-teal-900', hover: 'hover:bg-teal-800', text: 'text-teal-100', button: 'bg-teal-600 hover:bg-teal-700', border: 'border-teal-700' }
  },
  emerald: { 
    light: { bg: 'bg-emerald-100', hover: 'hover:bg-emerald-200', text: 'text-emerald-900', button: 'bg-emerald-500 hover:bg-emerald-600', border: 'border-emerald-300' },
    dark: { bg: 'bg-emerald-900', hover: 'hover:bg-emerald-800', text: 'text-emerald-100', button: 'bg-emerald-600 hover:bg-emerald-700', border: 'border-emerald-700' }
  },
  lime: { 
    light: { bg: 'bg-lime-100', hover: 'hover:bg-lime-200', text: 'text-lime-900', button: 'bg-lime-500 hover:bg-lime-600', border: 'border-lime-300' },
    dark: { bg: 'bg-lime-900', hover: 'hover:bg-lime-800', text: 'text-lime-100', button: 'bg-lime-600 hover:bg-lime-700', border: 'border-lime-700' }
  },
  amber: { 
    light: { bg: 'bg-amber-100', hover: 'hover:bg-amber-200', text: 'text-amber-900', button: 'bg-amber-500 hover:bg-amber-600', border: 'border-amber-300' },
    dark: { bg: 'bg-amber-900', hover: 'hover:bg-amber-800', text: 'text-amber-100', button: 'bg-amber-600 hover:bg-amber-700', border: 'border-amber-700' }
  },
  slate: { 
    light: { bg: 'bg-slate-100', hover: 'hover:bg-slate-200', text: 'text-slate-900', button: 'bg-slate-500 hover:bg-slate-600', border: 'border-slate-300' },
    dark: { bg: 'bg-slate-900', hover: 'hover:bg-slate-800', text: 'text-slate-100', button: 'bg-slate-600 hover:bg-slate-700', border: 'border-slate-700' }
  }
};

// Normalise un texte pour la recherche (minuscules, sans accents)
const normalize = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Détermine où tomberait une réponse lâchée aux coordonnées (x, y) :
// { categoryId, beforeId } — beforeId = id de la réponse devant laquelle insérer (null = à la fin)
const computeDropTarget = (x, y, draggedId) => {
  const el = document.elementFromPoint(x, y);
  const zone = el && el.closest ? el.closest('[data-category-zone]') : null;
  if (!zone) return null;

  const categoryId = zone.getAttribute('data-category-zone');
  let beforeId = null;

  const row = el.closest('[data-responses-row]');
  if (row) {
    const cards = row.querySelectorAll('[data-response-id]');
    for (const card of cards) {
      const id = card.getAttribute('data-response-id');
      if (id === String(draggedId)) continue;
      const rect = card.getBoundingClientRect();
      if (x < rect.left + rect.width / 2) {
        beforeId = id;
        break;
      }
    }
  }

  return { categoryId, beforeId };
};

export default function ReponsesPrefaites() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme(); // Utilisation du contexte
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [reponses, setReponses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [addingCategory, setAddingCategory] = useState(null);
  const [newResponseText, setNewResponseText] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const reponsesRef = useRef([]);
  const dragRef = useRef(null);
  const ghostRef = useRef(null);
  const justDraggedRef = useRef(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryLabel, setEditCategoryLabel] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('blue');
  const [collapsedCategories, setCollapsedCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [colorPickerId, setColorPickerId] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [deleteMode, setDeleteMode] = useState('move');
  const [moveTarget, setMoveTarget] = useState('');

  reponsesRef.current = reponses;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      loadReponses();
      loadCategoryOrder();
    }
  }, [isLoggedIn]);

  const checkAuth = () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setIsLoggedIn(true);
    } else {
      router.push('/');
    }
    setLoading(false);
  };

  const loadCategoryOrder = async () => {
    // Catégories de base + renommages + catégories personnalisées (Supabase)
    let merged = [...DEFAULT_CATEGORIES];
    try {
      const { data, error } = await supabase
        .from('reponses_categories')
        .select('*')
        .eq('user_id', username)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const deletedIds = [];
      (data || []).forEach(row => {
        const idx = merged.findIndex(c => c.id === row.cat_id);
        if (row.deleted) {
          deletedIds.push(row.cat_id);
        } else if (idx !== -1) {
          merged[idx] = {
            ...merged[idx],
            label: row.label,
            color: COLORS[row.color] ? row.color : merged[idx].color
          };
        } else {
          merged.push({ id: row.cat_id, label: row.label, color: COLORS[row.color] ? row.color : 'blue' });
        }
      });
      merged = merged.filter(c => !deletedIds.includes(c.id));
    } catch (e) {
      console.error('Erreur de chargement des catégories:', e);
    }

    // Ordre enregistré (localStorage)
    const saved = localStorage.getItem(`categoryOrder_${username}`);
    if (saved) {
      try {
        const order = JSON.parse(saved);
        const orderedCategories = order.map(id => merged.find(c => c.id === id)).filter(Boolean);
        const remaining = merged.filter(c => !order.includes(c.id));
        merged = [...orderedCategories, ...remaining];
      } catch (e) {
        console.error('Erreur de chargement de l\'ordre:', e);
      }
    }
    setCategories(merged);

    // Catégories repliées (mémorisé sur cet appareil)
    try {
      const collapsed = JSON.parse(localStorage.getItem(`categoriesCollapsed_${username}`) || '[]');
      setCollapsedCategories(Array.isArray(collapsed) ? collapsed : []);
    } catch (e) {
      console.error('Erreur de chargement des catégories repliées:', e);
    }
  };

  const saveCategoryOrder = (newOrder) => {
    localStorage.setItem(`categoryOrder_${username}`, JSON.stringify(newOrder.map(c => c.id)));
  };

  const toggleCollapse = (categoryId) => {
    const newCollapsed = collapsedCategories.includes(categoryId)
      ? collapsedCategories.filter(id => id !== categoryId)
      : [...collapsedCategories, categoryId];
    setCollapsedCategories(newCollapsed);
    localStorage.setItem(`categoriesCollapsed_${username}`, JSON.stringify(newCollapsed));
  };

  const changerCouleur = async (category, colorKey) => {
    if (colorKey === category.color) {
      setColorPickerId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('reponses_categories')
        .upsert(
          { user_id: username, cat_id: category.id, label: category.label, color: colorKey },
          { onConflict: 'user_id,cat_id' }
        );

      if (error) throw error;

      setCategories(categories.map(c => c.id === category.id ? { ...c, color: colorKey } : c));
      setColorPickerId(null);
    } catch (error) {
      console.error('Erreur de changement de couleur:', error);
      alert('Impossible de changer la couleur. La table reponses_categories existe-t-elle bien dans Supabase ?');
    }
  };

  const ouvrirSuppressionCategorie = (category) => {
    const autres = categories.filter(c => c.id !== category.id);
    setDeletingCategory(category);
    setDeleteMode('move');
    setMoveTarget(autres.length > 0 ? autres[0].id : '');
  };

  const confirmerSuppressionCategorie = async () => {
    const category = deletingCategory;
    if (!category) return;

    const catReponses = reponses.filter(r => r.category === category.id);
    if (catReponses.length > 0 && deleteMode === 'move' && !moveTarget) return;

    try {
      let newReponses = reponses;

      if (catReponses.length > 0) {
        if (deleteMode === 'move') {
          const targetPositions = reponses.filter(r => r.category === moveTarget).map(r => r.position || 0);
          const startPos = targetPositions.length > 0 ? Math.max(...targetPositions) : 0;

          const results = await Promise.all(
            catReponses.map((r, i) =>
              supabase
                .from('reponses')
                .update({ category: moveTarget, position: startPos + i + 1 })
                .eq('id', r.id)
            )
          );
          const failed = results.find(res => res.error);
          if (failed) throw failed.error;

          newReponses = reponses.map(r => {
            const i = catReponses.findIndex(c => c.id === r.id);
            return i !== -1 ? { ...r, category: moveTarget, position: startPos + i + 1 } : r;
          });
        } else {
          const { error } = await supabase
            .from('reponses')
            .delete()
            .eq('user_id', username)
            .eq('category', category.id);

          if (error) throw error;
          newReponses = reponses.filter(r => r.category !== category.id);
        }
      }

      if (DEFAULT_CATEGORIES.some(c => c.id === category.id)) {
        const { error } = await supabase
          .from('reponses_categories')
          .upsert(
            { user_id: username, cat_id: category.id, label: category.label, color: category.color, deleted: true },
            { onConflict: 'user_id,cat_id' }
          );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reponses_categories')
          .delete()
          .eq('user_id', username)
          .eq('cat_id', category.id);
        if (error) throw error;
      }

      const newCategories = categories.filter(c => c.id !== category.id);
      setReponses(newReponses);
      setCategories(newCategories);
      saveCategoryOrder(newCategories);
      setDeletingCategory(null);
    } catch (error) {
      console.error('Erreur de suppression de catégorie:', error);
      alert('Impossible de supprimer la catégorie.');
      loadReponses();
    }
  };

  const dupliquerReponse = async (reponse) => {
    try {
      const { data, error } = await supabase
        .from('reponses')
        .insert([{
          user_id: username,
          category: reponse.category,
          text: reponse.text,
          position: 0
        }])
        .select();

      if (error) throw error;

      const copie = data[0];
      const sorted = reponses
        .filter(r => r.category === reponse.category)
        .sort((a, b) => (a.position || 0) - (b.position || 0));
      const idx = sorted.findIndex(r => r.id === reponse.id);
      const newOrder = [...sorted];
      newOrder.splice(idx + 1, 0, copie);

      await Promise.all(
        newOrder.map((r, i) =>
          supabase.from('reponses').update({ position: i }).eq('id', r.id)
        )
      );

      const updated = reponses.map(r => {
        const newPos = newOrder.findIndex(nr => nr.id === r.id);
        return newPos !== -1 ? { ...r, position: newPos } : r;
      });
      setReponses([...updated, { ...copie, position: newOrder.findIndex(nr => nr.id === copie.id) }]);

      // La copie s'ouvre directement en modification
      setEditingId(copie.id);
      setEditText(copie.text);
    } catch (error) {
      console.error('Erreur de duplication:', error);
    }
  };

  const annulerRenommage = () => {
    setEditingCategoryId(null);
    setEditCategoryLabel('');
  };

  const renommerCategorie = async (category) => {
    const newLabel = editCategoryLabel.trim();
    if (!newLabel || newLabel === category.label) {
      annulerRenommage();
      return;
    }

    try {
      const { error } = await supabase
        .from('reponses_categories')
        .upsert(
          { user_id: username, cat_id: category.id, label: newLabel, color: category.color },
          { onConflict: 'user_id,cat_id' }
        );

      if (error) throw error;

      setCategories(categories.map(c => c.id === category.id ? { ...c, label: newLabel } : c));
      annulerRenommage();
    } catch (error) {
      console.error('Erreur de renommage:', error);
      alert('Impossible de renommer la catégorie. La table reponses_categories existe-t-elle bien dans Supabase ?');
    }
  };

  const creerCategorie = async () => {
    const label = newCategoryLabel.trim();
    if (!label) return;

    if (categories.some(c => c.label.toLowerCase() === label.toLowerCase())) {
      alert('Une catégorie porte déjà ce nom.');
      return;
    }

    const catId = `custom-${Date.now()}`;

    try {
      const { error } = await supabase
        .from('reponses_categories')
        .insert([{ user_id: username, cat_id: catId, label: label, color: newCategoryColor }]);

      if (error) throw error;

      const newCategories = [...categories, { id: catId, label: label, color: newCategoryColor }];
      setCategories(newCategories);
      saveCategoryOrder(newCategories);
      setNewCategoryLabel('');
      setNewCategoryColor('blue');
      setShowNewCategory(false);
    } catch (error) {
      console.error('Erreur de création de catégorie:', error);
      alert('Impossible de créer la catégorie. La table reponses_categories existe-t-elle bien dans Supabase ?');
    }
  };

  const loadReponses = async () => {
    try {
      const { data, error } = await supabase
        .from('reponses')
        .select('*')
        .eq('user_id', username)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setReponses(data || []);
    } catch (error) {
      console.error('Erreur de chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const ajouterReponse = async (category) => {
    if (!newResponseText.trim()) return;

    try {
      const categoryReponses = reponses.filter(r => r.category === category);
      const maxPosition = categoryReponses.length > 0 
        ? Math.max(...categoryReponses.map(r => r.position || 0))
        : 0;

      const { data, error } = await supabase
        .from('reponses')
        .insert([{
          user_id: username,
          category: category,
          text: newResponseText.trim(),
          position: maxPosition + 1
        }])
        .select();

      if (error) throw error;

      setReponses([...reponses, ...data]);
      setNewResponseText('');
      setAddingCategory(null);
    } catch (error) {
      console.error('Erreur d\'ajout:', error);
    }
  };

  const modifierReponse = async (id) => {
    if (!editText.trim()) return;

    try {
      const { error } = await supabase
        .from('reponses')
        .update({ text: editText.trim() })
        .eq('id', id);

      if (error) throw error;

      setReponses(reponses.map(r => r.id === id ? { ...r, text: editText.trim() } : r));
      setEditingId(null);
      setEditText('');
    } catch (error) {
      console.error('Erreur de modification:', error);
    }
  };

  const supprimerReponse = async (id) => {
    if (!confirm('Supprimer cette réponse ?')) return;

    try {
      const { error } = await supabase
        .from('reponses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReponses(reponses.filter(r => r.id !== id));
    } catch (error) {
      console.error('Erreur de suppression:', error);
    }
  };

  const copierReponse = (text) => {
    navigator.clipboard.writeText(text);
    setCopyMessage('✓ Copié !');
    setTimeout(() => setCopyMessage(''), 3000);
  };

  const startEdit = (id, text) => {
    setEditingId(id);
    setEditText(text);
  };

  const handleCategoryDragStart = (e, category) => {
    if (dragRef.current) {
      e.preventDefault();
      return;
    }
    setDraggedCategory(category);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCategoryDrop = (e, targetCategory) => {
    e.preventDefault();
    
    if (!draggedCategory || draggedCategory.id === targetCategory.id) {
      setDraggedCategory(null);
      return;
    }

    const newCategories = [...categories];
    const draggedIndex = newCategories.findIndex(c => c.id === draggedCategory.id);
    const targetIndex = newCategories.findIndex(c => c.id === targetCategory.id);

    newCategories.splice(draggedIndex, 1);
    newCategories.splice(targetIndex, 0, draggedCategory);

    setCategories(newCategories);
    saveCategoryOrder(newCategories);
    setDraggedCategory(null);
  };

  // Déplace une réponse (même catégorie ou autre catégorie) à la position voulue
  const deplacerReponse = async (dragged, targetCategoryId, beforeId) => {
    const byPos = (x, y) => (x.position || 0) - (y.position || 0);
    const current = reponsesRef.current;

    const sourceList = current.filter(r => r.category === dragged.category).sort(byPos);
    const targetList = current
      .filter(r => r.category === targetCategoryId && r.id !== dragged.id)
      .sort(byPos);

    let idx = beforeId !== null ? targetList.findIndex(r => String(r.id) === beforeId) : targetList.length;
    if (idx === -1) idx = targetList.length;

    const newTarget = [...targetList];
    newTarget.splice(idx, 0, dragged);

    // Rien à faire si la réponse reste exactement à la même place
    if (dragged.category === targetCategoryId) {
      const identique = sourceList.length === newTarget.length && sourceList.every((r, i) => r.id === newTarget[i].id);
      if (identique) return;
    }

    const positions = new Map(newTarget.map((r, i) => [r.id, i]));
    setReponses(prev => prev.map(r =>
      positions.has(r.id) ? { ...r, category: targetCategoryId, position: positions.get(r.id) } : r
    ));

    try {
      const results = await Promise.all(
        newTarget.map((r, i) => {
          const update = r.id === dragged.id ? { category: targetCategoryId, position: i } : { position: i };
          return supabase.from('reponses').update(update).eq('id', r.id);
        })
      );
      const failed = results.find(res => res.error);
      if (failed) throw failed.error;
    } catch (error) {
      console.error('Erreur de déplacement:', error);
      loadReponses();
    }
  };

  // Démarre un glisser-déposer : souris (n'importe où sur la carte) ou doigt (via la poignée)
  const handleResponsePointerDown = (e, reponse, colors) => {
    if (editingId === reponse.id) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (dragRef.current) return;

    const onHandle = !!(e.target.closest && e.target.closest('[data-drag-handle]'));
    if (!onHandle) {
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest && e.target.closest('button, textarea, input')) return;
    }

    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      started: false,
      target: null,
      scrollTimer: null
    };
    dragRef.current = drag;

    const moveGhost = () => {
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${drag.x - drag.offsetX}px, ${drag.y - drag.offsetY}px)`;
      }
    };

    const updateTarget = () => {
      const t = computeDropTarget(drag.x, drag.y, reponse.id);
      drag.target = t;
      setDropTarget(prev => {
        if (!prev && !t) return prev;
        if (prev && t && prev.categoryId === t.categoryId && prev.beforeId === t.beforeId) return prev;
        return t;
      });
    };

    // Défilement automatique près des bords (page et ligne de réponses)
    const autoScroll = () => {
      const edge = 80;
      let scrolled = false;

      if (drag.y < edge) {
        window.scrollBy(0, -Math.round(4 + ((edge - drag.y) / edge) * 14));
        scrolled = true;
      } else if (drag.y > window.innerHeight - edge) {
        window.scrollBy(0, Math.round(4 + ((drag.y - (window.innerHeight - edge)) / edge) * 14));
        scrolled = true;
      }

      const el = document.elementFromPoint(drag.x, drag.y);
      const row = el && el.closest ? el.closest('[data-responses-row]') : null;
      if (row) {
        const r = row.getBoundingClientRect();
        if (drag.x < r.left + 50) {
          row.scrollLeft -= 12;
          scrolled = true;
        } else if (drag.x > r.right - 50) {
          row.scrollLeft += 12;
          scrolled = true;
        }
      }

      if (scrolled) updateTarget();
    };

    const onMove = (ev) => {
      if (ev.pointerId !== drag.pointerId) return;
      drag.x = ev.clientX;
      drag.y = ev.clientY;

      if (!drag.started) {
        if (Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 6) return;
        drag.started = true;
        justDraggedRef.current = true;
        document.body.style.userSelect = 'none';
        document.body.style.webkitUserSelect = 'none';
        document.body.style.cursor = 'grabbing';
        setDragState({ id: reponse.id, text: reponse.text, width: drag.width, colors });
        drag.scrollTimer = setInterval(autoScroll, 16);
      }

      if (ev.cancelable) ev.preventDefault();
      moveGhost();
      updateTarget();
    };

    const finish = (cancelled) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (drag.scrollTimer) clearInterval(drag.scrollTimer);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.cursor = '';

      const wasStarted = drag.started;
      const target = drag.target;
      dragRef.current = null;
      setDragState(null);
      setDropTarget(null);

      if (wasStarted) {
        // Empêche le clic "copier" juste après un glisser
        setTimeout(() => { justDraggedRef.current = false; }, 150);
        if (!cancelled && target) {
          deplacerReponse(reponse, target.categoryId, target.beforeId);
        }
      }
    };

    const onUp = (ev) => {
      if (ev.pointerId !== drag.pointerId) return;
      finish(false);
    };
    const onCancel = (ev) => {
      if (ev.pointerId !== drag.pointerId) return;
      finish(true);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const theme = darkMode ? 'dark' : 'light';

  const searchActive = searchQuery.trim() !== '';
  const matchesSearch = (text) => normalize(text).includes(normalize(searchQuery.trim()));
  const totalMatches = searchActive ? reponses.filter(r => matchesSearch(r.text)).length : 0;

  const highlightText = (text) => {
    const q = normalize(searchQuery.trim());
    if (!q) return text;

    let norm = '';
    const map = [];
    for (let i = 0; i < text.length; i++) {
      const n = normalize(text[i]);
      for (let k = 0; k < n.length; k++) {
        norm += n[k];
        map.push(i);
      }
    }

    const parts = [];
    let last = 0;
    let key = 0;
    let idx = norm.indexOf(q);
    while (idx !== -1) {
      const start = map[idx];
      const end = map[idx + q.length - 1] + 1;
      if (start >= last) {
        parts.push(text.slice(last, start));
        parts.push(
          <mark key={key++} className="bg-yellow-300 text-gray-900 rounded px-0.5">
            {text.slice(start, end)}
          </mark>
        );
        last = end;
      }
      idx = norm.indexOf(q, idx + q.length);
    }
    parts.push(text.slice(last));
    return parts;
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} flex items-center justify-center`}>
        <div className={`text-xl ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Chargement...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-slate-100'} py-4 px-3 sm:py-8 sm:px-4 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto">
        {copyMessage && (
          <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-2xl font-bold text-base z-50 animate-bounce">
            {copyMessage}
          </div>
        )}

        {/* Carte qui suit le curseur pendant un glisser-déposer */}
        {dragState && (
          <div
            ref={ghostRef}
            className={`fixed top-0 left-0 pointer-events-none ${dragState.colors.bg} border-2 ${dragState.colors.border} rounded-lg p-3 shadow-2xl opacity-90 max-h-32 overflow-hidden`}
            style={{
              zIndex: 60,
              width: dragState.width,
              transform: `translate(${dragRef.current ? dragRef.current.x - dragRef.current.offsetX : 0}px, ${dragRef.current ? dragRef.current.y - dragRef.current.offsetY : 0}px)`
            }}
          >
            <p className={`${dragState.colors.text} text-sm whitespace-pre-wrap break-words`}>
              {dragState.text}
            </p>
          </div>
        )}

        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-3 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => router.push('/')}
                className={`${darkMode ? 'text-gray-400 hover:text-indigo-400 hover:bg-gray-700' : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-100'} p-2 rounded-lg transition flex-shrink-0`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-indigo-600 p-2 sm:p-3 rounded-xl flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className={`text-lg sm:text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} leading-tight`}>Réponses Préfaites</h1>
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} hidden sm:block`}>Cliquez sur une réponse pour copier • Glissez-déposez pour réorganiser</p>
              </div>
            </div>
            
            {/* Toggle Dark Mode */}
            <button
              onClick={toggleDarkMode}
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

        {/* Recherche */}
        <div className="sticky top-2 z-40 mb-3 sm:mb-4">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2 transition-colors duration-300`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
              placeholder="Rechercher une réponse (ex : vendu)..."
              className={`flex-1 min-w-0 bg-transparent focus:outline-none text-sm ${
                darkMode ? 'text-gray-100 placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
              }`}
            />
            {searchActive && (
              <>
                <span className={`text-xs whitespace-nowrap ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {totalMatches} résultat{totalMatches > 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className={`p-1 rounded-lg text-xs transition ${
                    darkMode ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                  title="Effacer la recherche"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>

        {/* Lignes de catégories */}
        <div className="space-y-3 sm:space-y-4">
          {categories.map(category => {
            const allCategoryReponses = reponses
              .filter(r => r.category === category.id)
              .sort((a, b) => (a.position || 0) - (b.position || 0));
            const categoryReponses = searchActive
              ? allCategoryReponses.filter(r => matchesSearch(r.text))
              : allCategoryReponses;
            if (searchActive && categoryReponses.length === 0) return null;
            const isCollapsed = !searchActive && collapsedCategories.includes(category.id);
            const colors = COLORS[category.color][theme];

            return (
              <div 
                key={category.id}
                data-category-zone={category.id}
                draggable={editingCategoryId !== category.id}
                onDragStart={(e) => handleCategoryDragStart(e, category)}
                onDragOver={handleCategoryDragOver}
                onDrop={(e) => handleCategoryDrop(e, category)}
                className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-3 sm:p-4 cursor-move hover:shadow-xl transition-all duration-300 ${
                  draggedCategory?.id === category.id ? 'opacity-50' : ''
                } ${dragState && dropTarget && dropTarget.categoryId === category.id ? 'ring-2 ring-indigo-400' : ''}`}
              >
                {/* Mobile: vertical layout. Desktop: horizontal layout */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                  {/* Colonne titre */}
                  <div className="w-full sm:w-48 lg:w-64 sm:flex-shrink-0">
                    <div className={`${colors.bg} rounded-lg p-3 sm:p-4 transition-colors duration-300`}>
                      <div className={`flex items-center gap-2 ${isCollapsed ? '' : 'mb-2 sm:mb-3'}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="3" y1="12" x2="21" y2="12"></line>
                          <line x1="3" y1="6" x2="21" y2="6"></line>
                          <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                        {editingCategoryId === category.id ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editCategoryLabel}
                              onChange={(e) => setEditCategoryLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') renommerCategorie(category);
                                if (e.key === 'Escape') annulerRenommage();
                              }}
                              className={`flex-1 min-w-0 px-2 py-1 border-2 rounded-lg text-sm focus:border-indigo-500 focus:outline-none ${
                                darkMode
                                  ? 'bg-gray-700 border-gray-600 text-gray-100'
                                  : 'bg-white border-gray-200 text-gray-900'
                              }`}
                              autoFocus
                            />
                            <button
                              onClick={() => renommerCategorie(category)}
                              className="bg-indigo-600 text-white px-2 py-1 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
                              title="Valider"
                            >
                              ✓
                            </button>
                            <button
                              onClick={annulerRenommage}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold transition ${
                                darkMode
                                  ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                              }`}
                              title="Annuler"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <h2 className={`text-sm font-bold ${colors.text} flex-1 min-w-0 break-words`}>
                              {category.label}
                            </h2>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${colors.text} ${darkMode ? 'bg-black/30' : 'bg-white/60'}`}>
                              {allCategoryReponses.length}
                            </span>
                            <button
                              onClick={() => toggleCollapse(category.id)}
                              className={`p-1.5 -m-1 rounded-lg transition ${colors.text} opacity-70 hover:opacity-100`}
                              title={isCollapsed ? 'Déplier' : 'Replier'}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                      {!isCollapsed && (
                      <>
                      <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setAddingCategory(category.id)}
                        className={`flex-1 ${colors.button} text-white py-2 rounded-lg font-semibold transition text-xs flex items-center justify-center gap-1`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Ajouter
                      </button>
                      <button
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setEditCategoryLabel(category.label);
                        }}
                        className={`p-2 rounded-lg transition ${colors.text} opacity-60 hover:opacity-100 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                        title="Renommer la catégorie"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => setColorPickerId(colorPickerId === category.id ? null : category.id)}
                        className={`p-2 rounded-lg transition ${colors.text} opacity-60 hover:opacity-100 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                        title="Changer la couleur"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                        </svg>
                      </button>
                      {categories.length > 1 && (
                        <button
                          onClick={() => ouvrirSuppressionCategorie(category)}
                          className={`p-2 rounded-lg transition ${colors.text} opacity-60 hover:opacity-100 ${darkMode ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}
                          title="Supprimer la catégorie"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      )}
                      </div>
                      {colorPickerId === category.id && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {Object.keys(COLORS).map(colorKey => (
                            <button
                              key={colorKey}
                              onClick={() => changerCouleur(category, colorKey)}
                              className={`${COLORS[colorKey].light.button.split(' ')[0]} w-7 h-7 rounded-full transition ${
                                category.color === colorKey ? 'ring-2 ring-offset-2 ring-indigo-500' : ''
                              }`}
                              title={colorKey}
                            />
                          ))}
                        </div>
                      )}
                      </>
                      )}
                    </div>
                  </div>

                  {/* Colonnes de réponses */}
                  {!isCollapsed && (
                  <div data-responses-row className="flex-1 overflow-x-auto">
                    <div className="flex gap-2 sm:gap-3 pb-2 min-w-min">
                      {/* Formulaire d'ajout */}
                      {addingCategory === category.id && (
                        <div className={`${colors.bg} border-2 ${colors.border} rounded-lg p-3 w-56 sm:w-72 flex-shrink-0 transition-colors duration-300`}>
                          <textarea
                            value={newResponseText}
                            onChange={(e) => setNewResponseText(e.target.value)}
                            placeholder="Tapez votre réponse..."
                            rows="4"
                            className={`w-full px-3 py-2 border-2 rounded-lg focus:border-indigo-500 focus:outline-none text-sm mb-2 resize-none transition-colors duration-300 ${
                              darkMode 
                                ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' 
                                : 'bg-white border-gray-200 text-gray-900'
                            }`}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => ajouterReponse(category.id)}
                              className="flex-1 bg-indigo-600 text-white py-1.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-xs"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => {
                                setAddingCategory(null);
                                setNewResponseText('');
                              }}
                              className={`flex-1 py-1.5 rounded-lg font-semibold transition text-xs ${
                                darkMode 
                                  ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' 
                                  : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                              }`}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Réponses existantes */}
                      {categoryReponses.map(reponse => (
                        <div 
                          key={reponse.id} 
                          data-response-id={reponse.id}
                          className="relative w-56 sm:w-72 flex-shrink-0"
                          onPointerDown={(e) => handleResponsePointerDown(e, reponse, colors)}
                        >
                          {dragState && dropTarget && dropTarget.categoryId === category.id && dropTarget.beforeId === String(reponse.id) && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 rounded-full z-10" />
                          )}
                          {editingId === reponse.id ? (
                            <div className={`${colors.bg} border-2 ${colors.border} rounded-lg p-3 h-full transition-colors duration-300`}>
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows="4"
                                className={`w-full px-3 py-2 border-2 rounded-lg focus:border-indigo-500 focus:outline-none text-sm mb-2 resize-none transition-colors duration-300 ${
                                  darkMode 
                                    ? 'bg-gray-700 border-gray-600 text-gray-100' 
                                    : 'bg-white border-gray-200 text-gray-900'
                                }`}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => modifierReponse(reponse.id)}
                                  className="flex-1 bg-indigo-600 text-white py-1.5 rounded-lg font-semibold hover:bg-indigo-700 transition text-xs"
                                >
                                  OK
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditText('');
                                  }}
                                  className={`flex-1 py-1.5 rounded-lg font-semibold transition text-xs ${
                                    darkMode 
                                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500' 
                                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                                  }`}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={`relative group h-full ${dragState && dragState.id === reponse.id ? 'opacity-40' : ''}`}>
                              <div
                                onClick={() => {
                                  if (justDraggedRef.current) return;
                                  copierReponse(reponse.text);
                                }}
                                className={`${colors.bg} border-2 ${colors.border} rounded-lg p-3 pt-9 sm:pt-3 cursor-pointer ${colors.hover} transition-all duration-300 h-full min-h-[100px] sm:min-h-[120px] flex items-center`}
                              >
                                <p className={`${colors.text} text-sm whitespace-pre-wrap break-words`}>
                                  {highlightText(reponse.text)}
                                </p>
                              </div>
                              <div
                                data-drag-handle
                                onClick={(e) => e.stopPropagation()}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{ touchAction: 'none' }}
                                className={`absolute top-2 left-2 p-2 sm:p-1.5 rounded-lg shadow-lg cursor-grab select-none sm:opacity-0 sm:group-hover:opacity-100 transition ${
                                  darkMode ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-500'
                                }`}
                                title="Glisser pour déplacer"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="9" cy="6" r="1.8"></circle>
                                  <circle cx="15" cy="6" r="1.8"></circle>
                                  <circle cx="9" cy="12" r="1.8"></circle>
                                  <circle cx="15" cy="12" r="1.8"></circle>
                                  <circle cx="9" cy="18" r="1.8"></circle>
                                  <circle cx="15" cy="18" r="1.8"></circle>
                                </svg>
                              </div>
                              <div className="absolute top-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEdit(reponse.id, reponse.text);
                                  }}
                                  className={`p-1.5 rounded-lg shadow-lg transition ${
                                    darkMode 
                                      ? 'bg-gray-700 hover:bg-gray-600' 
                                      : 'bg-white hover:bg-gray-100'
                                  }`}
                                  title="Modifier"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dupliquerReponse(reponse);
                                  }}
                                  className={`p-1.5 rounded-lg shadow-lg transition ${
                                    darkMode 
                                      ? 'bg-gray-700 hover:bg-gray-600' 
                                      : 'bg-white hover:bg-gray-100'
                                  }`}
                                  title="Dupliquer"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    supprimerReponse(reponse.id);
                                  }}
                                  className={`p-1.5 rounded-lg shadow-lg transition ${
                                    darkMode 
                                      ? 'bg-gray-700 hover:bg-red-900' 
                                      : 'bg-white hover:bg-red-100'
                                  }`}
                                  title="Supprimer"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="red" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {dragState && dropTarget && dropTarget.categoryId === category.id && dropTarget.beforeId === null && (
                        <div className="w-24 sm:w-32 flex-shrink-0 min-h-[100px] sm:min-h-[120px] rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-500/10" />
                      )}

                      {categoryReponses.length === 0 && addingCategory !== category.id && (
                        <div className="w-56 sm:w-72 flex-shrink-0 flex items-center justify-center">
                          <p className={`text-sm italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            Aucune réponse
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            );
          })}

          {searchActive && totalMatches === 0 && (
            <div className={`${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'} rounded-xl shadow-lg p-8 text-center text-sm`}>
              Aucune réponse ne contient « {searchQuery.trim()} »
            </div>
          )}
        </div>

        {/* Nouvelle catégorie */}
        <div className={`mt-3 sm:mt-4 ${searchActive ? 'hidden' : ''}`}>
          {showNewCategory ? (
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-3 sm:p-4 transition-colors duration-300`}>
              <input
                type="text"
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') creerCategorie();
                  if (e.key === 'Escape') {
                    setShowNewCategory(false);
                    setNewCategoryLabel('');
                  }
                }}
                placeholder="Nom de la nouvelle catégorie..."
                className={`w-full px-3 py-2 border-2 rounded-lg focus:border-indigo-500 focus:outline-none text-sm mb-3 transition-colors duration-300 ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
                autoFocus
              />
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Couleur :</span>
                {Object.keys(COLORS).map(colorKey => (
                  <button
                    key={colorKey}
                    onClick={() => setNewCategoryColor(colorKey)}
                    className={`${COLORS[colorKey].light.button.split(' ')[0]} w-7 h-7 rounded-full transition ${
                      newCategoryColor === colorKey ? 'ring-2 ring-offset-2 ring-indigo-500' : ''
                    }`}
                    title={colorKey}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={creerCategorie}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition text-sm"
                >
                  Créer la catégorie
                </button>
                <button
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryLabel('');
                  }}
                  className={`flex-1 py-2 rounded-lg font-semibold transition text-sm ${
                    darkMode
                      ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCategory(true)}
              className={`w-full py-3 rounded-xl font-semibold text-sm border-2 border-dashed transition ${
                darkMode
                  ? 'border-gray-600 text-gray-400 hover:border-indigo-500 hover:text-indigo-400'
                  : 'border-gray-300 text-gray-500 hover:border-indigo-500 hover:text-indigo-600'
              }`}
            >
              + Nouvelle catégorie
            </button>
          )}
        </div>

        {/* Fenêtre de suppression de catégorie */}
        {deletingCategory && (() => {
          const count = reponses.filter(r => r.category === deletingCategory.id).length;
          const autres = categories.filter(c => c.id !== deletingCategory.id);
          const optionClass = (selected) => `block rounded-xl border-2 p-3 cursor-pointer transition ${
            selected
              ? (darkMode ? 'border-indigo-400 bg-indigo-900/30' : 'border-indigo-500 bg-indigo-50')
              : (darkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300')
          }`;
          const textMain = darkMode ? 'text-gray-100' : 'text-gray-800';
          const textSub = darkMode ? 'text-gray-400' : 'text-gray-500';

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
              onClick={() => setDeletingCategory(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6`}
              >
                <h3 className={`text-lg font-bold mb-1 ${textMain}`}>
                  Supprimer « {deletingCategory.label} » ?
                </h3>

                {count === 0 ? (
                  <p className={`text-sm mb-5 ${textSub}`}>Cette catégorie est vide.</p>
                ) : (
                  <>
                    <p className={`text-sm mb-4 ${textSub}`}>
                      Elle contient {count} réponse{count > 1 ? 's' : ''}. Que souhaitez-vous en faire ?
                    </p>
                    <div className="space-y-2 mb-5">
                      {autres.length > 0 && (
                        <label className={optionClass(deleteMode === 'move')}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="deleteMode"
                              checked={deleteMode === 'move'}
                              onChange={() => setDeleteMode('move')}
                              className="text-indigo-600"
                            />
                            <span className={`text-sm font-semibold ${textMain}`}>Les déplacer vers une autre catégorie</span>
                          </div>
                          {deleteMode === 'move' && (
                            <select
                              value={moveTarget}
                              onChange={(e) => setMoveTarget(e.target.value)}
                              className={`mt-2 w-full px-3 py-2 border-2 rounded-lg text-sm focus:border-indigo-500 focus:outline-none ${
                                darkMode
                                  ? 'bg-gray-700 border-gray-600 text-gray-100'
                                  : 'bg-white border-gray-200 text-gray-900'
                              }`}
                            >
                              {autres.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </select>
                          )}
                        </label>
                      )}
                      <label className={optionClass(deleteMode === 'delete')}>
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="deleteMode"
                            checked={deleteMode === 'delete'}
                            onChange={() => setDeleteMode('delete')}
                            className="text-red-600"
                          />
                          <span className={`text-sm font-semibold ${textMain}`}>
                            Les supprimer définitivement
                          </span>
                        </div>
                      </label>
                    </div>
                  </>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setDeletingCategory(null)}
                    className={`flex-1 py-2.5 rounded-xl font-semibold transition text-sm ${
                      darkMode
                        ? 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmerSuppressionCategorie}
                    className="flex-1 py-2.5 rounded-xl font-semibold transition text-sm bg-red-600 text-white hover:bg-red-700"
                  >
                    {count > 0 && deleteMode === 'move'
                      ? 'Déplacer et supprimer'
                      : count > 0
                        ? `Supprimer avec ${count} réponse${count > 1 ? 's' : ''}`
                        : 'Supprimer'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}