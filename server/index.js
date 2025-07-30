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
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Serve display page
app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/display.html'));
});
app.use('/display', express.static(path.join(__dirname, '../client')));

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
    return { assets: [], schedule: [], settings: { defaultDuration: 10 } };
  }
}

async function saveDB(data) {
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

app.get('/api/schedule', async (req, res) => {
  const db = await getDB();
  res.json(db.schedule);
});

app.post('/api/schedule', async (req, res) => {
  try {
    const db = await getDB();
    const scheduleItem = {
      id: uuidv4(),
      assetId: req.body.assetId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      startTime: req.body.startTime || '00:00',
      endTime: req.body.endTime || '23:59',
      enabled: true
    };
    
    db.schedule.push(scheduleItem);
    await saveDB(db);
    res.json(scheduleItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/schedule/:id', async (req, res) => {
  try {
    const db = await getDB();
    db.schedule = db.schedule.filter(s => s.id !== req.params.id);
    await saveDB(db);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/current-playlist', async (req, res) => {
  try {
    const db = await getDB();
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Get scheduled assets for current date and time
    const scheduledAssets = db.schedule
      .filter(s => {
        if (!s.enabled) return false;
        
        // Check if current date is within range
        if (s.startDate && s.endDate) {
          const start = new Date(s.startDate + 'T00:00:00');
          const end = new Date(s.endDate + 'T23:59:59');
          const current = new Date();
          
          if (current < start || current > end) return false;
        }
        
        // Check if current time is within range
        if (s.startTime && s.endTime) {
          const [startHour, startMin] = s.startTime.split(':').map(Number);
          const [endHour, endMin] = s.endTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          
          if (currentTime < startMinutes || currentTime > endMinutes) return false;
        }
        
        return true;
      })
      .map(s => db.assets.find(a => a.id === s.assetId))
      .filter(Boolean)
      .filter(a => a.enabled); // Only show enabled assets
    
    // If we have scheduled assets, show only those
    // Otherwise, show all enabled non-scheduled assets
    let playlist = [];
    
    if (scheduledAssets.length > 0) {
      playlist = scheduledAssets;
    } else {
      // Get all assets that are enabled and not part of any schedule
      const scheduledAssetIds = db.schedule.map(s => s.assetId);
      playlist = db.assets
        .filter(a => a.enabled && !scheduledAssetIds.includes(a.id))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  await initDB();
  console.log(`Wallify server running on http://0.0.0.0:${PORT}`);
});
