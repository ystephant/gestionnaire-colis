import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

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
  blue: { bg: 'bg-blue-100', hover: 'hover:bg-blue-200', text: 'text-blue-900', button: 'bg-blue-500 hover:bg-blue-600', border: 'border-blue-300' },
  red: { bg: 'bg-red-100', hover: 'hover:bg-red-200', text: 'text-red-900', button: 'bg-red-500 hover:bg-red-600', border: 'border-red-300' },
  green: { bg: 'bg-green-100', hover: 'hover:bg-green-200', text: 'text-green-900', button: 'bg-green-500 hover:bg-green-600', border: 'border-green-300' },
  yellow: { bg: 'bg-yellow-100', hover: 'hover:bg-yellow-200', text: 'text-yellow-900', button: 'bg-yellow-500 hover:bg-yellow-600', border: 'border-yellow-300' },
  purple: { bg: 'bg-purple-100', hover: 'hover:bg-purple-200', text: 'text-purple-900', button: 'bg-purple-500 hover:bg-purple-600', border: 'border-purple-300' },
  orange: { bg: 'bg-orange-100', hover: 'hover:bg-orange-200', text: 'text-orange-900', button: 'bg-orange-500 hover:bg-orange-600', border: 'border-orange-300' }
};

export default function ReponsesPrefaites() {
  const router = useRouter();
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

  const loadCategoryOrder = () => {
    const saved = localStorage.getItem(`categoryOrder_${username}`);
    if (saved) {
      try {
        const order = JSON.parse(saved);
        const orderedCategories = order.map(id => DEFAULT_CATEGORIES.find(c => c.id === id)).filter(Boolean);
        setCategories(orderedCategories);
      } catch (e) {
        console.error('Erreur de chargement de l\'ordre:', e);
      }
    }
  };

  const saveCategoryOrder = (newOrder) => {
    localStorage.setItem(`categoryOrder_${username}`, JSON.stringify(newOrder.map(c => c.id)));
  };

  const loadReponses = async () => {
    try {
      const { data, error } = await supabase
        .from('reponses')
        .select('*')
        .eq('user_id', username)
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
      const { data, error } = await supabase
        .from('reponses')
        .insert([{
          user_id: username,
          category: category,
          text: newResponseText.trim()
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
    setTimeout(() => setCopyMessage(''), 2000);
  };

  const startEdit = (id, text) => {
    setEditingId(id);
    setEditText(text);
  };

  const handleDragStart = (e, category) => {
    setDraggedCategory(category);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetCategory) => {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl text-indigo-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-indigo-600 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-indigo-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Réponses Préfaites</h1>
                <p className="text-sm text-gray-500">Cliquez sur une réponse pour la copier • Glissez-déposez pour réorganiser</p>
              </div>
            </div>
            {copyMessage && (
              <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg font-semibold animate-pulse">
                {copyMessage}
              </div>
            )}
          </div>
        </div>

        {/* Lignes de catégories */}
        <div className="space-y-4">
          {categories.map(category => {
            const categoryReponses = reponses.filter(r => r.category === category.id);
            const colors = COLORS[category.color];

            return (
              <div 
                key={category.id}
                draggable
                onDragStart={(e) => handleDragStart(e, category)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, category)}
                className={`bg-white rounded-xl shadow-lg p-4 cursor-move hover:shadow-xl transition ${
                  draggedCategory?.id === category.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Colonne titre (gauche) */}
                  <div className="w-64 flex-shrink-0">
                    <div className={`${colors.bg} rounded-lg p-4 h-full`}>
                      <div className="flex items-center gap-2 mb-3">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="3" y1="12" x2="21" y2="12"></line>
                          <line x1="3" y1="6" x2="21" y2="6"></line>
                          <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                        <h2 className={`text-sm font-bold ${colors.text}`}>
                          {category.label}
                        </h2>
                      </div>
                      <button
                        onClick={() => setAddingCategory(category.id)}
                        className={`w-full ${colors.button} text-white py-2 rounded-lg font-semibold transition text-xs flex items-center justify-center gap-1`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Ajouter
                      </button>
                    </div>
                  </div>

                  {/* Colonnes de réponses (droite) */}
                  <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
                    {/* Formulaire d'ajout */}
                    {addingCategory === category.id && (
                      <div className={`${colors.bg} border-2 ${colors.border} rounded-lg p-3 w-72 flex-shrink-0`}>
                        <textarea
                          value={newResponseText}
                          onChange={(e) => setNewResponseText(e.target.value)}
                          placeholder="Tapez votre réponse..."
                          rows="4"
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm mb-2 resize-none"
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
                            className="flex-1 bg-gray-300 text-gray-700 py-1.5 rounded-lg font-semibold hover:bg-gray-400 transition text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Réponses existantes */}
                    {categoryReponses.map(reponse => (
                      <div key={reponse.id} className="w-72 flex-shrink-0">
                        {editingId === reponse.id ? (
                          // Mode édition
                          <div className={`${colors.bg} border-2 ${colors.border} rounded-lg p-3 h-full`}>
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              rows="4"
                              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none text-sm mb-2 resize-none"
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
                                className="flex-1 bg-gray-300 text-gray-700 py-1.5 rounded-lg font-semibold hover:bg-gray-400 transition text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Mode affichage
                          <div className="relative group h-full">
                            <div
                              onClick={() => copierReponse(reponse.text)}
                              className={`${colors.bg} border-2 ${colors.border} rounded-lg p-3 cursor-pointer ${colors.hover} transition h-full min-h-[120px] flex items-center`}
                            >
                              <p className={`${colors.text} text-sm whitespace-pre-wrap break-words`}>
                                {reponse.text}
                              </p>
                            </div>
                            {/* Boutons d'action */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(reponse.id, reponse.text);
                                }}
                                className="bg-white p-1.5 rounded-lg shadow-lg hover:bg-gray-100 transition"
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
                                  supprimerReponse(reponse.id);
                                }}
                                className="bg-white p-1.5 rounded-lg shadow-lg hover:bg-red-100 transition"
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

                    {/* Message si vide */}
                    {categoryReponses.length === 0 && addingCategory !== category.id && (
                      <div className="w-72 flex-shrink-0 flex items-center justify-center">
                        <p className="text-gray-400 text-sm italic">
                          Aucune réponse
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
