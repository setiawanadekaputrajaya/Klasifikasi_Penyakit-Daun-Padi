import os
import numpy as np
import tensorflow as tf
from flask import Flask, request, render_template, jsonify
from werkzeug.utils import secure_filename
import cv2
import json
from datetime import datetime

app = Flask(__name__)

# ================= KONFIGURASI =================
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ============== DEFINISI CUSTOM OBJECTS ==============
# 1. Perbaiki InputLayer (untuk error batch_shape)
class FixedInputLayer(tf.keras.layers.InputLayer):
    def __init__(self, **kwargs):
        if 'batch_shape' in kwargs:
            kwargs['batch_input_shape'] = kwargs.pop('batch_shape')
        super().__init__(**kwargs)

# 2. Definisikan DTypePolicy (untuk error DTypePolicy)
class DTypePolicy:
    def __init__(self, name):
        self.name = name
    def get_config(self):
        return {'name': self.name}
    @classmethod
    def from_config(cls, config):
        return cls(config['name'])

# 3. Kumpulkan semua custom objects
custom_objects = {
    'InputLayer': FixedInputLayer,
    'DTypePolicy': DTypePolicy,
    'DTypePolicyConfig': DTypePolicy,  # untuk variasi nama
}

# ================= LOAD MODEL =================
print("Loading model...")
model_path = 'model/mobilenetv2_tb_final.h5'

try:
    # Coba load dengan custom objects yang sudah didefinisikan
    model = tf.keras.models.load_model(
        model_path, 
        compile=False,
        custom_objects=custom_objects
    )
    print("✅ Model loaded successfully with custom objects!")
except Exception as e:
    print(f"Error dengan custom objects: {e}")
    # Fallback: coba tanpa compile dan dengan scope
    with tf.keras.utils.custom_object_scope(custom_objects):
        model = tf.keras.models.load_model(model_path, compile=False)
    print("✅ Model loaded with custom_object_scope!")

# ================= LOAD CLASS INDICES =================
try:
    with open('class_indices.json', 'r') as f:
        class_indices = json.load(f)
    idx_to_class = {v: k for k, v in class_indices.items()}
    print(f"Classes: {class_indices}")
except FileNotFoundError:
    print("Warning: class_indices.json not found, using default classes")
    class_indices = {"BacterialBlight": 0, "Blast": 1, "BrownSpot": 2, "Healthy": 3, "Tungro": 4}
    idx_to_class = {v: k for k, v in class_indices.items()}

# ================= FUNGSI PREPROCESS =================
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def preprocess_image(image_path, target_size=(224, 224)):
    img = cv2.imread(image_path)
    if img is None:
        return None
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, target_size)
    img_normalized = img_resized / 255.0
    img_batch = np.expand_dims(img_normalized, axis=0)
    return img_batch

# ================= ROUTES =================
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    try:
        # Simpan file
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(filepath)
        
        # Preprocess & prediksi
        img_batch = preprocess_image(filepath)
        if img_batch is None:
            return jsonify({'error': 'Failed to process image'}), 500
        
        predictions = model.predict(img_batch, verbose=0)[0]
        predicted_idx = np.argmax(predictions)
        predicted_class = idx_to_class[predicted_idx]
        confidence = float(predictions[predicted_idx])
        
        probabilities = {idx_to_class[i]: float(prob) for i, prob in enumerate(predictions)}
        
        # Hapus file sementara
        os.remove(filepath)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'predicted_class': predicted_class,
            'confidence': confidence,
            'confidence_percentage': f"{confidence:.2%}",
            'probabilities': probabilities
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'model_loaded': True})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)