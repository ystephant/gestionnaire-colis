import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MigrationPage() {
  const [games, setGames] = useState([]);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const convertItem = (item) => {
    if (/^\d+\s+/.test(item)) {
      return { original: item, converted: item, changed: false };
    }

    let converted = item;
    let changed = false;

    let match = item.match(/^(.+?)\s*\((\d+)\)$/);
    if (match) {
      converted = `${match[2]} ${match[1].toLowerCase().trim()}`;
      changed = true;
      return { original: item, converted, changed };
    }

    match = item.match(/^(.+?):\s*(\d+)$/);
    if (match) {
      converted = `${match[2]} ${match[1].toLowerCase().trim()}`;
      changed = true;
      return { original: item, converted, changed };
    }

    match = item.match(/^(\d+)\s+(?:de\s+)?(.+)$/i);
    if (match) {
      converted = `${match[1]} ${match[2].toLowerCase().trim()}`;
      changed = item !== converted;
      return { original: item, converted, changed };
    }

    const numberWords = {
      'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
      'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
      'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15
    };
    
    for (const [word, num] of Object.entries(numberWords)) {
      const regex = new RegExp(`^${word}\\s+(.+)$`, 'i');
      match = item.match(regex);
      if (match) {
        converted = `${num} ${match[1].toLowerCase().trim()}`;
        changed = true;
        return { original: item, converted, changed };
      }
    }

    return { original: item, converted: item, changed: false };
  };

  const loadPreview = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const previewData = data.map(game => {
        const convertedItems = game.items.map(convertItem);
        const hasChanges = convertedItems.some(item => item.changed);
        
        return {
          id: game.id,
          name: game.name,
          original: game.items,
          converted: convertedItems.map(item => item.converted),
          details: convertedItems,
          hasChanges
        };
      });

      setGames(data);
      setPreview(previewData);
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeMigration = async () => {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir migrer tous les jeux ?\n\nCette action modifiera votre base de données.')) {
      return;
    }

    setMigrating(true);
    setError('');
    let migrated = 0;

    try {
      for (const game of preview) {
        if (game.hasChanges) {
          const { error } = await supabase
            .from('games')
            .update({ items: game.converted })
            .eq('id', game.id);

          if (error) throw error;
          migrated++;
        }
      }

      setSuccess(true);
      alert(`✅ Migration réussie !\n\n${migrated} jeu(x) ont été mis à jour.`);
    } catch (err) {
      setError(`❌ Erreur migration: ${err.message}`);
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, []);

  const totalChanges = preview.filter(g => g.hasChanges).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="animate-spin inline-block w-12 h-12 text-indigo-600 mb-4" />
          <div className="text-xl text-indigo-600">Analyse des données...</div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Migration réussie !</h2>
          <p className="text-gray-600 mb-6">Vos données ont été mises à jour avec succès.</p>
          <button
            onClick={() => window.location.href = '/inventaire'}
            className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition"
          >
            Retour à l'inventaire
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">🔧 Outil de Migration</h1>
              <p className="text-gray-600 mt-2">Convertit vos éléments au format "X nom" pour l'agrégation</p>
            </div>
            <button
              onClick={loadPreview}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Rafraîchir
            </button>
          </div>

          {error && (
            <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4 mb-4 flex items-start gap-3">
              <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="text-red-800">{error}</div>
            </div>
          )}

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-indigo-600">{preview.length}</div>
                <div className="text-sm text-gray-600">Jeux analysés</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600">{totalChanges}</div>
                <div className="text-sm text-gray-600">Jeux à modifier</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">
                  {preview.reduce((acc, g) => acc + g.details.filter(d => d.changed).length, 0)}
                </div>
                <div className="text-sm text-gray-600">Éléments convertis</div>
              </div>
            </div>
          </div>

          {totalChanges > 0 && (
            <button
              onClick={executeMigration}
              disabled={migrating}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition flex items-center justify-center gap-3 mb-6"
            >
              {migrating ? (
                <>
                  <RefreshCw className="animate-spin" size={24} />
                  Migration en cours...
                </>
              ) : (
                <>
                  <CheckCircle size={24} />
                  Appliquer la migration ({totalChanges} jeu{totalChanges > 1 ? 'x' : ''})
                </>
              )}
            </button>
          )}
        </div>

        <div className="space-y-4">
          {preview.map(game => (
            <div key={game.id} className={`bg-white rounded-xl shadow-lg p-6 ${game.hasChanges ? 'border-2 border-orange-300' : 'opacity-60'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{game.name}</h3>
                  <p className="text-sm text-gray-500">{game.details.length} éléments</p>
                </div>
                {game.hasChanges ? (
                  <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-semibold">
                    À modifier
                  </span>
                ) : (
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                    ✓ Déjà OK
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {game.details.map((item, idx) => (
                  <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg ${item.changed ? 'bg-orange-50 border-2 border-orange-200' : 'bg-gray-50'}`}>
                    {item.changed ? (
                      <>
                        <AlertCircle className="text-orange-600 flex-shrink-0" size={18} />
                        <div className="flex-1 flex items-center gap-3 flex-wrap">
                          <span className="text-gray-600 line-through">{item.original}</span>
                          <ArrowRight className="text-orange-600 flex-shrink-0" size={16} />
                          <span className="text-green-700 font-semibold">{item.converted}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="text-green-600 flex-shrink-0" size={18} />
                        <span className="text-gray-700">{item.original}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {preview.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Aucun jeu trouvé</h3>
            <p className="text-gray-600">Votre base de données est vide</p>
          </div>
        )}
      </div>
    </div>
  );
}
