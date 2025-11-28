const sections = {
  literature: ['Fiction', 'Nonfiction', 'Drama', 'Poetry', 'Film Scripts', 'Folklore', 'Other'],
  audio: ['Sound Poetry', 'Experimental Sound', 'Music', 'Podcast', 'Oral Histories', 'Other'],
  'visual art': ['Paintings', 'Photographs', 'Digital Art', 'Textile Art', 'Films', 'Sculpture', 'Other'],
  'performance art': ['Dance', 'Theatre', 'Installations', 'Other'],
  articles: ['Editorials', 'Research', 'Reviews', 'Case Studies', 'Reports', 'Opinions', 'Other']
};

const allowedTypes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'text/plain', 'application/pdf'
];

const maxFileSize = 15 * 1024 * 1024; // 15MB
let currentFilter = null;
let allMaterials = [];
let captchaAnswer = 0;

function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  captchaAnswer = num1 + num2;
  document.getElementById('captcha-question').textContent = `What is ${num1} + ${num2}?`;
}

function updateSubsections() {
  const sectionSelect = document.getElementById('section');
  const subsectionSelect = document.getElementById('subsection');
  subsectionSelect.innerHTML = '<option value="">Select Subsection</option>';
  
  const subs = sections[sectionSelect.value] || [];
  subs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.text = s;
    subsectionSelect.appendChild(opt);
  });
  
  document.getElementById('other-field').style.display = 'none';
  document.getElementById('other-subsection').value = '';
}

function toggleOtherField() {
  const subsectionSelect = document.getElementById('subsection');
  const otherField = document.getElementById('other-field');
  const otherInput = document.getElementById('other-subsection');
  
  if (subsectionSelect.value === 'Other') {
    otherField.style.display = 'block';
    otherInput.required = true;
  } else {
    otherField.style.display = 'none';
    otherInput.required = false;
    otherInput.value = '';
  }
}

function toggleUpload() {
  const modal = document.getElementById('upload-modal');
  modal.classList.toggle('active');
  if (modal.classList.contains('active')) {
    generateCaptcha();
  }
  if (!modal.classList.contains('active')) {
    document.getElementById('upload-form').reset();
    document.getElementById('progress-container').style.display = 'none';
  }
}

async function handleUpload(event) {
  event.preventDefault();
  
  const form = event.target;
  const fileInput = document.getElementById('file');
  const file = fileInput.files[0];
  
  const userAnswer = parseInt(document.getElementById('captcha-answer').value);
  if (userAnswer !== captchaAnswer) {
    alert('Incorrect answer. Please try again.');
    generateCaptcha();
    document.getElementById('captcha-answer').value = '';
    return;
  }
  
  if (!file) {
    alert('Please select a file');
    return;
  }

  if (!allowedTypes.includes(file.type)) {
    alert('Invalid file type. Allowed: images, videos, audio, PDFs, and text files');
    return;
  }

  if (file.size > maxFileSize) {
    alert('File too large. Maximum size is 15MB');
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';
  
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  progressContainer.style.display = 'block';

  try {
    const timestamp = Date.now();
    const fileName = `materials/${timestamp}_${file.name}`;
    const storageRef = window.firebaseRefs.ref(window.firebaseStorage, fileName);
    const uploadTask = window.firebaseRefs.uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        progressBar.style.width = progress + '%';
        progressBar.textContent = Math.round(progress) + '%';
      },
      (error) => {
        console.error('Upload error:', error);
        alert('Upload failed: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
        progressContainer.style.display = 'none';
      },
      async () => {
        try {
          const downloadURL = await window.firebaseRefs.getDownloadURL(uploadTask.snapshot.ref);
          
          let subsectionValue = document.getElementById('subsection').value;
          if (subsectionValue === 'Other') {
            subsectionValue = document.getElementById('other-subsection').value.trim();
          }
          
          const materialData = {
            title: document.getElementById('title').value.trim(),
            author: document.getElementById('author').value.trim(),
            description: document.getElementById('description').value.trim(),
            section: document.getElementById('section').value,
            subsection: subsectionValue,
            type: file.type,
            fileUrl: downloadURL,
            fileName: file.name,
            dateArchived: new Date().toISOString(),
            flagCount: 0,
            flaggedBy: []
          };

          await window.firebaseRefs.addDoc(window.firebaseRefs.collection(window.firebaseDb, 'materials'), materialData);
          
          // Reset UI first
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
          progressBar.style.width = '0%';
          progressBar.textContent = '0%';
          progressContainer.style.display = 'none';
          
          // Show success and close modal
          alert('Material archived successfully!');
          form.reset();
          toggleUpload();
          
          // Reload materials to show the new upload
          await loadMaterials();
        } catch (error) {
          console.error('Error saving to database:', error);
          alert('File uploaded but failed to save details. Please try again.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit';
          progressContainer.style.display = 'none';
        }
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    alert('Failed to upload material. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
    progressContainer.style.display = 'none';
  }
}

async function loadMaterials() {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  
  loading.style.display = 'block';
  content.innerHTML = '';

  try {
    const q = window.firebaseRefs.query(
      window.firebaseRefs.collection(window.firebaseDb, 'materials'),
      window.firebaseRefs.orderBy('dateArchived', 'desc')
    );
    const querySnapshot = await window.firebaseRefs.getDocs(q);
    
    const materials = [];
    querySnapshot.forEach((doc) => {
      materials.push({ id: doc.id, ...doc.data() });
    });

    allMaterials = materials;
    displayMaterials(materials);
  } catch (error) {
    console.error('Error loading materials:', error);
    allMaterials = [];
    displayMaterials([]);
  } finally {
    loading.style.display = 'none';
  }
}

function displayMaterials(materials) {
  const content = document.getElementById('content');
  const header = document.getElementById('section-header');
  
  if (currentFilter) {
    header.innerHTML = `<h2>${currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1)}</h2>`;
  } else {
    header.innerHTML = '<h2>All Materials</h2>';
  }

  if (materials.length === 0) {
    const emptyMsg = currentFilter 
      ? `No materials in ${currentFilter} yet.`
      : 'No materials archived yet.';
    content.innerHTML = `
      <div class="empty-state">
        <h3>${emptyMsg}</h3>
        <p>Be the first to preserve some!</p>
        <button onclick="toggleUpload()">Add Material</button>
      </div>
    `;
    return;
  }

  content.innerHTML = materials.map(m => createCard(m)).join('');
}

function createCard(material) {
  const date = new Date(material.dateArchived).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  let mediaHtml = '';
  if (material.type.startsWith('image/')) {
    mediaHtml = `<img src="${material.fileUrl}" alt="${escapeHtml(material.title)}">`;
  } else if (material.type.startsWith('video/')) {
    mediaHtml = `<video src="${material.fileUrl}"></video>`;
  } else if (material.type.startsWith('audio/')) {
    mediaHtml = '<div style="font-size: 4rem;">🎵</div>';
  } else if (material.type === 'application/pdf') {
    mediaHtml = '<div style="font-size: 4rem;">📄</div>';
  } else {
    mediaHtml = '<div style="font-size: 4rem;">📝</div>';
  }

  const flaggedClass = material.flagCount >= 3 ? 'flagged' : '';
  const flagWarning = material.flagCount >= 3 ? '⚠️ ' : '';

  return `
    <div class="card ${flaggedClass}" onclick="viewMaterial('${material.id}')">
      <div class="card-media">${mediaHtml}</div>
      <div class="card-body">
        <div class="card-title">${flagWarning}${escapeHtml(material.title)}</div>
        <div class="card-author">By ${escapeHtml(material.author)}</div>
        <div class="card-description">${escapeHtml(material.description)}</div>
      </div>
      <div class="card-footer">
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <span class="card-tag">${escapeHtml(material.subsection)}</span>
          <span>${date}</span>
        </div>
        <button class="flag-btn" onclick="flagMaterial(event, '${material.id}')" title="Report inappropriate content">🚩 Report</button>
      </div>
    </div>
  `;
}

async function flagMaterial(event, id) {
  event.stopPropagation();
  
  const reason = prompt('Why are you reporting this content?\n\n(e.g., "Inappropriate content", "Spam", "Copyright violation")');
  
  if (!reason || reason.trim() === '') {
    return;
  }
  
  try {
    const material = allMaterials.find(m => m.id === id);
    if (!material) return;
    
    const userFingerprint = getUserFingerprint();
    
    if (material.flaggedBy && material.flaggedBy.includes(userFingerprint)) {
      alert('You have already reported this content.');
      return;
    }
    
    material.flagCount = (material.flagCount || 0) + 1;
    material.flaggedBy = material.flaggedBy || [];
    material.flaggedBy.push(userFingerprint);
    
    const materialRef = window.firebaseRefs.doc(window.firebaseDb, 'materials', id);
    await window.firebaseRefs.updateDoc(materialRef, {
      flagCount: material.flagCount,
      flaggedBy: material.flaggedBy
    });
    
    const reportData = {
      materialId: id,
      materialTitle: material.title,
      reason: reason.trim(),
      timestamp: new Date().toISOString(),
      reporter: userFingerprint
    };
    
    await window.firebaseRefs.addDoc(window.firebaseRefs.collection(window.firebaseDb, 'reports'), reportData);
    
    alert('Thank you for your report. This content has been flagged for review.');
    await loadMaterials();
  } catch (error) {
    console.error('Error flagging material:', error);
    alert('Failed to report content. Please try again.');
  }
}

function getUserFingerprint() {
  let fingerprint = localStorage.getItem('user_fingerprint');
  if (!fingerprint) {
    fingerprint = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('user_fingerprint', fingerprint);
  }
  return fingerprint;
}

function viewMaterial(id) {
  const material = allMaterials.find(m => m.id === id);
  if (!material) return;

  let viewContent = '';
  if (material.type.startsWith('image/')) {
    viewContent = `<img src="${material.fileUrl}" style="max-width: 100%; border-radius: 8px;">`;
  } else if (material.type.startsWith('video/')) {
    viewContent = `<video src="${material.fileUrl}" controls style="max-width: 100%; border-radius: 8px;"></video>`;
  } else if (material.type.startsWith('audio/')) {
    viewContent = `<audio src="${material.fileUrl}" controls style="width: 100%;"></audio>`;
  } else if (material.type === 'application/pdf' || material.type === 'text/plain') {
    viewContent = `<a href="${material.fileUrl}" target="_blank" class="btn btn-primary" style="display: inline-block; text-decoration: none; padding: 1rem 2rem; margin: 1rem 0;">Open File</a>`;
  }

  const modal = document.createElement('div');
  modal.id = 'view-modal';
  modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 2000; align-items: center; justify-content: center; padding: 20px;';
  modal.innerHTML = `
    <div style="background: white; padding: 2rem; border-radius: 15px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto;">
      <h2 style="margin-bottom: 1rem;">${escapeHtml(material.title)}</h2>
      <p style="color: #666; margin-bottom: 0.5rem;"><strong>Author:</strong> ${escapeHtml(material.author)}</p>
      <p style="color: #666; margin-bottom: 0.5rem;"><strong>Section:</strong> ${escapeHtml(material.section)} - ${escapeHtml(material.subsection)}</p>
      <p style="color: #666; margin-bottom: 1rem;"><strong>Archived:</strong> ${new Date(material.dateArchived).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p style="margin-bottom: 1.5rem; line-height: 1.6;">${escapeHtml(material.description)}</p>
      ${viewContent}
      <button onclick="document.getElementById('view-modal').remove()" style="width: 100%; margin-top: 1.5rem; padding: 1rem; background: #ccc; border: none; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer;">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function filterSection(section) {
  currentFilter = section;
  const filtered = allMaterials.filter(m => m.section === section);
  displayMaterials(filtered);
}

function showHome() {
  currentFilter = null;
  displayMaterials(allMaterials);
}

function performSearch() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  
  if (!query) {
    displayMaterials(allMaterials);
    return;
  }

  const results = allMaterials.filter(m => 
    m.title.toLowerCase().includes(query) ||
    m.author.toLowerCase().includes(query) ||
    m.subsection.toLowerCase().includes(query) ||
    m.description.toLowerCase().includes(query)
  );

  currentFilter = null;
  document.getElementById('section-header').innerHTML = `<h2>Search Results: "${escapeHtml(query)}"</h2>`;
  displayMaterials(results);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
document.getElementById('search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') performSearch();
});

// Wait for Firebase to initialize then load materials
const checkFirebase = setInterval(() => {
  if (window.firebaseDb && window.firebaseStorage) {
    clearInterval(checkFirebase);
    loadMaterials();
  }
}, 100);

function showCodeOfConduct(event) {
  event.preventDefault();
  const modal = document.getElementById('conduct-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeCodeOfConduct() {
  const modal = document.getElementById('conduct-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function showAbout(event) {
  event.preventDefault();
  const modal = document.getElementById('about-modal');
  if (modal) {
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 3000; padding: 20px; overflow-y: auto; align-items: flex-start; justify-content: center;';
  }
}

function closeAbout() {
  const modal = document.getElementById('about-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}
