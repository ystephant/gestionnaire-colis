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
  const [selectedZones, setSelectedZones] = useState(['top-left']);
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
      setCurrentFileName('');
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} transition-colors duration-300`}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300`}>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <button
                onClick={() => router.push('/')}
                className={`${darkMode ? 'text-gray-400 hover:text-indigo-400 hover:bg-gray-700' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'} p-2 rounded-lg transition flex-shrink-0`}
                title="Retour à l'accueil"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"></path>
                </svg>
              </button>
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 sm:p-3 rounded-lg sm:rounded-xl flex-shrink-0">
                <svg width="24" height="24" className="sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className={`text-lg sm:text-2xl md:text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'} truncate`}>
                  Masquage PDF
                </h1>
                <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} hidden sm:block`}>
                  Masquez automatiquement vos étiquettes
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewMode}
                  onChange={(e) => setPreviewMode(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                />
                <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'} hidden sm:inline`}>
                  Prévisualisation
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm:hidden">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </label>
              <button
                onClick={toggleDarkMode}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 flex-shrink-0 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
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
        </div>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-4 sm:space-y-6">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
              <h3 className={`text-base sm:text-lg font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                Zones à masquer
              </h3>
              <div className="flex justify-center">
                <div className="relative w-48 h-64 bg-white rounded-lg shadow-lg border-2 border-gray-300">
                  <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full" viewBox="0 0 100 140">
                      <line x1="50" y1="0" x2="50" y2="140" stroke="#ccc" strokeWidth="0.5" strokeDasharray="2,2"/>
                      <line x1="0" y1="70" x2="100" y2="70" stroke="#ccc" strokeWidth="0.5" strokeDasharray="2,2"/>
                    </svg>
                  </div>
                  
                  <button
                    onClick={() => toggleZone('top-left')}
                    className={`absolute top-0 left-0 w-1/2 h-1/2 transition-all ${selectedZones.includes('top-left') ? 'bg-green-400 bg-opacity-50' : 'hover:bg-gray-100 hover:bg-opacity-50'}`}
                    title="Haut Gauche"
                  />
                  
                  <button
                    onClick={() => toggleZone('top-right')}
                    className={`absolute top-0 right-0 w-1/2 h-1/2 transition-all ${selectedZones.includes('top-right') ? 'bg-green-400 bg-opacity-50' : 'hover:bg-gray-100 hover:bg-opacity-50'}`}
                    title="Haut Droit"
                  />
                  
                  <button
                    onClick={() => toggleZone('bottom-left')}
                    className={`absolute bottom-0 left-0 w-1/2 h-1/2 transition-all ${selectedZones.includes('bottom-left') ? 'bg-green-400 bg-opacity-50' : 'hover:bg-gray-100 hover:bg-opacity-50'}`}
                    title="Bas Gauche"
                  />
                  
                  <button
                    onClick={() => toggleZone('bottom-right')}
                    className={`absolute bottom-0 right-0 w-1/2 h-1/2 transition-all ${selectedZones.includes('bottom-right') ? 'bg-green-400 bg-opacity-50' : 'hover:bg-gray-100 hover:bg-opacity-50'}`}
                    title="Bas Droit"
                  />
                </div>
              </div>
              <p className={`text-xs text-center mt-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Cliquez sur un ou plusieurs carrés
              </p>
            </div>

            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
              <label className={`block text-sm sm:text-base font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-3 sm:mb-4`}>
                Hauteur de la zone : <span className="text-indigo-600 dark:text-indigo-400">{Math.round(maskHeight / 28.35 * 10) / 10} cm</span>
              </label>
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
              <label className={`block text-sm sm:text-base font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'} mb-3 sm:mb-4`}>
                Largeur de la zone : <span className="text-purple-600 dark:text-purple-400">{Math.round(maskWidth / 28.35 * 10) / 10} cm</span>
              </label>
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

            {previewMode && previewImage && (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
                <h3 className={`text-base sm:text-lg font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  Aperçu
                </h3>
                <div className="relative bg-gray-100 rounded-lg p-2 mb-4 overflow-hidden">
                  <div className="relative w-full h-48">
                    <iframe
                      src={previewImage}
                      className="w-full h-full rounded border-2 border-gray-300"
                      title="Preview PDF"
                    />
                    <div className="absolute inset-2 pointer-events-none z-10">
                      {selectedZones.map(zone => {
                        const heightPercent = (maskHeight / 842) * 100;
                        const widthPercent = (maskWidth / 595) * 100;
                        
                        let overlayStyle = {};
                        switch(zone) {
                          case 'top-left':
                            overlayStyle = { top: 0, left: 0, width: `${widthPercent}%`, height: `${heightPercent}%` };
                            break;
                          case 'top-right':
                            overlayStyle = { top: 0, right: 0, width: `${widthPercent}%`, height: `${heightPercent}%` };
                            break;
                          case 'bottom-left':
                            overlayStyle = { bottom: 0, left: 0, width: `${widthPercent}%`, height: `${heightPercent}%` };
                            break;
                          case 'bottom-right':
                            overlayStyle = { bottom: 0, right: 0, width: `${widthPercent}%`, height: `${heightPercent}%` };
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
                <button
                  onClick={handleDownload}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-600 hover:to-purple-700 transition shadow-lg"
                >
                  📥 Télécharger le PDF masqué
                </button>
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
              <span>Ajustez la hauteur (0-29.7 cm) et la largeur (0-21 cm) des zones à masquer</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">3</span>
              <span>Activez la prévisualisation dans le header pour voir un aperçu avant téléchargement</span>
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
