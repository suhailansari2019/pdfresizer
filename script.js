// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

// Variables to store PDF data
let pdfFiles = [];
let currentPdf = null;
let currentPageNum = 1;
let processedPdf = null;

// DOM elements
const pdfInput = document.getElementById('pdfInput');
const fileInfo = document.getElementById('fileInfo');
const pageRange = document.getElementById('pageRange');
const resizeMode = document.getElementById('resizeMode');
const scaleControl = document.querySelector('.scale-control');
const dimensionsControl = document.querySelector('.dimensions-control');
const paperSizeControl = document.querySelector('.paper-size-control');
const scaleFactor = document.getElementById('scaleFactor');
const customWidth = document.getElementById('customWidth');
const customHeight = document.getElementById('customHeight');
const paperSize = document.getElementById('paperSize');
const orientation = document.getElementById('orientation');
const cropMode = document.getElementById('cropMode');
const cropControl = document.querySelector('.crop-control');
const marginsControl = document.querySelector('.margins-control');
const cropTop = document.getElementById('cropTop');
const cropRight = document.getElementById('cropRight');
const cropBottom = document.getElementById('cropBottom');
const cropLeft = document.getElementById('cropLeft');
const marginReduction = document.getElementById('marginReduction');
const processBtn = document.getElementById('processBtn');
const previewSection = document.querySelector('.preview-section');
const pdfPreview = document.getElementById('pdfPreview');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const downloadBtn = document.getElementById('downloadBtn');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const statusMessage = document.getElementById('statusMessage');

// Paper size definitions (width x height in mm)
const paperSizes = {
    a4: { width: 210, height: 297 },
    letter: { width: 216, height: 279 },
    legal: { width: 216, height: 356 },
    a5: { width: 148, height: 210 }
};

// Event listeners
pdfInput.addEventListener('change', handleFileSelect);
resizeMode.addEventListener('change', toggleResizeControls);
cropMode.addEventListener('change', toggleCropControls);
processBtn.addEventListener('click', processPdf);
prevPage.addEventListener('click', showPrevPage);
nextPage.addEventListener('click', showNextPage);
downloadBtn.addEventListener('click', downloadPdf);

// Functions
function handleFileSelect(e) {
    pdfFiles = Array.from(e.target.files);
    if (pdfFiles.length === 0) {
        fileInfo.textContent = 'No files selected';
        return;
    }
    
    fileInfo.textContent = `${pdfFiles.length} file(s) selected: ${pdfFiles.map(f => f.name).join(', ')}`;
}

function toggleResizeControls() {
    const mode = resizeMode.value;
    
    scaleControl.classList.add('hidden');
    dimensionsControl.classList.add('hidden');
    paperSizeControl.classList.add('hidden');
    
    if (mode === 'scale') {
        scaleControl.classList.remove('hidden');
    } else if (mode === 'dimensions') {
        dimensionsControl.classList.remove('hidden');
    } else if (mode === 'paperSize') {
        paperSizeControl.classList.remove('hidden');
    }
}

function toggleCropControls() {
    const mode = cropMode.value;
    
    cropControl.classList.add('hidden');
    marginsControl.classList.add('hidden');
    
    if (mode === 'custom') {
        cropControl.classList.remove('hidden');
    } else if (mode === 'margins') {
        marginsControl.classList.remove('hidden');
    }
}

async function processPdf() {
    if (pdfFiles.length === 0) {
        showStatus('Please select at least one PDF file', 'error');
        return;
    }
    
    try {
        showStatus('Processing PDFs...', 'info');
        progressBar.classList.remove('hidden');
        
        // Initialize jsPDF
        const { jsPDF } = window.jspdf;
        processedPdf = new jsPDF();
        
        let totalPages = 0;
        let processedPages = 0;
        
        // First pass to count total pages
        for (const file of pdfFiles) {
            const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
            totalPages += pdf.numPages;
        }
        
        // Process each file
        for (const file of pdfFiles) {
            const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
            const pagesToProcess = parsePageRange(pageRange.value, pdf.numPages);
            
            for (const pageNum of pagesToProcess) {
                const page = await pdf.getPage(pageNum);
                await processPage(page, processedPdf);
                
                processedPages++;
                updateProgress(processedPages / totalPages * 100);
            }
        }
        
        // Save the processed PDF for preview and download
        currentPdf = processedPdf;
        currentPageNum = 1;
        
        // Show preview
        previewSection.classList.remove('hidden');
        showCurrentPage();
        
        showStatus('PDF processing complete!', 'success');
    } catch (error) {
        console.error('Error processing PDF:', error);
        showStatus('Error processing PDF: ' + error.message, 'error');
    } finally {
        progressBar.classList.add('hidden');
    }
}

async function processPage(page, outputPdf) {
    const viewport = page.getViewport({ scale: 1.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Set canvas dimensions
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render PDF page to canvas
    await page.render({
        canvasContext: context,
        viewport: viewport
    }).promise;
    
    // Get image data
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Calculate dimensions based on resize mode
    let width, height;
    const resizeModeValue = resizeMode.value;
    
    // Convert from PDF points to mm (1 point = 0.352778 mm)
    const pdfWidthMm = viewport.width * 0.352778;
    const pdfHeightMm = viewport.height * 0.352778;
    
    if (resizeModeValue === 'scale') {
        const scale = scaleFactor.value / 100;
        width = pdfWidthMm * scale;
        height = pdfHeightMm * scale;
    } else if (resizeModeValue === 'dimensions') {
        width = parseFloat(customWidth.value);
        height = parseFloat(customHeight.value);
    } else if (resizeModeValue === 'paperSize') {
        const size = paperSizes[paperSize.value];
        const isLandscape = orientation.value === 'landscape';
        width = isLandscape ? size.height : size.width;
        height = isLandscape ? size.width : size.height;
    } else {
        width = pdfWidthMm;
        height = pdfHeightMm;
    }
    
    // Apply cropping
    let cropOptions = {};
    const cropModeValue = cropMode.value;
    
    if (cropModeValue === 'custom') {
        cropOptions = {
            top: parseFloat(cropTop.value),
            right: parseFloat(cropRight.value),
            bottom: parseFloat(cropBottom.value),
            left: parseFloat(cropLeft.value)
        };
    } else if (cropModeValue === 'margins') {
        const reduction = marginReduction.value / 100;
        const margin = Math.min(pdfWidthMm, pdfHeightMm) * 0.1 * reduction; // 10% of smaller dimension
        
        cropOptions = {
            top: margin,
            right: margin,
            bottom: margin,
            left: margin
        };
    }
    
    // Add page to output PDF
    if (outputPdf.getNumberOfPages() > 0) {
        outputPdf.addPage();
    }
    
    // Calculate cropping in pixels (for the original image)
    const cropLeftPx = (cropOptions.left || 0) / 0.352778;
    const cropRightPx = (cropOptions.right || 0) / 0.352778;
    const cropTopPx = (cropOptions.top || 0) / 0.352778;
    const cropBottomPx = (cropOptions.bottom || 0) / 0.352778;
    
    // Calculate cropped dimensions
    const croppedWidthPx = viewport.width - cropLeftPx - cropRightPx;
    const croppedHeightPx = viewport.height - cropTopPx - cropBottomPx;
    
    // Ensure we don't have negative dimensions
    if (croppedWidthPx <= 0 || croppedHeightPx <= 0) {
        throw new Error('Cropping values result in zero or negative dimensions');
    }
    
    // Add image to PDF with cropping
    outputPdf.addImage(imgData, 'JPEG', 
        cropOptions.left || 0, cropOptions.top || 0, 
        width - (cropOptions.left || 0) - (cropOptions.right || 0),
        height - (cropOptions.top || 0) - (cropOptions.bottom || 0),
        null, 'FAST');
}

function parsePageRange(rangeStr, maxPages) {
    if (!rangeStr.trim()) {
        return Array.from({ length: maxPages }, (_, i) => i + 1);
    }
    
    const pages = new Set();
    const parts = rangeStr.split(',');
    
    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            const safeStart = Math.max(1, Math.min(start, maxPages));
            const safeEnd = Math.max(1, Math.min(end || safeStart, maxPages));
            
            for (let i = safeStart; i <= safeEnd; i++) {
                pages.add(i);
            }
        } else {
            const pageNum = parseInt(part);
            if (!isNaN(pageNum) {
                const safePageNum = Math.max(1, Math.min(pageNum, maxPages));
                pages.add(safePageNum);
            }
        }
    }
    
    return Array.from(pages).sort((a, b) => a - b);
}

function showCurrentPage() {
    if (!currentPdf) return;
    
    const totalPages = currentPdf.getNumberOfPages();
    pageInfo.textContent = `Page ${currentPageNum} of ${totalPages}`;
    
    // Create a blob URL for the current page
    const tempPdf = new window.jspdf.jsPDF();
    tempPdf.addPage();
    tempPdf.addImage(currentPdf.output('datauristring'), 'PDF', 0, 0, 0, 0, `PAGE=${currentPageNum}`);
    
    const blobUrl = URL.createObjectURL(tempPdf.output('blob'));
    
    // Display the PDF
    pdfPreview.innerHTML = `
        <embed src="${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" 
               type="application/pdf" width="100%" height="100%">
    `;
    
    // Enable/disable navigation buttons
    prevPage.disabled = currentPageNum <= 1;
    nextPage.disabled = currentPageNum >= totalPages;
}

function showPrevPage() {
    if (currentPageNum > 1) {
        currentPageNum--;
        showCurrentPage();
    }
}

function showNextPage() {
    if (currentPdf && currentPageNum < currentPdf.getNumberOfPages()) {
        currentPageNum++;
        showCurrentPage();
    }
}

function downloadPdf() {
    if (!currentPdf) {
        showStatus('No PDF to download', 'error');
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    currentPdf.save(`resized-pdf-${timestamp}.pdf`);
    showStatus('PDF downloaded successfully', 'success');
}

function updateProgress(percent) {
    progressFill.style.width = `${percent}%`;
}

function showStatus(message, type) {
   statusMessage.style.color = type === 'error' ? getComputedStyle(document.documentElement).getPropertyValue('--error-color') : 
                          type === 'success' ? getComputedStyle(document.documentElement).getPropertyValue('--secondary-color') : 
                          getComputedStyle(document.documentElement).getPropertyValue('--dark-gray');
}

// Initialize controls
toggleResizeControls();
toggleCropControls();
