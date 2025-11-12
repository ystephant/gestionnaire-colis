import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function GenerateurAnnonces() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  // États pour le formulaire
  const [nomJeu, setNomJeu] = useState('');
  const [prefixSociete, setPrefixSociete] = useState(true);
  const [etatMateriel, setEtatMateriel] = useState('Bon état');
  const [blister, setBlister] = useState('Non');
  const [complet, setComplet] = useState('Complet');
  const [reglesFr, setReglesFr] = useState(true);
  const [rayures, setRayures] = useState('Bon état');
  const [aspectSecondaire, setAspectSecondaire] = useState(false);
  const [rayures2, setRayures2] = useState('Bon état');
  const [lot, setLot] = useState('Non');
  const [vintedInfo, setVintedInfo] = useState(true);
  const [noHand, setNoHand] = useState(false);
  const [preferShipping, setPreferShipping] = useState(false);
  const [elementsManquants, setElementsManquants] = useState('');
  const [description, setDescription] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  const etatOptions = [
    "Bon état", "Boîte usée un peu partout", "Comme neuf", "Correct avec marques d'usage",
    "État moyen, mais jouable", "Joué une fois, en très bon état",
    "Neuf, n'a jamais servi, encore un paquet de cartes sous blister.",
    "Neuf, n'a jamais servi, toutes les cartes sont sous blister.",
    "Très bon état", "Traces d'usure visibles", "Traces d'usure"
  ].sort();

  const rayuresOptions = [
    "Bon état", "Très bon état", "Coin inférieur droit abîmé", "Coin inférieur droit enfoncé",
    "Coin inférieur gauche abîmé", "Coin inférieur gauche enfoncé", "Coin supérieur droit abîmé",
    "Coin supérieur droit enfoncé", "Coin supérieur gauche abîmé", "Coin supérieur gauche enfoncé",
    "Coins abîmés", "Coins légèrement usés", "Pas de rayures, état parfait",
    "Quelques rayures superficielles", "Rayures visibles sur la boîte", "Traces d'usure"
  ].sort();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    genererDescription();
  }, [nomJeu, prefixSociete, etatMateriel, blister, complet, reglesFr, rayures, aspectSecondaire, rayures2, lot, vintedInfo, noHand, preferShipping, elementsManquants]);

  const checkAuth = () => {
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    
    if (savedUsername && savedPassword) {
      setIsLoggedIn(true);
    } else {
      router.push('/');
    }
    setLoading(false);
  };

  const genererDescription = () => {
    let desc = '';

    if (prefixSociete) {
      desc += `Jeu de société ${nomJeu}\n`;
    } else {
      desc += `${nomJeu}\n`;
    }

    if (blister === 'Oui - Neuf sous blister') {
      desc += 'Neuf, encore sous blister.\n';
    } else {
      desc += `État du matériel : ${etatMateriel}\n`;
      desc += `Aspect extérieur de la boîte : ${rayures}`;
      if (aspectSecondaire && rayures2) {
        desc += `, ${rayures2}`;
      }
      desc += '.\n';

      if (complet === 'Complet') {
        let contenu = 'Complet';
        if (reglesFr) {
          contenu += ' avec règles du jeu en français.';
        }
        desc += contenu + '\n';
      } else if (complet === 'Incomplet') {
        const manquants = elementsManquants.trim();
        if (manquants) {
          desc += `Incomplet : ${manquants}\n`;
        } else {
          desc += 'Incomplet\n';
        }
      }
    }

    if (vintedInfo) {
      desc += '\n🚩 Pas d\'envoi par Vinted GO.';
      desc += '\n✨ Toutes les infos concernant mes ventes (prix, envois, offres…) sont déjà précisées sur mon profil.\nUn coup d\'œil rapide devrait répondre à la plupart de vos questions 😉.';
    }

    if (lot === 'Oui') {
      desc += '\nVendu en lot uniquement.';
    }

    if (noHand) {
      desc += '\n🚩 Je ne fais pas de remise en main propre.';
    }
    if (preferShipping) {
      desc += '\n🚩 Je privilégie les envois à la remise en main propre.';
    }

    setDescription(desc);
  };

  const copierDescription = () => {
    if (description.trim()) {
      navigator.clipboard.writeText(description);
      setCopyMessage('Description copiée dans le presse-papier, à toi de jouer !');
      setTimeout(() => setCopyMessage(''), 10000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-xl text-indigo-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-emerald-600 p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div className="bg-emerald-600 p-3 rounded-xl">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-800">Générateur d'Annonces</h1>
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Colonne gauche - Formulaire */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Paramètres</h2>
            
            <div className="space-y-4">
              {/* Cases à cocher */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefixSociete}
                    onChange={(e) => setPrefixSociete(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium">Jeux de société</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reglesFr}
                    onChange={(e) => setReglesFr(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium">Règles du jeu en français</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aspectSecondaire}
                    onChange={(e) => setAspectSecondaire(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium">Ajouter un aspect extérieur secondaire</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vintedInfo}
                    onChange={(e) => setVintedInfo(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium">Inclure infos Vinted</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noHand}
                    onChange={(e) => setNoHand(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium">Pas de remise en main propre</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferShipping}
                    onChange={(e) => setPreferShipping(e.target.checked)}
                    className="w-4 h-4 text-emerald-600"
                  />
                  <span className="text-sm font-medium">Privilégier les expéditions</span>
                </label>
              </div>

              {/* Nom du jeu */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nom du jeu :
                </label>
                <input
                  type="text"
                  value={nomJeu}
                  onChange={(e) => setNomJeu(e.target.value)}
                  placeholder="Ex: Catane, Azul..."
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* État du matériel */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  État du matériel :
                </label>
                <select
                  value={etatMateriel}
                  onChange={(e) => setEtatMateriel(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                >
                  {etatOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Sous blister */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sous blister :
                </label>
                <select
                  value={blister}
                  onChange={(e) => setBlister(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Non">Non</option>
                  <option value="Oui - Neuf sous blister">Oui - Neuf sous blister</option>
                </select>
              </div>

              {/* Contenu */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contenu :
                </label>
                <select
                  value={complet}
                  onChange={(e) => setComplet(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Complet">Complet</option>
                  <option value="Incomplet">Incomplet</option>
                </select>
              </div>

              {/* Éléments manquants (si incomplet) */}
              {complet === 'Incomplet' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Éléments manquants dans le jeu :
                  </label>
                  <textarea
                    value={elementsManquants}
                    onChange={(e) => setElementsManquants(e.target.value)}
                    rows="3"
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none bg-yellow-50"
                    placeholder="Décrivez les éléments manquants..."
                  />
                </div>
              )}

              {/* Aspect extérieur */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Aspect extérieur (boîte) :
                </label>
                <select
                  value={rayures}
                  onChange={(e) => setRayures(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                >
                  {rayuresOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Aspect secondaire */}
              {aspectSecondaire && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Aspect extérieur secondaire (boîte) :
                  </label>
                  <select
                    value={rayures2}
                    onChange={(e) => setRayures2(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                  >
                    {rayuresOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              )}

              {/* Vendu en lot */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Vendu en lot :
                </label>
                <select
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Non">Non</option>
                  <option value="Oui">Oui</option>
                </select>
              </div>
            </div>
          </div>

          {/* Colonne droite - Résultat */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Description générée</h2>
            
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="20"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none bg-white font-mono text-sm resize-none"
              placeholder="La description générée apparaîtra ici. Vous pouvez la modifier manuellement..."
            />

            <button
              onClick={copierDescription}
              className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              📋 Copier la description
            </button>

            {copyMessage && (
              <p className="text-green-600 text-center mt-4 font-medium animate-pulse">
                {copyMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
