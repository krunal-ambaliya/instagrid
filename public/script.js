class InstagramGridPreview {
    constructor() {
        this.images = [];
        this.currentModalImage = null;
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
        this.observer = null;
        this.initializeElements();
        this.setupEventListeners();
        this.setupIntersectionObserver();
        this.loadImages();
    }

    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.instagramGrid = document.getElementById('instagramGrid');
        this.imageModal = document.getElementById('imageModal');
        this.modalImage = document.getElementById('modalImage');
        this.closeModal = document.getElementById('closeModal');
        this.modalDeleteBtn = document.getElementById('modalDeleteBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
    }

    setupEventListeners() {
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        // Click to upload
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Modal events
        this.closeModal.addEventListener('click', () => {
            this.closeImageModal();
        });

        this.imageModal.addEventListener('click', (e) => {
            if (e.target === this.imageModal) {
                this.closeImageModal();
            }
        });

        this.modalDeleteBtn.addEventListener('click', () => {
            if (this.currentModalImage) {
                this.deleteImage(this.currentModalImage);
                this.closeImageModal();
            }
        });

        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeImageModal();
            }
        });
    }

    async handleFiles(files) {
        const mediaFiles = Array.from(files).filter(file => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
            return isImage || isVideo || isHeic;
        });

        if (mediaFiles.length === 0) {
            alert('Please select valid image or video files');
            return;
        }

        for (let i = 0; i < mediaFiles.length; i++) {
            await this.uploadFile(mediaFiles[i], i + 1, mediaFiles.length);
        }

        this.loadImages(true);
    }

    async uploadFile(file, current, total) {
        const formData = new FormData();
        formData.append('image', file);

        this.showProgress(current, total);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            console.log('Uploaded:', result);

        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload: ' + file.name);
        }

        if (current === total) {
            this.hideProgress();
        }
    }

    showProgress(current, total) {
        this.uploadProgress.style.display = 'block';
        const percentage = (current / total) * 100;
        this.progressFill.style.width = percentage + '%';
        this.progressText.textContent = `Uploading ${current} of ${total} files...`;
    }

    hideProgress() {
        setTimeout(() => {
            this.uploadProgress.style.display = 'none';
            this.progressFill.style.width = '0%';
        }, 1000);
    }

    setupIntersectionObserver() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.onload = () => {
                            img.classList.add('loaded');
                        };
                        img.onerror = () => {
                            img.style.background = '#f0f0f0';
                            img.alt = 'Failed to load';
                        };
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        this.observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '100px'
        });
    }

    async loadImages(reset = false) {
        if (this.isLoading || (!this.hasMore && !reset)) return;
        
        this.isLoading = true;
        this.showLoading();
        
        if (reset) {
            this.currentPage = 1;
            this.images = [];
            this.hasMore = true;
            this.instagramGrid.innerHTML = '';
        }
        
        try {
            const response = await fetch(`/api/images?page=${this.currentPage}&limit=20`);
            const data = await response.json();
            
            if (reset) {
                this.images = data.files;
            } else {
                this.images = [...this.images, ...data.files];
            }
            
            this.hasMore = data.pagination.hasMore;
            this.currentPage++;
            
            this.renderGrid(reset);
        } catch (error) {
            console.error('Failed to load images:', error);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    showLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'block';
        }
    }

    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    async loadMoreImages() {
        if (!this.hasMore || this.isLoading) return;
        await this.loadImages(false);
    }

    renderGrid(reset = false) {
        if (reset) {
            this.instagramGrid.innerHTML = '';
        }

        const startIndex = reset ? 0 : this.instagramGrid.children.length;
        const newImages = this.images.slice(startIndex);

        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        newImages.forEach((image, index) => {
            const gridItem = this.createGridItem(image, startIndex + index);
            fragment.appendChild(gridItem);
        });
        
        this.instagramGrid.appendChild(fragment);
        
        // Add load more trigger if there are more images
        if (this.hasMore && !document.getElementById('loadMoreTrigger')) {
            this.addLoadMoreTrigger();
        }
    }

    addLoadMoreTrigger() {
        const trigger = document.createElement('div');
        trigger.id = 'loadMoreTrigger';
        trigger.style.height = '1px';
        trigger.style.gridColumn = '1 / -1';
        this.instagramGrid.appendChild(trigger);
        
        const triggerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadMoreImages();
                }
            });
        }, {
            rootMargin: '100px'
        });
        
        triggerObserver.observe(trigger);
    }

    createGridItem(media, index) {
        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        
        let mediaElement = '';
        let indicator = '';
        let thumbnailUrl = media.thumbnailUrl;
        
        // Fallback to original if no thumbnail
        if (!thumbnailUrl) {
            thumbnailUrl = media.url;
        }
        
        if (media.type === 'video') {
            mediaElement = `<img data-src="${thumbnailUrl}" alt="Video thumbnail ${index + 1}" class="lazy-load">`;
            indicator = '<div class="media-indicator video-indicator">📹 VIDEO</div>';
        } else if (media.type === 'heic') {
            mediaElement = `<img data-src="${thumbnailUrl}" alt="HEIC image ${index + 1}" class="lazy-load">`;
            indicator = '<div class="media-indicator heic-indicator">📷 HEIC</div>';
        } else {
            mediaElement = `<img data-src="${thumbnailUrl}" alt="Instagram post ${index + 1}" class="lazy-load">`;
        }
        
        gridItem.innerHTML = `
            ${mediaElement}
            ${indicator}
            <div class="overlay">
                <div class="overlay-actions">
                    <button class="action-btn view-btn" title="View full size">👁️</button>
                    <button class="action-btn delete-btn" title="Delete">🗑️</button>
                </div>
            </div>
        `;

        // Setup lazy loading
        const img = gridItem.querySelector('img');
        this.observer.observe(img);

        // View full size
        gridItem.querySelector('.view-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openImageModal(media);
        });

        // Delete media
        gridItem.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteImage(media.filename);
        });

        // Click on media to view full size
        img.addEventListener('click', () => {
            this.openImageModal(media);
        });

        return gridItem;
    }

    openImageModal(media) {
        this.currentModalImage = media.filename;
        
        // Clear previous content
        const modalContent = this.imageModal.querySelector('.modal-content');
        const existingMedia = modalContent.querySelector('img, video');
        if (existingMedia) {
            existingMedia.remove();
        }
        
        let mediaElement;
        if (media.type === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.src = media.url;
            mediaElement.controls = true;
            mediaElement.autoplay = false;
            mediaElement.style.maxWidth = '100%';
            mediaElement.style.maxHeight = '80vh';
            mediaElement.style.objectFit = 'contain';
            mediaElement.style.borderRadius = '10px';
        } else {
            mediaElement = document.createElement('img');
            mediaElement.src = media.url;
            mediaElement.style.maxWidth = '100%';
            mediaElement.style.maxHeight = '80vh';
            mediaElement.style.objectFit = 'contain';
            mediaElement.style.borderRadius = '10px';
        }
        
        // Insert media element before modal actions
        const modalActions = modalContent.querySelector('.modal-actions');
        modalContent.insertBefore(mediaElement, modalActions);
        
        this.imageModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeImageModal() {
        this.imageModal.style.display = 'none';
        this.currentModalImage = null;
        document.body.style.overflow = 'auto';
    }

    async deleteImage(filename) {
        if (!confirm('Are you sure you want to delete this image?')) {
            return;
        }

        try {
            const response = await fetch(`/api/images/${filename}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.loadImages(true); // Reload the grid from beginning
            } else {
                alert('Failed to delete image');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete image');
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InstagramGridPreview();
});