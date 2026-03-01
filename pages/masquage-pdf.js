import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from '../lib/ThemeContext';

const TRANSLATIONS = {
  fr: {
    title: 'Masquage PDF', subtitle: 'Masquez automatiquement vos étiquettes',
    preview: 'Prévisualisation', zonesToMask: 'Zones à masquer',
    orientationLabel: 'Orientation de la feuille A4', portrait: 'Portrait', landscape: 'Paysage',
    clickCorners: 'Cliquez sur les coins pour sélectionner les zones à masquer',
    heightLabel: 'Hauteur de la zone', widthLabel: 'Largeur de la zone', center50: '⊙ 50%',
    dropPDF: 'Glissez-déposez votre PDF ici', orClick: 'ou cliquez pour sélectionner',
    selectFolder: 'Sélectionner un dossier', processing: 'Traitement en cours...',
    download: '📥 Télécharger le PDF masqué', previewTitle: 'Aperçu',
    howTitle: '📋 Comment ça marche ?',
    howStep1: "Choisissez l'orientation de votre feuille A4 (Portrait ou Paysage) — ou laissez le logiciel détecter automatiquement.",
    howStep2: 'Sélectionnez un ou plusieurs coins à masquer (haut-gauche, haut-droit, bas-gauche, bas-droit).',
    howStep3: 'Ajustez la hauteur et la largeur en pourcentage (0–100 %). La valeur en cm entre parenthèses est calculée pour votre document. Cliquez sur la valeur pour la saisir manuellement.',
    howStep4: 'Activez la prévisualisation pour vérifier avant téléchargement, ou laissez-la désactivée pour un téléchargement automatique.',
    howStep5: 'Glissez-déposez votre PDF ou sélectionnez un dossier pour traiter plusieurs fichiers.',
    detectedFormat: (f) => `📄 Format ${f} détecté`, unknownFormat: '📄 Format non reconnu',
    detectedLandscape: '↔ Orientation paysage détectée — sélecteur mis à jour',
    detectedPortrait: '↕ Orientation portrait détectée — sélecteur mis à jour',
    noPDFFound: 'Aucun fichier PDF trouvé dans ce répertoire',
    invalidPDF: 'Veuillez sélectionner un fichier PDF valide',
    errorPDF: 'Erreur lors du traitement du PDF. Assurez-vous que le fichier est valide.',
    errorDownload: 'Erreur lors de la création du PDF masqué.', back: "Retour à l'accueil", half: '50% =',
    zoomTitle: 'Agrandir', zoomHint: 'Cliquez sur l\'aperçu pour l\'agrandir', zoomClose: 'Cliquez en dehors ou appuyez sur Échap pour fermer',
    zoneLabels: { tl: 'H-G', tr: 'H-D', bl: 'B-G', br: 'B-D' },
  },
  en: {
    title: 'PDF Masking', subtitle: 'Automatically mask your labels',
    preview: 'Preview', zonesToMask: 'Zones to mask',
    orientationLabel: 'A4 sheet orientation', portrait: 'Portrait', landscape: 'Landscape',
    clickCorners: 'Click on corners to select zones to mask',
    heightLabel: 'Zone height', widthLabel: 'Zone width', center50: '⊙ 50%',
    dropPDF: 'Drag & drop your PDF here', orClick: 'or click to select',
    selectFolder: 'Select a folder', processing: 'Processing...',
    download: '📥 Download masked PDF', previewTitle: 'Preview',
    howTitle: '📋 How does it work?',
    howStep1: 'Choose the A4 sheet orientation (Portrait or Landscape) — or let the software detect it automatically.',
    howStep2: 'Select one or more corners to mask (top-left, top-right, bottom-left, bottom-right).',
    howStep3: 'Adjust height and width as a percentage (0–100%). The cm value in parentheses is calculated for your document. Click the value to type it manually.',
    howStep4: 'Enable preview to check before downloading, or leave it off for automatic download.',
    howStep5: 'Drag & drop your PDF or select a folder to process multiple files.',
    detectedFormat: (f) => `📄 ${f} format detected`, unknownFormat: '📄 Format not recognized',
    detectedLandscape: '↔ Landscape orientation detected — selector updated',
    detectedPortrait: '↕ Portrait orientation detected — selector updated',
    noPDFFound: 'No PDF files found in this folder',
    invalidPDF: 'Please select a valid PDF file',
    errorPDF: 'Error processing PDF. Make sure the file is valid.',
    errorDownload: 'Error creating masked PDF.', back: 'Back to home', half: '50% =',
    zoomTitle: 'Enlarge', zoomHint: 'Click the preview to enlarge it', zoomClose: 'Click outside or press Escape to close',
    zoneLabels: { tl: 'T-L', tr: 'T-R', bl: 'B-L', br: 'B-R' },
  },
  de: {
    title: 'PDF-Maskierung', subtitle: 'Ihre Etiketten automatisch ausblenden',
    preview: 'Vorschau', zonesToMask: 'Zu maskierende Bereiche',
    orientationLabel: 'A4-Blatt-Ausrichtung', portrait: 'Hochformat', landscape: 'Querformat',
    clickCorners: 'Klicken Sie auf die Ecken, um Bereiche auszuwählen',
    heightLabel: 'Bereichshöhe', widthLabel: 'Bereichsbreite', center50: '⊙ 50%',
    dropPDF: 'PDF hier ablegen', orClick: 'oder klicken, um auszuwählen',
    selectFolder: 'Ordner auswählen', processing: 'Verarbeitung...',
    download: '📥 Maskiertes PDF herunterladen', previewTitle: 'Vorschau',
    howTitle: '📋 Wie funktioniert es?',
    howStep1: 'Wählen Sie die Ausrichtung des A4-Blatts (Hoch- oder Querformat) — oder lassen Sie die Software es automatisch erkennen.',
    howStep2: 'Wählen Sie eine oder mehrere Ecken zum Maskieren (oben-links, oben-rechts, unten-links, unten-rechts).',
    howStep3: 'Passen Sie Höhe und Breite als Prozentsatz an (0–100 %). Der cm-Wert in Klammern wird für Ihr Dokument berechnet. Klicken Sie auf den Wert, um ihn manuell einzugeben.',
    howStep4: 'Aktivieren Sie die Vorschau, um vor dem Herunterladen zu prüfen, oder lassen Sie sie für den automatischen Download deaktiviert.',
    howStep5: 'Ziehen Sie Ihre PDF-Datei oder wählen Sie einen Ordner, um mehrere Dateien zu verarbeiten.',
    detectedFormat: (f) => `📄 Format ${f} erkannt`, unknownFormat: '📄 Format nicht erkannt',
    detectedLandscape: '↔ Querformat erkannt — Auswahl aktualisiert',
    detectedPortrait: '↕ Hochformat erkannt — Auswahl aktualisiert',
    noPDFFound: 'Keine PDF-Dateien in diesem Ordner gefunden',
    invalidPDF: 'Bitte wählen Sie eine gültige PDF-Datei',
    errorPDF: 'Fehler beim Verarbeiten der PDF. Stellen Sie sicher, dass die Datei gültig ist.',
    errorDownload: 'Fehler beim Erstellen der maskierten PDF.', back: 'Zurück zur Startseite', half: '50% =',
    zoomTitle: 'Vergrößern', zoomHint: 'Klicken Sie auf die Vorschau zum Vergrößern', zoomClose: 'Außerhalb klicken oder Escape drücken zum Schließen',
    zoneLabels: { tl: 'O-L', tr: 'O-R', bl: 'U-L', br: 'U-R' },
  },
  it: {
    title: 'Mascheratura PDF', subtitle: 'Nascondi automaticamente le tue etichette',
    preview: 'Anteprima', zonesToMask: 'Zone da mascherare',
    orientationLabel: 'Orientamento foglio A4', portrait: 'Verticale', landscape: 'Orizzontale',
    clickCorners: 'Clicca sugli angoli per selezionare le zone da mascherare',
    heightLabel: 'Altezza zona', widthLabel: 'Larghezza zona', center50: '⊙ 50%',
    dropPDF: 'Trascina il tuo PDF qui', orClick: 'o clicca per selezionare',
    selectFolder: 'Seleziona cartella', processing: 'Elaborazione...',
    download: '📥 Scarica il PDF mascherato', previewTitle: 'Anteprima',
    howTitle: '📋 Come funziona?',
    howStep1: "Scegli l'orientamento del foglio A4 (Verticale o Orizzontale) — o lascia che il software lo rilevi automaticamente.",
    howStep2: 'Seleziona uno o più angoli da mascherare (in alto a sinistra, in alto a destra, in basso a sinistra, in basso a destra).',
    howStep3: 'Regola altezza e larghezza in percentuale (0–100 %). Il valore in cm tra parentesi è calcolato per il tuo documento. Clicca sul valore per modificarlo manualmente.',
    howStep4: "Attiva l'anteprima per verificare prima del download, o lasciala disattivata per il download automatico.",
    howStep5: 'Trascina il tuo PDF o seleziona una cartella per elaborare più file.',
    detectedFormat: (f) => `📄 Formato ${f} rilevato`, unknownFormat: '📄 Formato non riconosciuto',
    detectedLandscape: '↔ Orientamento orizzontale rilevato — selettore aggiornato',
    detectedPortrait: '↕ Orientamento verticale rilevato — selettore aggiornato',
    noPDFFound: 'Nessun file PDF trovato in questa cartella',
    invalidPDF: 'Seleziona un file PDF valido',
    errorPDF: "Errore durante l'elaborazione del PDF. Assicurati che il file sia valido.",
    errorDownload: 'Errore durante la creazione del PDF mascherato.', back: 'Torna alla home', half: '50% =',
    zoomTitle: 'Ingrandire', zoomHint: "Clicca sull'anteprima per ingrandirla", zoomClose: 'Clicca fuori o premi Escape per chiudere',
    zoneLabels: { tl: 'A-S', tr: 'A-D', bl: 'B-S', br: 'B-D' },
  },
  es: {
    title: 'Enmascaramiento PDF', subtitle: 'Oculta automáticamente tus etiquetas',
    preview: 'Vista previa', zonesToMask: 'Zonas a enmascarar',
    orientationLabel: 'Orientación de la hoja A4', portrait: 'Vertical', landscape: 'Horizontal',
    clickCorners: 'Haz clic en las esquinas para seleccionar las zonas',
    heightLabel: 'Altura de la zona', widthLabel: 'Anchura de la zona', center50: '⊙ 50%',
    dropPDF: 'Arrastra tu PDF aquí', orClick: 'o haz clic para seleccionar',
    selectFolder: 'Seleccionar carpeta', processing: 'Procesando...',
    download: '📥 Descargar PDF enmascarado', previewTitle: 'Vista previa',
    howTitle: '📋 ¿Cómo funciona?',
    howStep1: 'Elige la orientación de la hoja A4 (Vertical u Horizontal) — o deja que el software la detecte automáticamente.',
    howStep2: 'Selecciona una o más esquinas para enmascarar (arriba-izquierda, arriba-derecha, abajo-izquierda, abajo-derecha).',
    howStep3: 'Ajusta la altura y anchura en porcentaje (0–100 %). El valor en cm entre paréntesis se calcula para tu documento. Haz clic en el valor para introducirlo manualmente.',
    howStep4: 'Activa la vista previa para comprobar antes de descargar, o desactívala para descarga automática.',
    howStep5: 'Arrastra tu PDF o selecciona una carpeta para procesar varios archivos.',
    detectedFormat: (f) => `📄 Formato ${f} detectado`, unknownFormat: '📄 Formato no reconocido',
    detectedLandscape: '↔ Orientación horizontal detectada — selector actualizado',
    detectedPortrait: '↕ Orientación vertical detectada — selector actualizado',
    noPDFFound: 'No se encontraron archivos PDF en esta carpeta',
    invalidPDF: 'Por favor selecciona un archivo PDF válido',
    errorPDF: 'Error al procesar el PDF. Asegúrate de que el archivo es válido.',
    errorDownload: 'Error al crear el PDF enmascarado.', back: 'Volver al inicio', half: '50% =',
    zoomTitle: 'Ampliar', zoomHint: 'Haz clic en la vista previa para ampliarla', zoomClose: 'Haz clic fuera o pulsa Escape para cerrar',
    zoneLabels: { tl: 'S-I', tr: 'S-D', bl: 'I-I', br: 'I-D' },
  },
};

const LANG_LABELS = { fr: '🇫🇷', en: '🇬🇧', de: '🇩🇪', it: '🇮🇹', es: '🇪🇸' };

export default function MasquagePDF() {
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useTheme();

  const [lang, setLang] = useState('fr');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const t = TRANSLATIONS[lang];

  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [orientation, setOrientation] = useState('portrait');
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
  const [detectedFormat, setDetectedFormat] = useState(null);
  const [detectedOrientation, setDetectedOrientation] = useState(null);
  const [showFormatBanner, setShowFormatBanner] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const [zoomOpen, setZoomOpen] = useState(false);

  const fileInputRef = useRef(null);
  const directoryInputRef = useRef(null);
  const heightInputRef = useRef(null);
  const widthInputRef = useRef(null);
  const langMenuRef = useRef(null);
  const canvasRef = useRef(null);
  const confirmHeightEditRef = useRef(null);
  const confirmWidthEditRef = useRef(null);

  const PAPER_FORMATS = [
    { name: 'A0', w: 2384, h: 3370 }, { name: 'A1', w: 1684, h: 2384 },
    { name: 'A2', w: 1191, h: 1684 }, { name: 'A3', w: 842, h: 1191 },
    { name: 'A4', w: 595, h: 842 },   { name: 'A5', w: 420, h: 595 },
    { name: 'A6', w: 298, h: 420 },   { name: 'Letter', w: 612, h: 792 },
    { name: 'Legal', w: 612, h: 1008 }, { name: 'Tabloid', w: 792, h: 1224 },
  ];

  const detectPaperFormat = (pageWidth, pageHeight) => {
    const shortSide = Math.min(pageWidth, pageHeight);
    const longSide  = Math.max(pageWidth, pageHeight);
    const orient    = pageWidth <= pageHeight ? 'portrait' : 'landscape';
    let bestMatch = null, bestDelta = Infinity;
    for (const fmt of PAPER_FORMATS) {
      const delta = Math.abs(fmt.w - shortSide) + Math.abs(fmt.h - longSide);
      if (delta < bestDelta) { bestDelta = delta; bestMatch = fmt; }
    }
    return { format: bestDelta <= 10 ? bestMatch.name : null, orientation: orient };
  };

  const getPageDimensions = () =>
    orientation === 'landscape' ? { width: 842, height: 595 } : { width: 595, height: 842 };
  const ptsToCm = (pts) => Math.round(pts / 28.35 * 100) / 100;
  const getHalfHeightCm    = () => ptsToCm(getPageDimensions().height / 2);
  const getHalfWidthCm     = () => ptsToCm(getPageDimensions().width  / 2);
  const getCurrentHeightCm = () => ptsToCm((maskHeightPercent / 100) * getPageDimensions().height);
  const getCurrentWidthCm  = () => ptsToCm((maskWidthPercent  / 100) * getPageDimensions().width);

  const startEditingHeight = () => { setEditingHeight(true); setTempHeightValue(maskHeightPercent.toString().replace('.', ',')); };
  const confirmHeightEdit  = () => { const v = parseFloat(tempHeightValue.replace(',', '.')); if (!isNaN(v) && v >= 0 && v <= 100) setMaskHeightPercent(Math.round(v * 10) / 10); setEditingHeight(false); };
  confirmHeightEditRef.current = confirmHeightEdit;
  const handleHeightInputKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmHeightEdit(); } else if (e.key === 'Escape') setEditingHeight(false); };

  const startEditingWidth = () => { setEditingWidth(true); setTempWidthValue(maskWidthPercent.toString().replace('.', ',')); };
  const confirmWidthEdit  = () => { const v = parseFloat(tempWidthValue.replace(',', '.')); if (!isNaN(v) && v >= 0 && v <= 100) setMaskWidthPercent(Math.round(v * 10) / 10); setEditingWidth(false); };
  confirmWidthEditRef.current = confirmWidthEdit;
  const handleWidthInputKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmWidthEdit(); } else if (e.key === 'Escape') setEditingWidth(false); };

  useEffect(() => {
    const handler = (e) => {
      if (heightInputRef.current && !heightInputRef.current.contains(e.target) && editingHeight) confirmHeightEditRef.current();
      if (widthInputRef.current  && !widthInputRef.current.contains(e.target)  && editingWidth)  confirmWidthEditRef.current();
      if (langMenuRef.current    && !langMenuRef.current.contains(e.target)) setShowLangMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingHeight, editingWidth]);

  // Fermer le zoom avec Echap
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setZoomOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleOrientationChange = (o) => { setOrientation(o); setMaskHeightPercent(50); setMaskWidthPercent(50); setPreviewCanvas(null); setOriginalPdfFile(null); };

  const handleDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) await processPDF(e.dataTransfer.files[0]); };
  const handleFileSelect = async (e) => { if (e.target.files.length > 0) await processPDF(e.target.files[0]); e.target.value = ''; };
  const handleDirectorySelect = async (e) => {
    const pdfs = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (!pdfs.length) { alert(t.noPDFFound); return; }
    setIsProcessingBatch(true); setPreviewMode(false);
    for (const file of pdfs) await processPDF(file, true);
    setIsProcessingBatch(false); e.target.value = '';
  };

  const toggleZone = (zone) => setSelectedZones(prev => prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]);
  const centerHeight = () => setMaskHeightPercent(50);
  const centerWidth  = () => setMaskWidthPercent(50);

  const generatePreviewCanvas = async (pdfDoc) => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      const tmp = await PDFDocument.create();
      const [cp] = await tmp.copyPages(pdfDoc, [0]);
      tmp.addPage(cp);
      const bytes = await tmp.save();
      const pdfjsLib = await import('pdfjs-dist/webpack');
      const pdf = await pdfjsLib.getDocument({ data: await new Blob([bytes]).arrayBuffer() }).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      setPreviewCanvas(canvas.toDataURL());
    } catch (err) { console.error(err); }
  };

  const processPDF = async (file, autoDownload = false) => {
    if (!file || file.type !== 'application/pdf') { alert(t.invalidPDF); return; }
    setProcessing(true); setCurrentFileName(file.name);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
      if (!autoDownload) {
        const fp = pdfDoc.getPages()[0];
        if (fp) {
          const { width: pw, height: ph } = fp.getSize();
          const det = detectPaperFormat(pw, ph);
          setDetectedFormat(det.format); setDetectedOrientation(det.orientation);
          setShowFormatBanner(true); setOrientation(det.orientation);
        }
      }
      if (previewMode && !autoDownload) { setOriginalPdfFile(file); await generatePreviewCanvas(pdfDoc); }
      else { downloadPDF(await applyMasking(pdfDoc), file.name); }
    } catch (err) { console.error(err); alert(t.errorPDF); }
    finally { setProcessing(false); }
  };

  // ── applyMasking : formules mathématiques vérifiées ─────────────────────
  // On calcule le coin supérieur-gauche en coordonnées écran (vis_x→, vis_y↓)
  // puis on projette vers le content-stream PDF (x→, y↑).
  //
  //  Rotate=0  : pdf_x = sx0           pdf_y (bas) = visH - sy0 - sh
  //  Rotate=90 : pdf_x = sy0           pdf_y (bas) = sx0
  //  Rotate=180: pdf_x = visW-sx0-sw   pdf_y (bas) = sy0
  //  Rotate=270: pdf_x = visH-sy0-sh   pdf_y (bas) = visW-sx0-sw
  //                                    (visW=rawH, visH=rawW pour 90° et 270°)
  const applyMasking = async (pdfDoc) => {
    const { rgb } = await import('pdf-lib');
    for (const page of pdfDoc.getPages()) {
      const rotation = page.getRotation().angle;
      const mb = page.getMediaBox();
      const rawW = mb.width, rawH = mb.height;
      const isSwapped = rotation === 90 || rotation === 270;
      const visW = isSwapped ? rawH : rawW;
      const visH = isSwapped ? rawW : rawH;
      const maskVW = (maskWidthPercent  / 100) * visW;
      const maskVH = (maskHeightPercent / 100) * visH;

      const ZONES_POS = {
        'top-left':     { sx0: 0,            sy0: 0            },
        'top-right':    { sx0: visW - maskVW, sy0: 0            },
        'bottom-left':  { sx0: 0,            sy0: visH - maskVH },
        'bottom-right': { sx0: visW - maskVW, sy0: visH - maskVH },
      };

      for (const zone of selectedZones) {
        const { sx0, sy0 } = ZONES_POS[zone];
        const sw = maskVW, sh = maskVH;
        let rx, ry, rw, rh;
        switch (rotation) {
          case 90:  rx = sy0;           ry = sx0;           rw = sh; rh = sw; break;
          case 180: rx = visW-sx0-sw;   ry = sy0;           rw = sw; rh = sh; break;
          case 270: rx = visH-sy0-sh;   ry = visW-sx0-sw;   rw = sh; rh = sw; break;
          default:  rx = sx0;           ry = visH-sy0-sh;   rw = sw; rh = sh; break;
        }
        page.drawRectangle({ x: rx, y: ry, width: rw, height: rh, color: rgb(1, 1, 1) });
      }
    }
    return new Blob([await pdfDoc.save()], { type: 'application/pdf' });
  };

  const downloadPDF = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace('.pdf','')}_masqué_${new Date().toISOString().split('T')[0]}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    if (!originalPdfFile) return; setProcessing(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.load(await originalPdfFile.arrayBuffer());
      downloadPDF(await applyMasking(pdfDoc), currentFileName);
      setOriginalPdfFile(null); setPreviewCanvas(null);
    } catch (err) { console.error(err); alert(t.errorDownload); }
    finally { setProcessing(false); }
  };

  const a4AR = orientation === 'landscape' ? '1.414 / 1' : '1 / 1.414';
  const fmtPct = (v) => { const r = Math.round(v*10)/10; return (r%1===0?r.toString():r.toString().replace('.',',')); };
  const fmtCm  = (v) => v.toString().replace('.',',');

  const ZONE_POS_STYLE = {
    'top-left':    { top:0, left:0 }, 'top-right':    { top:0, right:0 },
    'bottom-left': { bottom:0, left:0 }, 'bottom-right': { bottom:0, right:0 },
  };

  const sliders = [
    { label: t.heightLabel, val: maskHeightPercent, setVal: setMaskHeightPercent, editing: editingHeight, temp: tempHeightValue, setTemp: setTempHeightValue, inputRef: heightInputRef, startEdit: startEditingHeight, onKeyDown: handleHeightInputKeyPress, center: centerHeight, halfCm: getHalfHeightCm(), currentCm: getCurrentHeightCm() },
    { label: t.widthLabel,  val: maskWidthPercent,  setVal: setMaskWidthPercent,  editing: editingWidth,  temp: tempWidthValue,  setTemp: setTempWidthValue,  inputRef: widthInputRef,  startEdit: startEditingWidth,  onKeyDown: handleWidthInputKeyPress,  center: centerWidth,  halfCm: getHalfWidthCm(),  currentCm: getCurrentWidthCm() },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100'} transition-colors duration-300`}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">

        {/* ── EN-TÊTE ─────────────────────────────────────────────────── */}
        <div className={`${darkMode?'bg-gray-800':'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 mb-4 transition-colors duration-300`}>
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <button onClick={() => router.push('/')} title={t.back}
                className={`${darkMode?'text-gray-400 hover:text-indigo-400 hover:bg-gray-700':'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'} p-2 rounded-lg transition flex-shrink-0`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <div className="bg-gradient-to-br from-orange-500 to-red-500 p-2 sm:p-3 rounded-lg sm:rounded-xl flex-shrink-0">
                <svg width="24" height="24" className="sm:w-8 sm:h-8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className={`text-lg sm:text-2xl md:text-3xl font-bold ${darkMode?'text-gray-100':'text-gray-800'} truncate`}>{t.title}</h1>
                <p className={`text-xs sm:text-sm ${darkMode?'text-gray-400':'text-gray-600'} hidden sm:block`}>{t.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Sélecteur langue */}
              <div className="relative" ref={langMenuRef}>
                <button onClick={() => setShowLangMenu(v=>!v)}
                  className={`flex items-center gap-1 px-2 sm:px-3 py-2 rounded-lg sm:rounded-xl transition-all duration-300 ${darkMode?'bg-gray-700 hover:bg-gray-600':'bg-gray-100 hover:bg-gray-200'}`}>
                  <span className="text-xl sm:text-2xl leading-none">{LANG_LABELS[lang]}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={`transition-transform duration-200 ${darkMode?'text-gray-400':'text-gray-500'} ${showLangMenu?'rotate-180':''}`}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {showLangMenu && (
                  <div className={`absolute right-0 top-full mt-1 z-50 rounded-xl shadow-2xl border overflow-hidden ${darkMode?'bg-gray-800 border-gray-700':'bg-white border-gray-200'}`}>
                    {Object.entries(LANG_LABELS).map(([code, flag]) => (
                      <button key={code} onClick={() => { setLang(code); setShowLangMenu(false); }}
                        className={`w-full flex items-center justify-center px-3 py-2.5 text-2xl transition-colors ${lang===code ? (darkMode?'bg-orange-900/40':'bg-orange-50') : (darkMode?'hover:bg-gray-700':'hover:bg-gray-50')}`}>
                        {flag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Jour/nuit */}
              <button onClick={toggleDarkMode}
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 ${darkMode?'bg-gray-700 hover:bg-gray-600 text-yellow-400':'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
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

          {/* Bandeau détection */}
          {showFormatBanner && (
            <div className={`mt-4 pt-4 border-t flex items-center justify-between gap-3 flex-wrap ${darkMode?'border-gray-700':'border-gray-100'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`flex-shrink-0 rounded border-2 ${darkMode?'border-orange-400 bg-gray-700':'border-orange-500 bg-orange-50'}`}
                  style={{width:detectedOrientation==='landscape'?28:20,height:detectedOrientation==='landscape'?20:28}}/>
                <div>
                  <p className={`text-sm font-bold leading-tight ${darkMode?'text-gray-100':'text-gray-800'}`}>
                    {detectedFormat ? t.detectedFormat(detectedFormat) : t.unknownFormat}
                  </p>
                  <p className={`text-xs leading-tight ${darkMode?'text-gray-400':'text-gray-500'}`}>
                    {detectedOrientation==='landscape' ? t.detectedLandscape : t.detectedPortrait}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowFormatBanner(false)}
                className={`flex-shrink-0 p-1 rounded-lg transition-colors ${darkMode?'text-gray-500 hover:text-gray-300 hover:bg-gray-700':'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── COMMENT ÇA MARCHE (replié par défaut) ──────────────────── */}
        <div className={`${darkMode?'bg-gray-800':'bg-white'} rounded-xl sm:rounded-2xl shadow-xl mb-4 sm:mb-6 overflow-hidden transition-colors duration-300`}>
          <button onClick={() => setHowOpen(v=>!v)}
            className={`w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 text-left transition-colors ${darkMode?'hover:bg-gray-750':'hover:bg-gray-50'}`}>
            <span className={`text-base sm:text-lg font-bold ${darkMode?'text-gray-100':'text-gray-800'}`}>{t.howTitle}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={`flex-shrink-0 transition-transform duration-300 ${howOpen?'rotate-180':''} ${darkMode?'text-gray-400':'text-gray-500'}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {howOpen && (
            <div className={`px-4 sm:px-6 pb-4 sm:pb-6 border-t ${darkMode?'border-gray-700':'border-gray-100'}`}>
              <ol className={`space-y-2 sm:space-y-3 mt-4 ${darkMode?'text-gray-300':'text-gray-700'} text-sm sm:text-base`}>
                {[t.howStep1,t.howStep2,t.howStep3,t.howStep4,t.howStep5].map((step,i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 mt-0.5">{i+1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* ── GRILLE ─────────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-4 sm:space-y-6">

            {/* Zones */}
            <div className={`${darkMode?'bg-gray-800':'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base sm:text-lg font-bold ${darkMode?'text-gray-100':'text-gray-800'}`}>{t.zonesToMask}</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className={`text-xs sm:text-sm font-medium ${darkMode?'text-gray-300':'text-gray-700'}`}>{t.preview}</span>
                  <div className="relative">
                    <input type="checkbox" checked={previewMode} onChange={(e)=>setPreviewMode(e.target.checked)} disabled={isProcessingBatch} className="sr-only peer"/>
                    <div className={`w-11 h-6 rounded-full peer transition-all ${isProcessingBatch?'bg-gray-300 cursor-not-allowed':'bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-red-500 cursor-pointer'} peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}/>
                  </div>
                </label>
              </div>

              {/* Orientation */}
              <div className="mb-4">
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${darkMode?'text-gray-400':'text-gray-500'}`}>{t.orientationLabel}</p>
                <div className="flex gap-2">
                  {[{key:'portrait',icon:<svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="1" width="12" height="16" rx="1"/></svg>},{key:'landscape',icon:<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="1" width="16" height="12" rx="1"/></svg>}].map(({key,icon})=>(
                    <button key={key} onClick={()=>handleOrientationChange(key)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 font-semibold text-sm transition-all duration-200 ${orientation===key?'border-orange-500 bg-orange-50 text-orange-700':(darkMode?'border-gray-600 text-gray-400 hover:border-gray-500':'border-gray-200 text-gray-500 hover:border-gray-300')}`}>
                      {icon}{key==='portrait'?t.portrait:t.landscape}
                    </button>
                  ))}
                </div>
              </div>

              {/* Miniature A4 */}
              <div className="flex justify-center">
                <div className="relative bg-white rounded-lg shadow-inner" style={{aspectRatio:a4AR,width:orientation==='landscape'?'210px':'148px',maxWidth:'100%'}}>
                  {['top-left','top-right','bottom-left','bottom-right'].map(zone=>(
                    <div key={zone} onClick={()=>toggleZone(zone)}
                      className={`absolute cursor-pointer transition-all duration-300 border-2 ${selectedZones.includes(zone)?'bg-red-500 bg-opacity-40 border-red-600 border-dashed':'bg-gray-200 bg-opacity-20 border-gray-400 border-dashed hover:bg-gray-300 hover:bg-opacity-30'}`}
                      style={{...ZONE_POS_STYLE[zone],width:`${maskWidthPercent}%`,height:`${maskHeightPercent}%`}}/>
                  ))}
                </div>
              </div>
              <p className={`text-xs sm:text-sm ${darkMode?'text-gray-400':'text-gray-500'} text-center mt-3 sm:mt-4`}>{t.clickCorners}</p>
            </div>

            {/* Sliders hauteur/largeur */}
            {sliders.map(({label,val,setVal,editing,temp,setTemp,inputRef,startEdit,onKeyDown,center,halfCm,currentCm})=>(
              <div key={label} className={`${darkMode?'bg-gray-800':'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <label className={`block text-sm sm:text-base font-semibold ${darkMode?'text-gray-200':'text-gray-700'}`}>
                    {label} :&nbsp;
                    {editing?(
                      <span ref={inputRef} className="inline-flex items-center">
                        <input type="text" value={temp} onChange={e=>setTemp(e.target.value)} onKeyDown={onKeyDown} autoFocus
                          className="w-16 px-2 py-1 border-2 border-red-500 rounded text-red-600 focus:outline-none focus:border-red-700"/>
                        <span className="ml-1 text-red-500 font-bold">%</span>
                      </span>
                    ):(
                      <span className="text-red-600 dark:text-red-400 cursor-pointer hover:underline" onClick={startEdit}>
                        {fmtPct(val)}%
                        <span className={`ml-1 font-normal text-xs ${darkMode?'text-gray-400':'text-gray-500'}`}>({fmtCm(currentCm)} cm)</span>
                      </span>
                    )}
                  </label>
                  <button onClick={center} title={`50% — ${fmtCm(halfCm)} cm`}
                    className="ml-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors duration-200 whitespace-nowrap">
                    {t.center50}
                  </button>
                </div>
                <input type="range" min="0" max="100" step="0.5" value={val} onChange={e=>setVal(Number(e.target.value))}
                  className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer"/>
                <div className="flex justify-between text-xs mt-2">
                  <span className={darkMode?'text-gray-400':'text-gray-500'}>0%</span>
                  <span className={darkMode?'text-gray-400':'text-gray-500'}>{t.half} {fmtCm(halfCm)} cm</span>
                  <span className={darkMode?'text-gray-400':'text-gray-500'}>100%</span>
                </div>
              </div>
            ))}

            {/* Télécharger */}
            {previewMode && originalPdfFile && (
              <div className={`${darkMode?'bg-gray-800':'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
                <button onClick={handleDownload} disabled={processing}
                  className={`w-full ${processing?'bg-gray-400':'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'} text-white py-3 rounded-xl font-semibold transition shadow-lg text-sm sm:text-base`}>
                  {processing?`⏳ ${t.processing}`:t.download}
                </button>
              </div>
            )}
          </div>

          {/* Colonne droite */}
          <div className="space-y-4 sm:space-y-6">
            {/* Zone dépôt */}
            <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={()=>fileInputRef.current?.click()}
              className={`${darkMode?'bg-gray-800':'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-12 border-3 sm:border-4 border-dashed ${isDragging?'border-indigo-500 bg-indigo-50':(darkMode?'border-gray-600 hover:border-indigo-400':'border-gray-300 hover:border-indigo-400')} transition-all duration-300 cursor-pointer`}>
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileSelect} className="hidden"/>
              <div className="flex flex-col items-center text-center">
                {processing?(
                  <><div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-indigo-600 mb-3 sm:mb-4"/>
                  <p className={`text-base sm:text-xl font-semibold ${darkMode?'text-gray-200':'text-gray-700'}`}>{t.processing}</p></>
                ):(
                  <><div className="bg-gradient-to-br from-orange-500 to-red-500 p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                    <svg width="48" height="48" className="sm:w-16 sm:h-16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg></div>
                  <p className={`text-base sm:text-xl font-semibold mb-1 sm:mb-2 ${darkMode?'text-gray-200':'text-gray-700'}`}>{t.dropPDF}</p>
                  <p className={`text-xs sm:text-sm ${darkMode?'text-gray-400':'text-gray-500'}`}>{t.orClick}</p></>
                )}
              </div>
            </div>

            <button onClick={()=>!previewMode&&directoryInputRef.current?.click()} disabled={previewMode}
              className={`w-full rounded-xl shadow-lg p-4 transition-all duration-300 border-2 flex items-center justify-center gap-3 ${previewMode?'bg-gray-200 border-gray-300 cursor-not-allowed opacity-50':(darkMode?'bg-gray-800 hover:bg-gray-700 border-gray-700':'bg-white hover:bg-gray-50 border-gray-200')}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={previewMode?'text-gray-400':(darkMode?'text-orange-400':'text-orange-600')}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className={`font-semibold text-sm sm:text-base ${previewMode?'text-gray-400':(darkMode?'text-gray-200':'text-gray-700')}`}>{t.selectFolder}</span>
            </button>
            <input ref={directoryInputRef} type="file" webkitdirectory="" directory="" multiple onChange={handleDirectorySelect} className="hidden"/>

            {/* Aperçu canvas */}
            {previewMode && previewCanvas && (
              <div className={`${darkMode?'bg-gray-800':'bg-white'} rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 transition-colors duration-300`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-base sm:text-lg font-bold ${darkMode?'text-gray-100':'text-gray-800'}`}>{t.previewTitle}</h3>
                  {/* Bouton loupe */}
                  <button
                    onClick={() => setZoomOpen(true)}
                    title={t.zoomTitle}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border
                      ${darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-200'
                        : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-700'}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      <line x1="11" y1="8" x2="11" y2="14"/>
                      <line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                    {t.zoomTitle}
                  </button>
                </div>

                {/* Miniature cliquable */}
                <div
                  className="relative bg-gray-100 rounded-lg overflow-hidden mx-auto w-full sm:max-w-xs cursor-zoom-in group"
                  onClick={() => setZoomOpen(true)}
                  title={t.zoomTitle}
                >
                  <div className="relative w-full" style={{paddingBottom:orientation==='landscape'?'70.7%':'141.4%'}}>
                    <img src={previewCanvas} alt="Aperçu PDF" className="absolute inset-0 w-full h-full object-contain rounded border-2 border-gray-300"/>
                    {/* Overlay zones rouges */}
                    <div className="absolute inset-0 pointer-events-none z-10">
                      {selectedZones.map(zone=>(
                        <div key={zone} className="absolute bg-red-500 bg-opacity-30 border-2 border-red-500 border-dashed"
                          style={{...ZONE_POS_STYLE[zone],width:`${maskWidthPercent}%`,height:`${maskHeightPercent}%`}}/>
                      ))}
                    </div>
                    {/* Hint loupe au hover */}
                    <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className={`p-2 rounded-full ${darkMode?'bg-gray-900/70':'bg-white/80'} shadow-lg`}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          className={darkMode?'text-gray-100':'text-gray-700'}>
                          <circle cx="11" cy="11" r="8"/>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                          <line x1="11" y1="8" x2="11" y2="14"/>
                          <line x1="8" y1="11" x2="14" y2="11"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
                <p className={`text-center text-xs mt-2 ${darkMode?'text-gray-500':'text-gray-400'}`}>{t.zoomHint}</p>
              </div>
            )}

            {/* ── MODAL ZOOM ─────────────────────────────────────────────── */}
            {zoomOpen && previewCanvas && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
                onClick={() => setZoomOpen(false)}
              >
                {/* Bouton fermer */}
                <button
                  onClick={() => setZoomOpen(false)}
                  className="absolute top-4 right-4 z-60 p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors"
                  title="Fermer (Échap)"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>

                {/* Conteneur image — ne pas propager le clic */}
                <div
                  className="relative max-h-screen max-w-full"
                  style={{
                    width: orientation === 'landscape' ? 'min(90vw, 140vh)' : 'min(70vw, 60vh)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="relative w-full rounded-xl overflow-hidden shadow-2xl border-2 border-white/20"
                    style={{ paddingBottom: orientation === 'landscape' ? '70.7%' : '141.4%' }}>
                    <img
                      src={previewCanvas}
                      alt="Aperçu PDF agrandi"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    {/* Zones rouges en grand */}
                    <div className="absolute inset-0 pointer-events-none z-10">
                      {selectedZones.map(zone=>(
                        <div key={zone} className="absolute bg-red-500 bg-opacity-30 border-2 border-red-400 border-dashed"
                          style={{...ZONE_POS_STYLE[zone],width:`${maskWidthPercent}%`,height:`${maskHeightPercent}%`}}>
                          {/* Label de la zone */}
                          <span className="absolute top-1 left-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded opacity-80 select-none">
                            {zone === 'top-left'    ? (t.zoneLabels?.tl ?? 'HG') :
                             zone === 'top-right'   ? (t.zoneLabels?.tr ?? 'HD') :
                             zone === 'bottom-left' ? (t.zoneLabels?.bl ?? 'BG') :
                                                      (t.zoneLabels?.br ?? 'BD')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Légende sous l'image */}
                  <p className="text-center text-white/60 text-xs mt-3 select-none">
                    {t.zoomClose}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
