const fileInput = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const predictBtn = document.getElementById('predictBtn');
const loading = document.getElementById('loading');
const resultContainer = document.getElementById('resultContainer');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const predictionBadge = document.getElementById('predictionBadge');
const confidenceBar = document.getElementById('confidenceBar');
const confidenceText = document.getElementById('confidenceText');
const probabilitiesContainer = document.getElementById('probabilitiesContainer');
const predictionIcon = document.getElementById('predictionIcon');

const allowedExtensions = ['jpg', 'jpeg', 'png'];
const maxFileSize = 16 * 1024 * 1024;

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);

// Drag and drop
const uploadArea = document.querySelector('.upload-area');
if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#11998e';
        uploadArea.style.background = 'rgba(17, 153, 142, 0.05)';
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.background = '#fafafa';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#ddd';
        uploadArea.style.background = '#fafafa';
        
        const file = e.dataTransfer.files[0];
        if (file) {
            validateAndPreview(file);
            fileInput.files = e.dataTransfer.files;
        }
    });
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        validateAndPreview(file);
    }
}

function validateAndPreview(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        showError('Format file tidak didukung. Gunakan JPG, JPEG, atau PNG.');
        return;
    }
    
    if (file.size > maxFileSize) {
        showError('Ukuran file terlalu besar. Maksimal 16MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        imagePreview.src = e.target.result;
        previewContainer.style.display = 'block';
        predictBtn.disabled = false;
        resultContainer.style.display = 'none';
        errorMessage.style.display = 'none';
        
        // Scroll ke preview
        previewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    fileInput.value = '';
    previewContainer.style.display = 'none';
    predictBtn.disabled = true;
    resultContainer.style.display = 'none';
    imagePreview.src = '';
}

async function predictImage() {
    const file = fileInput.files[0];
    if (!file) {
        showError('Silakan pilih gambar terlebih dahulu.');
        return;
    }
    
    loading.style.display = 'block';
    resultContainer.style.display = 'none';
    errorMessage.style.display = 'none';
    predictBtn.disabled = true;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/predict', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        loading.style.display = 'none';
        predictBtn.disabled = false;
        
        if (data.success) {
            displayResults(data);
        } else {
            showError(data.error || 'Prediksi gagal. Silakan coba lagi.');
        }
    } catch (error) {
        console.error('Error:', error);
        loading.style.display = 'none';
        predictBtn.disabled = false;
        showError('Koneksi error. Periksa koneksi internet Anda.');
    }
}

function displayResults(data) {
    const className = data.predicted_class;
    predictionBadge.textContent = className;
    
    // Update icon based on prediction
    if (className.toLowerCase().includes('healthy')) {
        predictionIcon.style.background = 'linear-gradient(135deg, #10b981, #34d399)';
        predictionIcon.style.webkitBackgroundClip = 'unset';
        predictionIcon.style.webkitTextFillColor = 'white';
    } else {
        predictionIcon.style.background = 'linear-gradient(135deg, #ef4444, #f87171)';
        predictionIcon.style.webkitBackgroundClip = 'unset';
        predictionIcon.style.webkitTextFillColor = 'white';
    }
    
    const confidencePercent = data.confidence * 100;
    confidenceBar.style.width = confidencePercent + '%';
    confidenceText.textContent = confidencePercent.toFixed(1) + '%';
    
    let probabilitiesHtml = '';
    const sortedProbabilities = Object.entries(data.probabilities)
        .sort((a, b) => b[1] - a[1]);
    
    for (const [className, prob] of sortedProbabilities) {
        const probPercent = prob * 100;
        probabilitiesHtml += `
            <div class="probability-item">
                <span>${className}</span>
                <div class="probability-bar">
                    <div class="probability-fill" style="width: ${probPercent}%"></div>
                </div>
                <span>${probPercent.toFixed(1)}%</span>
            </div>
        `;
    }
    probabilitiesContainer.innerHTML = probabilitiesHtml;
    
    resultContainer.style.display = 'block';
    
    // Scroll to results
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
    resultContainer.style.display = 'none';
    
    setTimeout(() => {
        if (errorMessage.style.display === 'block') {
            errorMessage.style.display = 'none';
        }
    }, 5000);
}

async function checkHealth() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        if (data.status === 'healthy') {
            console.log('✅ Backend is healthy');
        }
    } catch (error) {
        console.error('❌ Cannot connect to backend:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkHealth();
    console.log('AgriScan AI Ready!');
});