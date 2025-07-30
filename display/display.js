class WallifyDisplay {
    constructor() {
        this.container = document.getElementById('display-container');
        this.statusEl = document.getElementById('status');
        this.playlist = [];
        this.currentIndex = 0;
        this.refreshInterval = 5000; // Refresh playlist every 5 seconds
        this.serverUrl = window.location.origin;
        this.retryCount = 0;
        this.maxRetries = 10;
        
        this.init();
    }
    
    async init() {
        // Show loading status
        this.showStatus('Connecting to server...', 0);
        
        // Try to load playlist with retry logic
        await this.loadPlaylistWithRetry();
        
        // Set up periodic refresh with shorter interval for better responsiveness
        setInterval(() => this.loadPlaylist(), 5000); // Check every 5 seconds
        
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
        
        // Listen for forced refresh events
        window.addEventListener('playlist-updated', () => {
            console.log('Received playlist update signal');
            this.loadPlaylist();
        });
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
            
            const newPlaylist = await response.json();
            
            // Check if playlist has actually changed by comparing IDs and enabled status
            const currentIds = this.playlist.map(p => `${p.id}-${p.enabled}`).join(',');
            const newIds = newPlaylist.map(p => `${p.id}-${p.enabled}`).join(',');
            
            if (currentIds !== newIds || this.playlist.length !== newPlaylist.length) {
                console.log('Playlist updated, refreshing display...');
                this.playlist = newPlaylist;
                this.currentIndex = 0;
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
