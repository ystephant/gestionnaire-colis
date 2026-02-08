import React, { useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/ThemeContext';

export default function MasquagePDF() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [maskHeight, setMaskHeight] = useState(420);
  const [maskWidth, setMaskWidth] = useState(297.5);
  const [selectedZones, setSelectedZones] = useState(['top-left', 'top-right']);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [processedPdfBlob, setProcessedPdfBlob] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');
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
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
      alert('Aucun fichier PDF trouvé dans ce répertoire');
      return;
    }

    for (const file of pdfFiles) {
      await processPDF(file, true);
    }
  };

  const toggleZone = (zone) => {
    setSelectedZones(prev => {
      if (prev.includes(zone)) {
        return prev.filter(z => z !== zone);
      } else {
        return [...prev, zone];
      }
    });
  };

  // Fonction pour recentrer la hauteur (14,85 cm = 420.87 points)
  const centerHeight = () => {
    setMaskHeight(420.87);
  };

  // Fonction pour recentrer la largeur (10,5 cm = 297.64 points)
  const centerWidth = () => {
    setMaskWidth(297.64);
  };

  const generatePreview = async (pdfDoc) => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      
      const tempDoc = await PDFDocument.create();
      const [copiedPage] = await tempDoc.copyPages(pdfDoc, [0]);
      tempDoc.addPage(copiedPage);
      
      const pdfBytes = await tempDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setPreviewImage(url);
    } catch (error) {
      console.error('Erreur lors de la génération de la preview:', error);
    }
  };

  const processPDF = async (file, autoDownload = false) => {
    if (!file || file.type !== 'application/pdf') {
      alert('Veuillez sélectionner un fichier PDF valide');
      return;
    }

    setProcessing(true);
    setCurrentFileName(file.name);

    try {
      const { PDFDocument, rgb } = await import('pdf-lib');
      
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      if (previewMode && !autoDownload) {
        await generatePreview(pdfDoc);
      }
      
      const pages = pdfDoc.getPages();
      
      for (const page of pages) {
        const { width, height } = page.getSize();
        
        selectedZones.forEach(zone => {
          let rectConfig = null;
          
          switch(zone) {
            case 'top-left':
              rectConfig = {
                x: 0,
                y: height - maskHeight,
                width: maskWidth,
                height: maskHeight,
              };
              break;
            case 'top-right':
              rectConfig = {
                x: width - maskWidth,
                y: height - maskHeight,
                width: maskWidth,
                height: maskHeight,
              };
              break;
            case 'bottom-left':
              rectConfig = {
                x: 0,
                y: 0,
                width: maskWidth,
                height: maskHeight,
              };
              break;
            case 'bottom-right':
              rectConfig = {
                x: width - maskWidth,
                y: 0,
                width: maskWidth,
                height: maskHeight,
              };
              break;
          }
          
          if (rectConfig) {
            page.drawRectangle({
              ...rectConfig,
              color: rgb(1, 1, 1),
            });
          }
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      if (previewMode && !autoDownload) {
        setProcessedPdfBlob(blob);
      } else {
        downloadPDF(blob, file.name);
      }
      
    } catch (error) {
      console.error('Erreur lors du traitement du PDF:', error);
      alert('Erreur lors du traitement du PDF. Assurez-vous que le fichier est valide.');
    } finally {
      setProcessing(false);
    }
  };

  const downloadPDF = (blob, originalName) => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const name = originalName.replace('.pdf', '');
    const newFileName = `${name}_masqué_${dateStr}.pdf`;
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = newFileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    if (processedPdfBlob) {
      downloadPDF(processedPdfBlob, currentFileName);
      setProcessedPdfBlob(null);
      setPreviewImage(null);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-indigo-900' : 'bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50'} transition-colors duration-300`}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 sm:mb-6">
            <button
              onClick={() => router.push('/')}
              className={`${darkMode ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700'} px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-lg transition-all duration-300 flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto justify-center sm:justify-start`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Retour
            </button>

            <button
              onClick={toggleDarkMode}
              className={`${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-lg transition-all duration-300`}
            >
              {darkMode ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
          </div>

          <h1 className={`text-3xl sm:text-5xl font-extrabold mb-2 sm:mb-4 ${darkMode ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400' : 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600'}`}>
            🎭 Masquage PDF
          </h1>
          <p className={`text-sm sm:text-lg ${darkMode ? 'text-gray-300' : 'text-gray-600'} max-w-2xl mx-auto px-4`}>
            Masquez facilement des zones spécifiques de vos documents PDF
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-4 sm:space-y-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base sm:text-lg font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  Zones à masquer
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Prévisualisation
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={previewMode}
                      onChange={(e) => setPreviewMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </div>
                </label>
              </div>
              
              {/* Feuille A4 réduite de moitié */}
              <div className="relative bg-white rounded-lg shadow-inner mx-auto" 
                   style={{ 
                     width: '148.5px',  // 297px / 2
                     height: '210px'     // 420px / 2
                   }}>
                {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((zone) => {
                  const isSelected = selectedZones.includes(zone);
                  
                  // Calculer les positions en pixels réduits de moitié
                  const heightPx = (maskHeight / 842) * 210;  // 420px / 2 = 210px
                  const widthPx = (maskWidth / 595) * 148.5;   // 297px / 2 = 148.5px
                  
                  let positionStyles = {};
                  switch(zone) {
                    case 'top-left':
                      positionStyles = { top: 0, left: 0, width: `${widthPx}px`, height: `${heightPx}px` };
                      break;
                    case 'top-right':
                      positionStyles = { top: 0, right: 0, width: `${widthPx}px`, height: `${heightPx}px` };
                      break;
                    case 'bottom-left':
                      positionStyles = { bottom: 0, left: 0, width: `${widthPx}px`, height: `${heightPx}px` };
                      break;
                    case 'bottom-right':
                      positionStyles = { bottom: 0, right: 0, width: `${widthPx}px`, height: `${heightPx}px` };
                      break;
                  }
                  
                  return (
                    <div
                      key={zone}
                      onClick={() => toggleZone(zone)}
                      className={`absolute cursor-pointer transition-all duration-300 border-2 ${
                        isSelected 
                          ? 'bg-indigo-500 bg-opacity-40 border-indigo-600 border-dashed' 
                          : 'bg-gray-200 bg-opacity-20 border-gray-400 border-dashed hover:bg-gray-300 hover:bg-opacity-30'
                      }`}
                      style={positionStyles}
                    />
                  );
                })}
              </div>
              
              <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center mt-3 sm:mt-4`}>
                Cliquez sur les coins pour sélectionner les zones à masquer
              </p>
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <label className={`block text-sm sm:text-base font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Hauteur de la zone : <span className="text-purple-600 dark:text-purple-400">{Math.round(maskHeight / 28.35 * 10) / 10} cm</span>
                </label>
                <button
                  onClick={centerHeight}
                  className="ml-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap"
                  title="Centrer à 14.85 cm"
                >
                  ⊙ 14.85
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="842"
                value={maskHeight}
                onChange={(e) => setMaskHeight(Number(e.target.value))}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs mt-2">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>0 cm</span>
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>29.7 cm</span>
              </div>
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <label className={`block text-sm sm:text-base font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Largeur de la zone : <span className="text-purple-600 dark:text-purple-400">{Math.round(maskWidth / 28.35 * 10) / 10} cm</span>
                </label>
                <button
                  onClick={centerWidth}
                  className="ml-2 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap"
                  title="Centrer à 10.5 cm"
                >
                  ⊙ 10.5
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="595"
                value={maskWidth}
                onChange={(e) => setMaskWidth(Number(e.target.value))}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs mt-2">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>0 cm</span>
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>21 cm</span>
              </div>
            </div>

            {/* Bouton de téléchargement sous la largeur si preview activée */}
            {previewMode && processedPdfBlob && (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
                <button
                  onClick={handleDownload}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition shadow-lg text-sm sm:text-base"
                >
                  📥 Télécharger le PDF masqué
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-12 border-3 sm:border-4 border-dashed ${isDragging ? 'border-indigo-500 bg-indigo-50' : darkMode ? 'border-gray-600 hover:border-indigo-400' : 'border-gray-300 hover:border-indigo-400'} transition-all duration-300 cursor-pointer`}
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
                      ou cliquez pour sélectionner
                    </p>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => directoryInputRef.current?.click()}
              className={`w-full ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} rounded-xl shadow-lg p-4 transition-all duration-300 border-2 ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-center gap-3`}
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

            {/* Aperçu réduit sans bandeau */}
            {previewMode && previewImage && (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
                <div className="relative bg-gray-100 rounded-lg overflow-hidden mx-auto" style={{ maxWidth: '300px' }}>
                  <div className="relative w-full" style={{ paddingBottom: '141.4%' }}>
                    <iframe
                      src={`${previewImage}#toolbar=0&navpanes=0&scrollbar=0`}
                      className="absolute inset-0 w-full h-full rounded border-2 border-gray-300"
                      title="Preview PDF"
                    />
                    <div className="absolute inset-0 pointer-events-none z-10">
                      {selectedZones.map(zone => {
                        const heightPercent = (maskHeight / 842) * 100;
                        const widthPercent = (maskWidth / 595) * 100;
                        
                        let overlayStyle = {};
                        switch(zone) {
                          case 'top-left':
                            overlayStyle = { 
                              top: 0, 
                              left: 0, 
                              width: `${widthPercent}%`, 
                              height: `${heightPercent}%` 
                            };
                            break;
                          case 'top-right':
                            overlayStyle = { 
                              top: 0, 
                              right: 0, 
                              width: `${widthPercent}%`, 
                              height: `${heightPercent}%` 
                            };
                            break;
                          case 'bottom-left':
                            overlayStyle = { 
                              bottom: 0, 
                              left: 0, 
                              width: `${widthPercent}%`, 
                              height: `${heightPercent}%` 
                            };
                            break;
                          case 'bottom-right':
                            overlayStyle = { 
                              bottom: 0, 
                              right: 0, 
                              width: `${widthPercent}%`, 
                              height: `${heightPercent}%` 
                            };
                            break;
                        }
                        
                        return (
                          <div
                            key={zone}
                            className="absolute bg-green-500 bg-opacity-30 border-2 border-green-500 border-dashed"
                            style={overlayStyle}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mt-4 sm:mt-6 transition-colors duration-300`}>
          <h3 className={`text-base sm:text-lg font-bold mb-3 sm:mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            📋 Comment ça marche ?
          </h3>
          <ol className={`space-y-2 sm:space-y-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-sm sm:text-base`}>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">1</span>
              <span>Sélectionnez un ou plusieurs carrés sur la feuille A4 (coins haut-gauche, haut-droit, bas-gauche, bas-droit)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">2</span>
              <span>Ajustez la hauteur (0-29.7 cm) et la largeur (0-21 cm) des zones à masquer. Utilisez les boutons ⊙ pour recentrer automatiquement.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">3</span>
              <span>Activez la prévisualisation pour voir un aperçu avant téléchargement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">4</span>
              <span>Glissez-déposez votre PDF ou sélectionnez un dossier pour traiter plusieurs fichiers</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
