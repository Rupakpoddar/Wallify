class WallifyDisplay {
    constructor() {
        this.container = document.getElementById('display-container');
        this.statusEl = document.getElementById('status');
        this.playlist = [];
        this.currentIndex = 0;
        this.refreshInterval = 60000; // Refresh playlist every minute
        this.serverUrl = window.location.origin;
        
        this.init();
    }
    
    async init() {
        await this.loadPlaylist();
        setInterval(() => this.loadPlaylist(), this.refreshInterval);
        
        // Hide cursor after 3 seconds of inactivity
        let cursorTimer;
        document.addEventListener('mousemove', () => {
            document.body.style.cursor = 'default';
            clearTimeout(cursorTimer);
            cursorTimer = setTimeout(() => {
                document.body.style.cursor = 'none';
            }, 3000);
        });
    }
    
    async loadPlaylist() {
        try {
            const response = await fetch(`${this.serverUrl}/api/current-playlist`);
            const newPlaylist = await response.json();
            
            if (JSON.stringify(newPlaylist) !== JSON.stringify(this.playlist)) {
                this.playlist = newPlaylist;
                this.currentIndex = 0;
                this.renderPlaylist();
            }
        } catch (error) {
            console.error('Failed to load playlist:', error);
            this.showStatus('Connection error', 3000);
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
}

// Initialize display when page loads
window.addEventListener('DOMContentLoaded', () => {
    new WallifyDisplay();
});
