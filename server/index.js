const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/dashboard', express.static(path.join(__dirname, '../dashboard')));

// Serve static files for display
app.use('/display', express.static(path.join(__dirname, '../display')));

// Serve display page
app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, '../display/display.html'));
});

// Serve dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// Redirect root to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Reboot endpoint (only works on local network)
app.post('/api/system/reboot', async (req, res) => {
  try {
    // Check if request is from local network
    const ip = req.ip || req.connection.remoteAddress || '';
    const cleanIp = ip.replace('::ffff:', '');
    
    const isLocal = cleanIp === '::1' || 
                   cleanIp === '127.0.0.1' || 
                   cleanIp.startsWith('192.168.') ||
                   cleanIp.startsWith('10.') ||
                   cleanIp.startsWith('172.');
    
    if (!isLocal) {
      return res.status(403).json({ error: 'Reboot only allowed from local network' });
    }
    
    res.json({ message: 'System rebooting in 5 seconds...' });
    
    // Give time for response to be sent
    setTimeout(() => {
      require('child_process').exec('sudo reboot', (error) => {
        if (error) console.error('Reboot failed:', error);
      });
    }, 5000);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Storage configuration
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|ogg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Database (using JSON file for simplicity)
const DB_FILE = './database.json';

async function getDB() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { assets: [], settings: { defaultDuration: 10 }, version: Date.now() };
  }
}

async function saveDB(data) {
  // Update version timestamp whenever database changes
  data.version = Date.now();
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// Initialize database
async function initDB() {
  const db = await getDB();
  await saveDB(db);
}

// Routes
app.get('/api/assets', async (req, res) => {
  const db = await getDB();
  // Set headers to prevent caching
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.json(db.assets);
});

app.post('/api/assets/upload', upload.single('file'), async (req, res) => {
  try {
    const db = await getDB();
    const asset = {
      id: uuidv4(),
      name: req.file.originalname,
      filename: req.file.filename,
      type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
      duration: parseInt(req.body.duration) || 10,
      enabled: true,
      order: db.assets.length,
      created: new Date().toISOString()
    };
    
    db.assets.push(asset);
    await saveDB(db);
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/assets/url', async (req, res) => {
  try {
    const db = await getDB();
    const asset = {
      id: uuidv4(),
      name: req.body.name || 'Web URL',
      url: req.body.url,
      type: 'url',
      duration: parseInt(req.body.duration) || 30,
      enabled: true,
      order: db.assets.length,
      created: new Date().toISOString()
    };
    
    db.assets.push(asset);
    await saveDB(db);
    res.json(asset);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/assets/:id', async (req, res) => {
  try {
    const db = await getDB();
    const assetIndex = db.assets.findIndex(a => a.id === req.params.id);
    
    if (assetIndex !== -1) {
      const asset = db.assets[assetIndex];
      if (asset.filename) {
        await fs.unlink(path.join('./uploads', asset.filename)).catch(() => {});
      }
      db.assets.splice(assetIndex, 1);
      // Reorder remaining assets
      db.assets.forEach((a, i) => a.order = i);
      await saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Asset not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/assets/:id/toggle', async (req, res) => {
  try {
    const db = await getDB();
    const asset = db.assets.find(a => a.id === req.params.id);
    
    if (asset) {
      asset.enabled = !asset.enabled;
      await saveDB(db);
      res.json(asset);
    } else {
      res.status(404).json({ error: 'Asset not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assets/reorder', async (req, res) => {
  try {
    const db = await getDB();
    const { assetId, direction } = req.body;
    const assetIndex = db.assets.findIndex(a => a.id === assetId);
    
    if (assetIndex === -1) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    const newIndex = direction === 'up' ? assetIndex - 1 : assetIndex + 1;
    
    if (newIndex < 0 || newIndex >= db.assets.length) {
      return res.status(400).json({ error: 'Cannot move asset' });
    }
    
    // Swap assets
    [db.assets[assetIndex], db.assets[newIndex]] = [db.assets[newIndex], db.assets[assetIndex]];
    
    // Update order values
    db.assets.forEach((a, i) => a.order = i);
    
    await saveDB(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/assets/:id/download', async (req, res) => {
  try {
    const db = await getDB();
    const asset = db.assets.find(a => a.id === req.params.id);
    
    if (!asset || !asset.filename) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    const filePath = path.join('./uploads', asset.filename);
    res.download(filePath, asset.name);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/current-playlist', async (req, res) => {
  try {
    const db = await getDB();
    
    // Return all enabled assets sorted by order
    const playlist = db.assets
      .filter(a => a.enabled)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Set headers to prevent caching
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Include version for change detection
    res.json({
      version: db.version || Date.now(),
      playlist: playlist
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Version check endpoint
app.get('/api/version', async (req, res) => {
  try {
    const db = await getDB();
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.json({ version: db.version || Date.now() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  await initDB();
  console.log(`Wallify server running on http://0.0.0.0:${PORT}`);
});
