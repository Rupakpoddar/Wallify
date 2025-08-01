class WallifyAdmin {
    constructor() {
        this.serverUrl = window.location.origin;
        this.assets = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.checkIfLocal();
        this.loadAssets();
    }
    
    checkIfLocal() {
        // Show "Reboot" and "Open Display" button on localhost and local network
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isLocalNetwork = hostname.startsWith('192.168.') ||
                              hostname.startsWith('10.') ||
                              hostname.startsWith('172.');
        
        if (isLocalhost || isLocalNetwork) {
            document.getElementById('open-display-btn').style.display = 'inline-block';
            document.getElementById('reboot-btn').style.display = 'inline-block';
        }
    }
    
    setupEventListeners() {
        // File upload
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadFiles());
        document.getElementById('file-input').addEventListener('change', (e) => {
            document.getElementById('upload-btn').textContent = `Upload (${e.target.files.length} files)`;
        });
        
        // URL add
        document.getElementById('add-url-btn').addEventListener('click', () => this.addURL());
        
        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadAssets();
            this.showToast('Dashboard refreshed', 'success');
        });
        
        // Reboot
        document.getElementById('reboot-btn').addEventListener('click', () => this.rebootSystem());
    }
    
    async uploadFiles() {
        const fileInput = document.getElementById('file-input');
        const duration = document.getElementById('file-duration').value;
        const files = fileInput.files;
        
        if (files.length === 0) {
            this.showToast('Please select files to upload', 'error');
            return;
        }
        
        let successCount = 0;
        
        for (let file of files) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('duration', duration);
            
            try {
                const response = await fetch(`${this.serverUrl}/api/assets/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) throw new Error('Upload failed');
                
                const asset = await response.json();
                successCount++;
            } catch (error) {
                this.showToast(`Failed to upload ${file.name}`, 'error');
            }
        }
        
        if (successCount > 0) {
            this.showToast(`Uploaded ${successCount} file(s) successfully`, 'success');
            fileInput.value = '';
            document.getElementById('upload-btn').textContent = 'Upload';
            this.loadAssets();
        }
    }
    
    async addURL() {
        const url = document.getElementById('url-input').value;
        const name = document.getElementById('url-name').value || 'Web URL';
        const duration = document.getElementById('url-duration').value;
        
        if (!url) {
            this.showToast('Please enter a URL', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/api/assets/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, name, duration })
            });
            
            if (!response.ok) throw new Error('Failed to add URL');
            
            this.showToast('URL added successfully', 'success');
            document.getElementById('url-input').value = '';
            document.getElementById('url-name').value = '';
            this.loadAssets();
        } catch (error) {
            this.showToast('Failed to add URL', 'error');
        }
    }
    
    async loadAssets() {
        try {
            const response = await fetch(`${this.serverUrl}/api/assets`);
            this.assets = await response.json();
            this.renderAssets();
        } catch (error) {
            this.showToast('Failed to load assets', 'error');
        }
    }
    
    renderAssets() {
        const container = document.getElementById('assets-container');
        
        if (this.assets.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No assets uploaded yet</p>';
            return;
        }
        
        // Sort assets by order
        const sortedAssets = [...this.assets].sort((a, b) => (a.order || 0) - (b.order || 0));
        
        container.innerHTML = sortedAssets.map((asset, index) => `
            <div class="asset-item ${!asset.enabled ? 'disabled' : ''}">
                ${this.getAssetPreview(asset)}
                <div class="asset-info">
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-meta">
                        Type: ${asset.type} | Duration: ${asset.duration}s | Status: ${asset.enabled ? 'Active' : 'Inactive'}
                    </div>
                </div>
                <div class="asset-actions">
                    <button class="btn btn-small" onclick="admin.moveAsset('${asset.id}', 'up')" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="btn btn-small" onclick="admin.moveAsset('${asset.id}', 'down')" ${index === sortedAssets.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="btn ${asset.enabled ? 'btn-secondary' : 'btn-primary'}" onclick="admin.toggleAsset('${asset.id}')">
                        ${asset.enabled ? 'Disable' : 'Enable'}
                    </button>
                    ${asset.type !== 'url' ? `<button class="btn btn-secondary" onclick="admin.downloadAsset('${asset.id}')">Download</button>` : ''}
                    <button class="btn btn-danger" onclick="admin.deleteAsset('${asset.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }
    
    getAssetPreview(asset) {
        switch (asset.type) {
            case 'image':
                return `<img src="${this.serverUrl}/uploads/${asset.filename}" class="asset-preview">`;
            case 'video':
                return `<video src="${this.serverUrl}/uploads/${asset.filename}" class="asset-preview"></video>`;
            case 'url':
                return `<div class="asset-preview" style="background: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px;">🌐</div>`;
        }
    }
    
    async toggleAsset(id) {
        try {
            const response = await fetch(`${this.serverUrl}/api/assets/${id}/toggle`, {
                method: 'PATCH'
            });
            
            if (!response.ok) throw new Error('Toggle failed');
            
            this.showToast('Asset status updated', 'success');
            this.loadAssets();
        } catch (error) {
            this.showToast('Failed to update asset status', 'error');
        }
    }
    
    async moveAsset(id, direction) {
        try {
            const response = await fetch(`${this.serverUrl}/api/assets/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetId: id, direction })
            });
            
            if (!response.ok) throw new Error('Reorder failed');
            
            this.loadAssets();
        } catch (error) {
            this.showToast('Failed to reorder asset', 'error');
        }
    }
    
    async downloadAsset(id) {
        const asset = this.assets.find(a => a.id === id);
        if (!asset) return;
        
        window.open(`${this.serverUrl}/api/assets/${id}/download`, '_blank');
    }
    
    async deleteAsset(id) {
        if (!confirm('Are you sure you want to delete this asset?')) return;
        
        try {
            const response = await fetch(`${this.serverUrl}/api/assets/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Delete failed');
            
            this.showToast('Asset deleted', 'success');
            this.loadAssets();
        } catch (error) {
            this.showToast('Failed to delete asset', 'error');
        }
    }
    
    async rebootSystem() {
        if (!confirm('Are you sure you want to reboot the Raspberry Pi?\n\nThe system will restart and be unavailable for about a minute.')) return;
        
        try {
            const response = await fetch(`${this.serverUrl}/api/system/reboot`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Reboot failed');
            }
            
            const result = await response.json();
            this.showToast(result.message, 'success');
            
            // Show countdown
            let countdown = 5;
            const interval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    this.showToast(`Rebooting in ${countdown} seconds...`, 'info');
                } else {
                    clearInterval(interval);
                    this.showToast('System is rebooting...', 'info');
                }
            }, 1000);
            
        } catch (error) {
            this.showToast(error.message || 'Failed to reboot system', 'error');
        }
    }
    
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize admin panel
const admin = new WallifyAdmin();
