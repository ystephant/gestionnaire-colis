import React, { useState, useRef } from 'react';
import { useTheme } from '../lib/ThemeContext';

export default function MasquagePDF() {
  const { darkMode, toggleDarkMode } = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [maskHeight, setMaskHeight] = useState(420); // 10.6cm par défaut (300 points ≈ 10.6cm)
  const fileInputRef = useRef(null);
  const directoryInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processPDF(files[0]);
    }
  };

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      await processPDF(files[0]);
    }
  };

  const handleDirectorySelect = async (e) => {
    const files = e.target.files;
    // Traiter tous les fichiers PDF du répertoire
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      alert('Aucun fichier PDF trouvé dans ce répertoire');
      return;
    }

    for (const file of pdfFiles) {
      await processPDF(file);
    }
  };

  const processPDF = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Veuillez sélectionner un fichier PDF valide');
      return;
    }

    setProcessing(true);

    try {
      // Charger la bibliothèque pdf-lib dynamiquement
      const { PDFDocument, rgb } = await import('pdf-lib');
      
      // Lire le fichier PDF
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Obtenir toutes les pages
      const pages = pdfDoc.getPages();
      
      // Pour chaque page, ajouter un rectangle blanc en haut
      for (const page of pages) {
        const { width, height } = page.getSize();
        
        // Dessiner un rectangle blanc depuis le haut de la page
        page.drawRectangle({
          x: 0,
          y: height - maskHeight, // Position depuis le bas (PDF commence en bas)
          width: width,
          height: maskHeight,
          color: rgb(1, 1, 1), // Blanc
        });
      }
      
      // Sauvegarder le PDF modifié
      const pdfBytes = await pdfDoc.save();
      
      // Créer le nom de fichier avec date du jour
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // Format YYYY-MM-DD
      const originalName = file.name.replace('.pdf', '');
      const newFileName = `${originalName}_masqué_${dateStr}.pdf`;
      
      // Créer un blob et télécharger
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = newFileName;
      link.click();
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Erreur lors du traitement du PDF:', error);
      alert('Erreur lors du traitement du PDF. Assurez-vous que le fichier est valide.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} transition-colors duration-300`}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 sm:p-3 rounded-lg sm:rounded-xl flex-shrink-0">
                <svg width="24" height="24" className="sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className={`text-lg sm:text-2xl md:text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} truncate`}>
                  Masquage PDF Mondial Relay
                </h1>
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} hidden sm:block`}>
                  Masquez automatiquement le haut de vos étiquettes
                </p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 flex-shrink-0 ${
                darkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {darkMode ? (
                <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Réglage de la hauteur */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300`}>
          <label className={`block text-sm sm:text-base font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-3 sm:mb-4`}>
            Hauteur de la zone à masquer : <span className="text-indigo-600 dark:text-indigo-400">{Math.round(maskHeight / 28.35 * 10) / 10} cm</span>
          </label>
          <input
            type="range"
            min="0"
            max="842"
            value={maskHeight}
            onChange={(e) => setMaskHeight(Number(e.target.value))}
            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
            style={{
              WebkitAppearance: 'none',
            }}
          />
          <div className="flex justify-between text-xs mt-2">
            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>0 cm</span>
            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>29.7 cm</span>
          </div>
        </div>

        {/* Zone de drop */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            ${darkMode ? 'bg-gray-800' : 'bg-white'} 
            rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-12 mb-4 sm:mb-6 
            border-3 sm:border-4 border-dashed 
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-50' 
              : darkMode 
                ? 'border-gray-600 hover:border-indigo-400' 
                : 'border-gray-300 hover:border-indigo-400'
            }
            transition-all duration-300 cursor-pointer
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center text-center">
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-indigo-600 mb-3 sm:mb-4"></div>
                <p className={`text-base sm:text-xl font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Traitement en cours...
                </p>
              </>
            ) : (
              <>
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                  <svg width="48" height="48" className="sm:w-16 sm:h-16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <p className={`text-base sm:text-xl font-semibold mb-1 sm:mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Glissez-déposez votre PDF ici
                </p>
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  ou cliquez pour sélectionner un fichier
                </p>
              </>
            )}
          </div>
        </div>

        {/* Boutons de sélection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`
              ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} 
              rounded-xl shadow-lg p-4 transition-all duration-300 
              border-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}
              flex items-center justify-center gap-3
            `}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={darkMode ? 'text-indigo-400' : 'text-indigo-600'}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span className={`font-semibold text-sm sm:text-base ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Sélectionner un fichier
            </span>
          </button>

          <button
            onClick={() => directoryInputRef.current?.click()}
            className={`
              ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} 
              rounded-xl shadow-lg p-4 transition-all duration-300 
              border-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'}
              flex items-center justify-center gap-3
            `}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={darkMode ? 'text-purple-400' : 'text-purple-600'}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span className={`font-semibold text-sm sm:text-base ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              Sélectionner un dossier
            </span>
          </button>

          <input
            ref={directoryInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleDirectorySelect}
            className="hidden"
          />
        </div>

        {/* Instructions */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
          <h3 className={`text-base sm:text-lg font-bold mb-3 sm:mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            📋 Comment ça marche ?
          </h3>
          <ol className={`space-y-2 sm:space-y-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-sm sm:text-base`}>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">1</span>
              <span>Ajustez la hauteur de masquage selon vos besoins (par défaut 14.85 cm, soit la moitié d'une feuille A4)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">2</span>
              <span>Choisissez votre méthode : glisser-déposer, sélectionner un fichier unique ou un dossier complet</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">3</span>
              <span>Le(s) PDF modifié(s) se téléchargera(ont) automatiquement avec "_masqué_YYYY-MM-DD" ajouté au nom</span>
            </li>
          </ol>

          <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg sm:rounded-xl ${darkMode ? 'bg-indigo-900 bg-opacity-30' : 'bg-indigo-50'}`}>
            <p className={`text-xs sm:text-sm ${darkMode ? 'text-indigo-300' : 'text-indigo-800'}`}>
              💡 <strong>Astuce :</strong> Un rectangle blanc sera ajouté en haut de chaque page du PDF pour masquer les informations personnelles. Vous pouvez traiter plusieurs fichiers en une fois en sélectionnant un dossier !
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
