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
            // Trigger display refresh
            this.triggerDisplayRefresh();
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
            this.triggerDisplayRefresh();
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
            this.triggerDisplayRefresh();
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
            this.triggerDisplayRefresh();
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
            this.triggerDisplayRefresh();
        } catch (error) {
            this.showToast('Failed to reorder asset', 'error');
        }
    }
    
    triggerDisplayRefresh() {
        // Force display to refresh by making a request to the playlist endpoint
        // This will trigger the display's next refresh cycle
        fetch(`${this.serverUrl}/api/current-playlist`).catch(() => {});
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
            this.triggerDisplayRefresh();
        } catch (error) {
            this.showToast('Failed to delete asset', 'error');
        }
    }
    
    updateAssetSelector() {
        const selector = document.getElementById('schedule-asset');
        const enabledAssets = this.assets.filter(asset => asset.enabled);
        
        if (enabledAssets.length === 0) {
            selector.innerHTML = '<option value="">No active assets available</option>';
            return;
        }
        
        selector.innerHTML = enabledAssets.map(asset => 
            `<option value="${asset.id}">${asset.name}</option>`
        ).join('');
    }
    
    async addSchedule() {
        const assetId = document.getElementById('schedule-asset').value;
        const startDateInput = document.getElementById('schedule-start-date').value;
        const endDateInput = document.getElementById('schedule-end-date').value;
        const startTime = document.getElementById('schedule-start-time').value;
        const endTime = document.getElementById('schedule-end-time').value;
        
        if (!assetId || !startDateInput || !endDateInput) {
            this.showToast('Please select an asset and date range', 'error');
            return;
        }
        
        // Use the date strings directly without timezone conversion
        const startDate = startDateInput;
        const endDate = endDateInput;
        
        // Validate date range
        if (new Date(startDate) > new Date(endDate)) {
            this.showToast('End date must be after start date', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.serverUrl}/api/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetId, startDate, endDate, startTime, endTime })
            });
            
            if (!response.ok) throw new Error('Failed to create schedule');
            
            this.showToast('Schedule created', 'success');
            this.loadSchedules();
            this.triggerDisplayRefresh();
            
            // Reset form
            document.getElementById('schedule-start-date').value = '';
            document.getElementById('schedule-end-date').value = '';
            document.getElementById('schedule-start-time').value = '00:00';
            document.getElementById('schedule-end-time').value = '23:59';
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
            
            // Format dates properly
            const formatDate = (dateStr) => {
                const date = new Date(dateStr + 'T00:00:00');
                return date.toLocaleDateString();
            };
            
            return `
                <div class="schedule-item">
                    <div class="asset-info">
                        <div class="asset-name">${asset ? asset.name : 'Unknown Asset'}</div>
                        <div class="asset-meta">
                            ${formatDate(schedule.startDate)} - ${formatDate(schedule.endDate)} | 
                            ${schedule.startTime} - ${schedule.endTime}
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
            this.triggerDisplayRefresh();
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
