class WallifyAdmin {
    constructor() {
        this.serverUrl = window.location.origin;
        this.assets = [];
        this.schedules = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadAssets();
        this.loadSchedules();
    }
    
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                
                e.target.classList.add('active');
                const tabId = e.target.dataset.tab + '-tab';
                document.getElementById(tabId).classList.add('active');
            });
        });
        
        // File upload
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadFiles());
        document.getElementById('file-input').addEventListener('change', (e) => {
            document.getElementById('upload-btn').textContent = `Upload (${e.target.files.length} files)`;
        });
        
        // URL add
        document.getElementById('add-url-btn').addEventListener('click', () => this.addURL());
        
        // Schedule
        document.getElementById('add-schedule-btn').addEventListener('click', () => this.addSchedule());
        
        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadAssets();
            this.loadSchedules();
            this.showToast('Refreshed', 'success');
        });
    }
    
    async uploadFiles() {
        const fileInput = document.getElementById('file-input');
        const duration = document.getElementById('file-duration').value;
        const files = fileInput.files;
        
        if (files.length === 0) {
            this.showToast('Please select files to upload', 'error');
            return;
        }
        
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
                this.showToast(`Uploaded ${file.name}`, 'success');
            } catch (error) {
                this.showToast(`Failed to upload ${file.name}`, 'error');
            }
        }
        
        fileInput.value = '';
        document.getElementById('upload-btn').textContent = 'Upload';
        this.loadAssets();
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
            this.updateAssetSelector();
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
        
        container.innerHTML = this.assets.map(asset => `
            <div class="asset-item">
                ${this.getAssetPreview(asset)}
                <div class="asset-info">
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-meta">
                        Type: ${asset.type} | Duration: ${asset.duration}s
                    </div>
                </div>
                <div class="asset-actions">
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
    
    updateAssetSelector() {
        const selector = document.getElementById('schedule-asset');
        selector.innerHTML = this.assets.map(asset => 
            `<option value="${asset.id}">${asset.name}</option>`
        ).join('');
    }
    
    async addSchedule() {
        const assetId = document.getElementById('schedule-asset').value;
        const startTime = document.getElementById('schedule-start').value;
        const endTime = document.getElementById('schedule-end').value;
        const days = Array.from(document.querySelectorAll('.days-selector input:checked'))
            .map(cb => cb.value);
        
        if (!assetId || days.length === 0) {
            this.showToast('Please select an asset and at least one day', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/api/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetId, startTime, endTime, days })
            });
            
            if (!response.ok) throw new Error('Failed to create schedule');
            
            this.showToast('Schedule created', 'success');
            this.loadSchedules();
        } catch (error) {
            this.showToast('Failed to create schedule', 'error');
        }
    }
    
    async loadSchedules() {
        try {
            const response = await fetch(`${this.serverUrl}/api/schedule`);
            this.schedules = await response.json();
            this.renderSchedules();
        } catch (error) {
            this.showToast('Failed to load schedules', 'error');
        }
    }
    
    renderSchedules() {
        const container = document.getElementById('schedule-container');
        
        if (this.schedules.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No schedules created yet</p>';
            return;
        }
        
        container.innerHTML = this.schedules.map(schedule => {
            const asset = this.assets.find(a => a.id === schedule.assetId);
            return `
                <div class="schedule-item">
                    <div class="asset-info">
                        <div class="asset-name">${asset ? asset.name : 'Unknown Asset'}</div>
                        <div class="asset-meta">
                            ${schedule.startTime} - ${schedule.endTime} | 
                            ${schedule.days.join(', ').toUpperCase()}
                        </div>
                    </div>
                    <div class="asset-actions">
                        <button class="btn btn-danger" onclick="admin.deleteSchedule('${schedule.id}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    async deleteSchedule(id) {
        if (!confirm('Are you sure you want to delete this schedule?')) return;
        
        try {
            const response = await fetch(`${this.serverUrl}/api/schedule/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Delete failed');
            
            this.showToast('Schedule deleted', 'success');
            this.loadSchedules();
        } catch (error) {
            this.showToast('Failed to delete schedule', 'error');
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
