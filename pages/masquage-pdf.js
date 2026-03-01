import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/ThemeContext';

export default function MasquagePDF() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Orientation : 'portrait' ou 'landscape'
  const [orientation, setOrientation] = useState('portrait');

  // Dimensions en pourcentage (défaut 50%)
  const [maskHeightPercent, setMaskHeightPercent] = useState(50);
  const [maskWidthPercent, setMaskWidthPercent] = useState(50);

  const [selectedZones, setSelectedZones] = useState(['top-left', 'top-right']);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewCanvas, setPreviewCanvas] = useState(null);
  const [originalPdfFile, setOriginalPdfFile] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');
  const [editingHeight, setEditingHeight] = useState(false);
  const [editingWidth, setEditingWidth] = useState(false);
  const [tempHeightValue, setTempHeightValue] = useState('');
  const [tempWidthValue, setTempWidthValue] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Détection automatique du format
  const [detectedFormat, setDetectedFormat] = useState(null);       // ex: 'A4', 'A3', 'A5', 'Letter'…
  const [detectedOrientation, setDetectedOrientation] = useState(null); // 'portrait' | 'landscape'
  const [showFormatBanner, setShowFormatBanner] = useState(false);

  const fileInputRef = useRef(null);
  const directoryInputRef = useRef(null);
  const heightInputRef = useRef(null);
  const widthInputRef = useRef(null);
  const canvasRef = useRef(null);

  const confirmHeightEditRef = useRef(null);
  const confirmWidthEditRef = useRef(null);

  // ── Détection du format papier ───────────────────────────────────────────
  // Tailles standard en points (côté court x côté long — indépendant de l'orientation)
  const PAPER_FORMATS = [
    { name: 'A0',     w: 2384, h: 3370 },
    { name: 'A1',     w: 1684, h: 2384 },
    { name: 'A2',     w: 1191, h: 1684 },
    { name: 'A3',     w:  842, h: 1191 },
    { name: 'A4',     w:  595, h:  842 },
    { name: 'A5',     w:  420, h:  595 },
    { name: 'A6',     w:  298, h:  420 },
    { name: 'Letter', w:  612, h:  792 },
    { name: 'Legal',  w:  612, h: 1008 },
    { name: 'Tabloid',w:  792, h: 1224 },
  ];
  const TOLERANCE = 10; // pts

  const detectPaperFormat = (pageWidth, pageHeight) => {
    const shortSide = Math.min(pageWidth, pageHeight);
    const longSide  = Math.max(pageWidth, pageHeight);
    const orient    = pageWidth <= pageHeight ? 'portrait' : 'landscape';

    let bestMatch = null;
    let bestDelta = Infinity;
    for (const fmt of PAPER_FORMATS) {
      const delta = Math.abs(fmt.w - shortSide) + Math.abs(fmt.h - longSide);
      if (delta < bestDelta) { bestDelta = delta; bestMatch = fmt; }
    }
    const matched = bestDelta <= TOLERANCE ? bestMatch.name : null;
    return { format: matched, orientation: orient, widthPts: pageWidth, heightPts: pageHeight };
  };


  // A4 Portrait : 595 x 842 pt  |  A4 Paysage : 842 x 595 pt
  const getPageDimensions = () => {
    if (orientation === 'landscape') {
      return { width: 842, height: 595 };
    }
    return { width: 595, height: 842 };
  };

  // Conversion points -> cm
  const ptsToCm = (pts) => Math.round(pts / 28.35 * 100) / 100;

  // Valeurs absolues actuelles (en pts) à partir des %
  const getMaskHeightPts = () => (maskHeightPercent / 100) * getPageDimensions().height;
  const getMaskWidthPts = () => (maskWidthPercent / 100) * getPageDimensions().width;

  // Valeurs à la moitié (50%) du document sélectionné — pour la parenthèse
  const getHalfHeightCm = () => ptsToCm(getPageDimensions().height / 2);
  const getHalfWidthCm = () => ptsToCm(getPageDimensions().width / 2);

  // Valeurs actuelles en cm pour l'affichage
  const getCurrentHeightCm = () => ptsToCm(getMaskHeightPts());
  const getCurrentWidthCm = () => ptsToCm(getMaskWidthPts());

  // ── Édition manuelle hauteur (en %) ──────────────────────────────────────
  const startEditingHeight = () => {
    setEditingHeight(true);
    setTempHeightValue(maskHeightPercent.toString().replace('.', ','));
  };

  const confirmHeightEdit = () => {
    const normalizedValue = tempHeightValue.replace(',', '.');
    const newPercent = parseFloat(normalizedValue);
    if (!isNaN(newPercent) && newPercent >= 0 && newPercent <= 100) {
      setMaskHeightPercent(Math.round(newPercent * 10) / 10);
    }
    setEditingHeight(false);
  };

  confirmHeightEditRef.current = confirmHeightEdit;

  const handleHeightInputKeyPress = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmHeightEdit(); }
    else if (e.key === 'Escape') { setEditingHeight(false); setTempHeightValue(maskHeightPercent.toString().replace('.', ',')); }
  };

  // ── Édition manuelle largeur (en %) ──────────────────────────────────────
  const startEditingWidth = () => {
    setEditingWidth(true);
    setTempWidthValue(maskWidthPercent.toString().replace('.', ','));
  };

  const confirmWidthEdit = () => {
    const normalizedValue = tempWidthValue.replace(',', '.');
    const newPercent = parseFloat(normalizedValue);
    if (!isNaN(newPercent) && newPercent >= 0 && newPercent <= 100) {
      setMaskWidthPercent(Math.round(newPercent * 10) / 10);
    }
    setEditingWidth(false);
  };

  confirmWidthEditRef.current = confirmWidthEdit;

  const handleWidthInputKeyPress = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmWidthEdit(); }
    else if (e.key === 'Escape') { setEditingWidth(false); setTempWidthValue(maskWidthPercent.toString().replace('.', ',')); }
  };

  // Clics extérieurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (heightInputRef.current && !heightInputRef.current.contains(event.target) && editingHeight) {
        confirmHeightEditRef.current();
      }
      if (widthInputRef.current && !widthInputRef.current.contains(event.target) && editingWidth) {
        confirmWidthEditRef.current();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editingHeight, editingWidth]);

  // ── Changement d'orientation ──────────────────────────────────────────────
  const handleOrientationChange = (newOrientation) => {
    setOrientation(newOrientation);
    // Réinitialiser à 50% lors du changement d'orientation
    setMaskHeightPercent(50);
    setMaskWidthPercent(50);
    // Réinitialiser l'aperçu
    setPreviewCanvas(null);
    setOriginalPdfFile(null);
  };

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e) => {
    e.preventDefault(); setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) await processPDF(files[0]);
  };
  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (files.length > 0) await processPDF(files[0]);
    e.target.value = '';
  };

  const handleDirectorySelect = async (e) => {
    const files = e.target.files;
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) { alert('Aucun fichier PDF trouvé dans ce répertoire'); return; }
    setIsProcessingBatch(true);
    setPreviewMode(false);
    for (const file of pdfFiles) { await processPDF(file, true); }
    setIsProcessingBatch(false);
    e.target.value = '';
  };

  const toggleZone = (zone) => {
    setSelectedZones(prev =>
      prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
    );
  };

  // Centrer à 50%
  const centerHeight = () => setMaskHeightPercent(50);
  const centerWidth = () => setMaskWidthPercent(50);

  // ── Génération de l'aperçu canvas ────────────────────────────────────────
  const generatePreviewCanvas = async (pdfDoc) => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      const tempDoc = await PDFDocument.create();
      const [copiedPage] = await tempDoc.copyPages(pdfDoc, [0]);
      tempDoc.addPage(copiedPage);
      const pdfBytes = await tempDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfjsLib = await import('pdfjs-dist/webpack');
      const arrayBuffer = await blob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      setPreviewCanvas(canvas.toDataURL());
    } catch (error) {
      console.error('Erreur lors de la génération du canvas:', error);
    }
  };

  // ── Traitement PDF ────────────────────────────────────────────────────────
  const processPDF = async (file, autoDownload = false) => {
    if (!file || file.type !== 'application/pdf') { alert('Veuillez sélectionner un fichier PDF valide'); return; }
    setProcessing(true);
    setCurrentFileName(file.name);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      // ── Détection automatique du format de la première page ──
      if (!autoDownload) {
        const firstPage = pdfDoc.getPages()[0];
        if (firstPage) {
          const { width: pw, height: ph } = firstPage.getSize();
          const detection = detectPaperFormat(pw, ph);
          setDetectedFormat(detection.format);
          setDetectedOrientation(detection.orientation);
          setShowFormatBanner(true);
          // Synchroniser le sélecteur d'orientation avec le document
          setOrientation(detection.orientation);
        }
      }

      if (previewMode && !autoDownload) {
        setOriginalPdfFile(file);
        await generatePreviewCanvas(pdfDoc);
      } else {
        const processedBlob = await applyMasking(pdfDoc);
        downloadPDF(processedBlob, file.name);
      }
    } catch (error) {
      console.error('Erreur lors du traitement du PDF:', error);
      alert('Erreur lors du traitement du PDF. Assurez-vous que le fichier est valide.');
    } finally {
      setProcessing(false);
    }
  };

  // applyMasking tient compte de la rotation stockée dans la page PDF.
  //
  // Problème : drawRectangle() écrit dans l'espace "content stream" (avant rotation),
  // mais page.getSize() renvoie les dimensions VISUELLES (après rotation).
  // → Il faut transformer les coordonnées visuelles vers l'espace content selon l'angle.
  //
  // Correspondances visuelles → content stream :
  //   Rotate=0  : cx=vx,             cy=vy,                cw=vw, ch=vh
  //   Rotate=90 : cx=vy,             cy=rawH-(vx+vw),      cw=vh, ch=vw
  //   Rotate=180: cx=rawW-(vx+vw),   cy=rawH-(vy+vh),      cw=vw, ch=vh
  //   Rotate=270: cx=rawW-(vy+vh),   cy=vx,                cw=vh, ch=vw
  const applyMasking = async (pdfDoc) => {
    const { rgb } = await import('pdf-lib');
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const rotation = page.getRotation().angle; // 0 | 90 | 180 | 270
      const mediaBox = page.getMediaBox();
      const rawW = mediaBox.width;
      const rawH = mediaBox.height;

      // Dimensions visuelles (après rotation)
      const isSwapped = rotation === 90 || rotation === 270;
      const visW = isSwapped ? rawH : rawW;
      const visH = isSwapped ? rawW : rawH;

      const maskVW = (maskWidthPercent  / 100) * visW;
      const maskVH = (maskHeightPercent / 100) * visH;

      selectedZones.forEach(zone => {
        // Coin bas-gauche du rectangle dans l'espace VISUEL
        // (axe y vers le haut, y=0 = bas de la page visuelle)
        let vx, vy;
        switch (zone) {
          case 'top-left':     vx = 0;           vy = visH - maskVH; break;
          case 'top-right':    vx = visW - maskVW; vy = visH - maskVH; break;
          case 'bottom-left':  vx = 0;           vy = 0;             break;
          case 'bottom-right': vx = visW - maskVW; vy = 0;             break;
          default: return;
        }

        // Transformation vers l'espace content stream selon la rotation
        let cx, cy, cw, ch;
        switch (rotation) {
          case 90:
            cx = vy;
            cy = rawH - (vx + maskVW);
            cw = maskVH;
            ch = maskVW;
            break;
          case 180:
            cx = rawW - (vx + maskVW);
            cy = rawH - (vy + maskVH);
            cw = maskVW;
            ch = maskVH;
            break;
          case 270:
            cx = rawW - (vy + maskVH);
            cy = vx;
            cw = maskVH;
            ch = maskVW;
            break;
          default: // 0°
            cx = vx;
            cy = vy;
            cw = maskVW;
            ch = maskVH;
            break;
        }

        page.drawRectangle({ x: cx, y: cy, width: cw, height: ch, color: rgb(1, 1, 1) });
      });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
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

  const handleDownload = async () => {
    if (!originalPdfFile) return;
    setProcessing(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const arrayBuffer = await originalPdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const processedBlob = await applyMasking(pdfDoc);
      downloadPDF(processedBlob, currentFileName);
      setOriginalPdfFile(null);
      setPreviewCanvas(null);
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      alert('Erreur lors de la création du PDF masqué.');
    } finally {
      setProcessing(false);
    }
  };

  // Aspect ratio pour l'aperçu A4
  const a4AspectRatio = orientation === 'landscape' ? '1.414 / 1' : '1 / 1.414';

  // Formatage des % pour l'affichage (retire les .0 inutiles)
  const formatPercent = (val) => {
    const rounded = Math.round(val * 10) / 10;
    return rounded % 1 === 0 ? rounded.toString() : rounded.toString().replace('.', ',');
  };

  const formatCm = (val) => val.toString().replace('.', ',');

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} transition-colors duration-300`}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">

        {/* ── En-tête ─────────────────────────────────────────────────────── */}
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
              <div className="bg-gradient-to-br from-orange-500 to-red-500 p-2 sm:p-3 rounded-lg sm:rounded-xl flex-shrink-0">
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
              <button
                onClick={toggleDarkMode}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 flex-shrink-0 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                {darkMode ? (
                  <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" className="sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* ── Bandeau de détection automatique ───────────────────────── */}
          {showFormatBanner && (
            <div className={`mt-4 pt-4 border-t flex items-center justify-between gap-3 flex-wrap
              ${darkMode ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className="flex items-center gap-3 flex-wrap">

                {/* Icône miniature de la feuille détectée */}
                <div
                  className={`flex-shrink-0 rounded border-2 ${
                    darkMode ? 'border-orange-400 bg-gray-700' : 'border-orange-500 bg-orange-50'
                  }`}
                  style={{
                    width:  detectedOrientation === 'landscape' ? 28 : 20,
                    height: detectedOrientation === 'landscape' ? 20 : 28,
                  }}
                />

                {/* Texte format */}
                <div>
                  <p className={`text-sm font-bold leading-tight ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    {detectedFormat
                      ? `📄 Format ${detectedFormat} détecté`
                      : '📄 Format non reconnu'}
                  </p>
                  <p className={`text-xs leading-tight ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {detectedOrientation === 'landscape'
                      ? '↔ Orientation paysage détectée — sélecteur mis à jour'
                      : '↕ Orientation portrait détectée — sélecteur mis à jour'}
                  </p>
                </div>
              </div>

              {/* Bouton fermer */}
              <button
                onClick={() => setShowFormatBanner(false)}
                className={`flex-shrink-0 p-1 rounded-lg transition-colors
                  ${darkMode ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title="Fermer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-4 sm:space-y-6">

            {/* ── Zones à masquer ─────────────────────────────────────────── */}
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
                      disabled={isProcessingBatch}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 rounded-full peer transition-all ${
                      isProcessingBatch
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-red-500 cursor-pointer'
                    } peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
                  </div>
                </label>
              </div>

              {/* ── Sélecteur d'orientation ─────────────────────────────── */}
              <div className="mb-4">
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Orientation de la feuille A4
                </p>
                <div className="flex gap-2">
                  {/* Portrait */}
                  <button
                    onClick={() => handleOrientationChange('portrait')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 font-semibold text-sm transition-all duration-200 ${
                      orientation === 'portrait'
                        ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                        : darkMode
                          ? 'border-gray-600 text-gray-400 hover:border-gray-500'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {/* Icône portrait */}
                    <svg width="16" height="20" viewBox="0 0 16 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="1" width="14" height="18" rx="1"/>
                    </svg>
                    Portrait
                  </button>

                  {/* Paysage */}
                  <button
                    onClick={() => handleOrientationChange('landscape')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 font-semibold text-sm transition-all duration-200 ${
                      orientation === 'landscape'
                        ? 'border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                        : darkMode
                          ? 'border-gray-600 text-gray-400 hover:border-gray-500'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {/* Icône paysage */}
                    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="1" width="18" height="14" rx="1"/>
                    </svg>
                    Paysage
                  </button>
                </div>
              </div>

              {/* ── Aperçu A4 miniature ──────────────────────────────────── */}
              <div className="flex justify-center">
                <div
                  className="relative bg-white rounded-lg shadow-inner"
                  style={{
                    aspectRatio: a4AspectRatio,
                    width: orientation === 'landscape' ? '210px' : '148px',
                    maxWidth: '100%',
                  }}
                >
                  {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((zone) => {
                    const isSelected = selectedZones.includes(zone);
                    let positionStyles = {};
                    switch (zone) {
                      case 'top-left':
                        positionStyles = { top: 0, left: 0, width: `${maskWidthPercent}%`, height: `${maskHeightPercent}%` };
                        break;
                      case 'top-right':
                        positionStyles = { top: 0, right: 0, width: `${maskWidthPercent}%`, height: `${maskHeightPercent}%` };
                        break;
                      case 'bottom-left':
                        positionStyles = { bottom: 0, left: 0, width: `${maskWidthPercent}%`, height: `${maskHeightPercent}%` };
                        break;
                      case 'bottom-right':
                        positionStyles = { bottom: 0, right: 0, width: `${maskWidthPercent}%`, height: `${maskHeightPercent}%` };
                        break;
                    }
                    return (
                      <div
                        key={zone}
                        onClick={() => toggleZone(zone)}
                        className={`absolute cursor-pointer transition-all duration-300 border-2 ${
                          isSelected
                            ? 'bg-red-500 bg-opacity-40 border-red-600 border-dashed'
                            : 'bg-gray-200 bg-opacity-20 border-gray-400 border-dashed hover:bg-gray-300 hover:bg-opacity-30'
                        }`}
                        style={positionStyles}
                      />
                    );
                  })}
                </div>
              </div>

              <p className={`text-xs sm:text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} text-center mt-3 sm:mt-4`}>
                Cliquez sur les coins pour sélectionner les zones à masquer
              </p>
            </div>

            {/* ── Hauteur de la zone ───────────────────────────────────────── */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <label className={`block text-sm sm:text-base font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Hauteur de la zone :&nbsp;
                  {editingHeight ? (
                    <span ref={heightInputRef} className="inline-flex items-center">
                      <input
                        type="text"
                        value={tempHeightValue}
                        onChange={(e) => setTempHeightValue(e.target.value)}
                        onKeyDown={handleHeightInputKeyPress}
                        className="w-16 px-2 py-1 border-2 border-red-500 rounded text-red-600 focus:outline-none focus:border-red-700"
                        autoFocus
                      />
                      <span className="ml-1 text-red-500 font-bold">%</span>
                    </span>
                  ) : (
                    <span
                      className="text-red-600 dark:text-red-400 cursor-pointer hover:underline"
                      onClick={startEditingHeight}
                    >
                      {formatPercent(maskHeightPercent)}%
                      <span className={`ml-1 font-normal text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        ({formatCm(getCurrentHeightCm())} cm)
                      </span>
                    </span>
                  )}
                </label>
                <button
                  onClick={centerHeight}
                  className="ml-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap"
                  title={`Centrer à 50% — ${formatCm(getHalfHeightCm())} cm`}
                >
                  ⊙ 50%
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={maskHeightPercent}
                onChange={(e) => setMaskHeightPercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs mt-2">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>0%</span>
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                  50% = {formatCm(getHalfHeightCm())} cm
                </span>
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>100%</span>
              </div>
            </div>

            {/* ── Largeur de la zone ───────────────────────────────────────── */}
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <label className={`block text-sm sm:text-base font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Largeur de la zone :&nbsp;
                  {editingWidth ? (
                    <span ref={widthInputRef} className="inline-flex items-center">
                      <input
                        type="text"
                        value={tempWidthValue}
                        onChange={(e) => setTempWidthValue(e.target.value)}
                        onKeyDown={handleWidthInputKeyPress}
                        className="w-16 px-2 py-1 border-2 border-red-500 rounded text-red-600 focus:outline-none focus:border-red-700"
                        autoFocus
                      />
                      <span className="ml-1 text-red-500 font-bold">%</span>
                    </span>
                  ) : (
                    <span
                      className="text-red-600 dark:text-red-400 cursor-pointer hover:underline"
                      onClick={startEditingWidth}
                    >
                      {formatPercent(maskWidthPercent)}%
                      <span className={`ml-1 font-normal text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        ({formatCm(getCurrentWidthCm())} cm)
                      </span>
                    </span>
                  )}
                </label>
                <button
                  onClick={centerWidth}
                  className="ml-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap"
                  title={`Centrer à 50% — ${formatCm(getHalfWidthCm())} cm`}
                >
                  ⊙ 50%
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={maskWidthPercent}
                onChange={(e) => setMaskWidthPercent(Number(e.target.value))}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs mt-2">
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>0%</span>
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                  50% = {formatCm(getHalfWidthCm())} cm
                </span>
                <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>100%</span>
              </div>
            </div>

            {/* ── Bouton téléchargement ────────────────────────────────────── */}
            {previewMode && originalPdfFile && (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
                <button
                  onClick={handleDownload}
                  disabled={processing}
                  className={`w-full ${processing ? 'bg-gray-400' : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'} text-white py-3 rounded-xl font-semibold transition shadow-lg text-sm sm:text-base`}
                >
                  {processing ? '⏳ Traitement...' : '📥 Télécharger le PDF masqué'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* ── Zone de dépôt ────────────────────────────────────────────── */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-12 border-3 sm:border-4 border-dashed ${isDragging ? 'border-indigo-500 bg-indigo-50' : darkMode ? 'border-gray-600 hover:border-indigo-400' : 'border-gray-300 hover:border-indigo-400'} transition-all duration-300 cursor-pointer`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
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
                    <div className="bg-gradient-to-br from-orange-500 to-red-500 p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
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
              onClick={() => !previewMode && directoryInputRef.current?.click()}
              disabled={previewMode}
              className={`w-full rounded-xl shadow-lg p-4 transition-all duration-300 border-2 flex items-center justify-center gap-3 ${
                previewMode
                  ? 'bg-gray-200 border-gray-300 cursor-not-allowed opacity-50'
                  : darkMode
                    ? 'bg-gray-800 hover:bg-gray-700 border-gray-700'
                    : 'bg-white hover:bg-gray-50 border-gray-200'
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={previewMode ? 'text-gray-400' : darkMode ? 'text-orange-400' : 'text-orange-600'}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span className={`font-semibold text-sm sm:text-base ${previewMode ? 'text-gray-400' : darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
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

            {/* ── Aperçu canvas ────────────────────────────────────────────── */}
            {previewMode && previewCanvas && (
              <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
                <h3 className={`text-base sm:text-lg font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  Aperçu
                </h3>
                <div className="relative bg-gray-100 rounded-lg overflow-hidden mx-auto w-full sm:max-w-xs">
                  <div
                    className="relative w-full"
                    style={{ paddingBottom: orientation === 'landscape' ? '70.7%' : '141.4%' }}
                  >
                    <img
                      src={previewCanvas}
                      alt="Aperçu PDF"
                      className="absolute inset-0 w-full h-full object-contain rounded border-2 border-gray-300"
                    />
                    <div className="absolute inset-0 pointer-events-none z-10">
                      {selectedZones.map(zone => {
                        let overlayStyle = {};
                        switch (zone) {
                          case 'top-left':
                            overlayStyle = { top: 0, left: 0, width: `${maskWidthPercent}%`, height: `${maskHeightPercent}%` };
                            break;
                          case 'top-right':
                            overlayStyle = { top: 0, right: 0, width: `${maskWidthPercent}%`, height: `${maskHeightPercent}%` };
                            break;
                          case 'bottom-left':
                            overlayStyle = { bottom: 0, left: 0, width: `${maskWidthPercent}%`, height: `${maskHeightPercent}%` };
                            break;
                          case 'bottom-right':
                            overlayStyle = { bottom: 0, right: 0, width: `${maskWidthPercent}%`, height: `${maskHeightPercent}%` };
                            break;
                        }
                        return (
                          <div
                            key={zone}
                            className="absolute bg-red-500 bg-opacity-30 border-2 border-red-500 border-dashed"
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

        {/* ── Instructions ─────────────────────────────────────────────────── */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mt-4 sm:mt-6 transition-colors duration-300`}>
          <h3 className={`text-base sm:text-lg font-bold mb-3 sm:mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
            📋 Comment ça marche ?
          </h3>
          <ol className={`space-y-2 sm:space-y-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'} text-sm sm:text-base`}>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">1</span>
              <span>Choisissez l'orientation de votre feuille A4 (Portrait ou Paysage) pour adapter l'aperçu et les valeurs en cm</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">2</span>
              <span>Sélectionnez un ou plusieurs coins à masquer (haut-gauche, haut-droit, bas-gauche, bas-droit)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">3</span>
              <span>Ajustez la hauteur et la largeur en pourcentage (0–100%). La valeur en cm entre parenthèses correspond à la moitié du document. Cliquez sur les valeurs pour les saisir manuellement.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">4</span>
              <span>Activez la prévisualisation pour vérifier avant téléchargement, ou laissez-la désactivée pour un téléchargement automatique</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">5</span>
              <span>Glissez-déposez votre PDF ou sélectionnez un dossier pour traiter plusieurs fichiers</span>
            </li>
          </ol>
        </div>

      </div>
    </div>
  );
}
