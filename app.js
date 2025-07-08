// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

// DOM elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const pdfViewer = document.getElementById('pdf-viewer');
const cropCanvas = document.getElementById('crop-canvas');
const cropBtn = document.getElementById('crop-btn');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const cropControls = document.querySelector('.crop-controls');

// State variables
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5;
let cropStartX, cropStartY, isDragging = false;
let currentCrop = { x: 0, y: 0, width: 100, height: 100 };

// Event listeners
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelect(e);
    }
});
fileInput.addEventListener('change', handleFileSelect);

cropBtn.addEventListener('click', applyCrop);
downloadBtn.addEventListener('click', downloadCroppedPDF);
resetBtn.addEventListener('click', resetCrop);

// PDF rendering functions
function renderPage(num) {
    pageRendering = true;
    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        pdfViewer.height = viewport.height;
        pdfViewer.width = viewport.width;
        
        // Update crop canvas dimensions
        cropCanvas.height = viewport.height;
        cropCanvas.width = viewport.width;
        
        // Render PDF page into canvas
        const renderContext = {
            canvasContext: pdfViewer.getContext('2d'),
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        renderTask.promise.then(function() {
            pageRendering = false;
            if (pageNumPending !== null) {
                renderPage(pageNumPending);
                pageNumPending = null;
            }
        });
    });
    
    // Update page counters
    document.getElementById('page_num').textContent = num;
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// File handling
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file');
        return;
    }
    
    const fileReader = new FileReader();
    fileReader.onload = function() {
        const typedArray = new Uint8Array(this.result);
        loadPDF(typedArray);
    };
    fileReader.readAsArrayBuffer(file);
}

function loadPDF(data) {
    pdfjsLib.getDocument(data).promise.then(function(pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('page_count').textContent = pdfDoc.numPages;
        
        // Reset crop area
        currentCrop = { x: 0, y: 0, width: pdfViewer.width, height: pdfViewer.height };
        updateCropUI();
        
        // Render first page
        renderPage(pageNum);
        
        // Enable buttons
        cropBtn.disabled = false;
        downloadBtn.disabled = false;
        resetBtn.disabled = false;
        cropControls.style.display = 'block';
        
        // Setup crop interaction
        setupCropInteraction();
    });
}

// Crop functionality
function setupCropInteraction() {
    const ctx = cropCanvas.getContext('2d');
    cropCanvas.style.display = 'block';
    
    cropCanvas.addEventListener('mousedown', (e) => {
        const rect = cropCanvas.getBoundingClientRect();
        cropStartX = e.clientX - rect.left;
        cropStartY = e.clientY - rect.top;
        isDragging = true;
        
        // Update crop position
        currentCrop.x = cropStartX;
        currentCrop.y = cropStartY;
        updateCropUI();
    });
    
    cropCanvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const rect = cropCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Update crop dimensions
        currentCrop.width = mouseX - currentCrop.x;
        currentCrop.height = mouseY - currentCrop.y;
        updateCropUI();
    });
    
    cropCanvas.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    cropCanvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });
    
    // Update from input controls
    document.getElementById('crop-left').addEventListener('input', (e) => {
        currentCrop.x = parseInt(e.target.value);
        drawCropRect();
    });
    
    document.getElementById('crop-top').addEventListener('input', (e) => {
        currentCrop.y = parseInt(e.target.value);
        drawCropRect();
    });
    
    document.getElementById('crop-width').addEventListener('input', (e) => {
        currentCrop.width = parseInt(e.target.value);
        drawCropRect();
    });
    
    document.getElementById('crop-height').addEventListener('input', (e) => {
        currentCrop.height = parseInt(e.target.value);
        drawCropRect();
    });
}

function updateCropUI() {
    document.getElementById('crop-left').value = Math.round(currentCrop.x);
    document.getElementById('crop-top').value = Math.round(currentCrop.y);
    document.getElementById('crop-width').value = Math.round(currentCrop.width);
    document.getElementById('crop-height').value = Math.round(currentCrop.height);
    drawCropRect();
}

function drawCropRect() {
    const ctx = cropCanvas.getContext('2d');
    ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    // Clear the crop area
    ctx.clearRect(currentCrop.x, currentCrop.y, currentCrop.width, currentCrop.height);
    
    // Draw crop border
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(currentCrop.x, currentCrop.y, currentCrop.width, currentCrop.height);
}

function applyCrop() {
    // In a real implementation, this would modify the PDF
    // For client-side only, we just show the cropped area
    alert('In client-side mode, we can only show the cropped area. Download will export the visible portion.');
}

async function downloadCroppedPDF() {
    // Create a new canvas with just the cropped area
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentCrop.width;
    tempCanvas.height = currentCrop.height;
    const ctx = tempCanvas.getContext('2d');
    
    // Draw the cropped portion
    ctx.drawImage(
        pdfViewer,
        currentCrop.x, currentCrop.y, currentCrop.width, currentCrop.height,
        0, 0, currentCrop.width, currentCrop.height
    );
    
    // Convert to PDF (simplified - in reality you'd use a library like jsPDF)
    const imageData = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imageData;
    link.download = 'cropped.pdf';
    link.click();
}

function resetCrop() {
    currentCrop = { x: 0, y: 0, width: pdfViewer.width, height: pdfViewer.height };
    updateCropUI();
}
