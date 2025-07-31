class WallifyDisplay {
    constructor() {
        this.container = document.getElementById('display-container');
        this.statusEl = document.getElementById('status');
        this.playlist = [];
        this.currentIndex = 0;
        this.versionCheckInterval = 3000; // Check version every 3 seconds
        this.serverUrl = window.location.origin;
        this.retryCount = 0;
        this.maxRetries = 10;
        this.currentVersion = null;
        
        // Version-based refresh: The display checks for version changes every 3 seconds
        // When assets are added/removed/modified, the server updates the version
        // If version changes, the display does a full page reload for clean state
        
        this.init();
    }
    
    async init() {
        // Show loading status
        this.showStatus('Connecting to server...', 0);
        
        // Try to load playlist with retry logic
        await this.loadPlaylistWithRetry();
        
        // Start version checking for updates
        setInterval(() => this.checkForUpdates(), this.versionCheckInterval);
        
        // Hide cursor after 3 seconds of inactivity
        let cursorTimer;
        document.addEventListener('mousemove', () => {
            document.body.style.cursor = 'default';
            clearTimeout(cursorTimer);
            cursorTimer = setTimeout(() => {
                document.body.style.cursor = 'none';
            }, 3000);
        });
        
        // Initially hide cursor
        setTimeout(() => {
            document.body.style.cursor = 'none';
        }, 3000);
    }
    
    async checkForUpdates() {
        try {
            const response = await fetch(`${this.serverUrl}/api/version?t=${Date.now()}`);
            if (!response.ok) return;
            
            const data = await response.json();
            
            if (this.currentVersion !== null && data.version !== this.currentVersion) {
                console.log('Playlist version changed, reloading page...');
                // Force a complete page reload to ensure clean state
                // This prevents issues with frozen videos and ensures all assets load fresh
                window.location.reload(true);
            }
            
            this.currentVersion = data.version;
        } catch (error) {
            console.error('Version check failed:', error);
        }
    }
    
    async loadPlaylistWithRetry() {
        while (this.retryCount < this.maxRetries) {
            try {
                await this.loadPlaylist();
                this.retryCount = 0;
                this.hideStatus();
                return;
            } catch (error) {
                this.retryCount++;
                console.error(`Failed to load playlist (attempt ${this.retryCount}/${this.maxRetries}):`, error);
                this.showStatus(`Retrying connection... (${this.retryCount}/${this.maxRetries})`, 0);
                
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, this.retryCount - 1), 10000)));
            }
        }
        
        this.showStatus('Failed to connect to server. Please check server status.', 0);
    }
    
    async loadPlaylist() {
        try {
            // Add timestamp to prevent caching
            const timestamp = Date.now();
            const response = await fetch(`${this.serverUrl}/api/current-playlist?t=${timestamp}`);
            if (!response.ok) throw new Error('Failed to fetch playlist');
            
            const data = await response.json();
            
            // Update version
            this.currentVersion = data.version;
            
            // Update playlist
            this.playlist = data.playlist || [];
            
            // Only re-render if we're just starting (no current display)
            if (this.currentIndex === 0 && this.container.querySelectorAll('.asset-item').length === 0) {
                this.renderPlaylist();
            }
        } catch (error) {
            console.error('Failed to load playlist:', error);
            throw error; // Re-throw for retry logic
        }
    }
    
    renderPlaylist() {
        if (this.playlist.length === 0) {
            document.getElementById('no-content').style.display = 'flex';
            return;
        }
        
        document.getElementById('no-content').style.display = 'none';
        
        // Clean up any existing assets before re-rendering
        const existingAssets = this.container.querySelectorAll('.asset-item');
        existingAssets.forEach(asset => {
            const video = asset.querySelector('video');
            if (video) {
                video.pause();
                video.src = '';
                video.load();
            }
        });
        
        this.container.innerHTML = '';
        
        this.playlist.forEach((asset, index) => {
            const element = this.createAssetElement(asset);
            element.classList.add('asset-item');
            if (index === 0) element.classList.add('active');
            this.container.appendChild(element);
        });
        
        this.startRotation();
    }
    
    createAssetElement(asset) {
        const wrapper = document.createElement('div');
        wrapper.dataset.duration = asset.duration;
        
        switch (asset.type) {
            case 'image':
                const img = document.createElement('img');
                img.src = `${this.serverUrl}/uploads/${asset.filename}`;
                img.onerror = () => this.handleAssetError(asset);
                wrapper.appendChild(img);
                break;
                
            case 'video':
                const video = document.createElement('video');
                video.src = `${this.serverUrl}/uploads/${asset.filename}`;
                video.autoplay = true;
                video.muted = true;
                video.loop = false;
                video.onerror = () => this.handleAssetError(asset);
                wrapper.appendChild(video);
                break;
                
            case 'url':
                const iframe = document.createElement('iframe');
                iframe.src = asset.url;
                iframe.setAttribute('allow', 'autoplay; fullscreen');
                wrapper.appendChild(iframe);
                break;
        }
        
        return wrapper;
    }
    
    startRotation() {
        if (this.rotationTimer) clearTimeout(this.rotationTimer);
        
        const assets = this.container.querySelectorAll('.asset-item');
        if (assets.length === 0) return;
        
        const currentAsset = assets[this.currentIndex];
        const asset = this.playlist[this.currentIndex];
        
        let duration = asset.duration * 1000;
        
        if (asset.type === 'video') {
            const video = currentAsset.querySelector('video');
            if (video) {
                video.play().catch(e => console.error('Video play failed:', e));
                video.onended = () => this.nextAsset();
                return;
            }
        }
        
        this.rotationTimer = setTimeout(() => this.nextAsset(), duration);
    }
    
    nextAsset() {
        const assets = this.container.querySelectorAll('.asset-item');
        if (assets.length === 0) return;
        
        assets[this.currentIndex].classList.remove('active');
        this.currentIndex = (this.currentIndex + 1) % assets.length;
        assets[this.currentIndex].classList.add('active');
        
        this.startRotation();
    }
    
    handleAssetError(asset) {
        console.error('Failed to load asset:', asset);
        this.showStatus(`Error loading ${asset.name}`, 3000);
        this.nextAsset();
    }
    
    showStatus(message, duration = 0) {
        this.statusEl.textContent = message;
        this.statusEl.style.display = 'block';
        
        if (duration > 0) {
            setTimeout(() => {
                this.statusEl.style.display = 'none';
            }, duration);
        }
    }
    
    hideStatus() {
        this.statusEl.style.display = 'none';
    }
}

// Initialize display when page loads
window.addEventListener('DOMContentLoaded', () => {
    new WallifyDisplay();
});
