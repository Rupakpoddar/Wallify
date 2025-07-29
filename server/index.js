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
      await saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Asset not found' });
    }
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
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      days: req.body.days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
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
    const currentDay = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Get scheduled assets for current time
    const scheduledAssets = db.schedule
      .filter(s => {
        if (!s.enabled || !s.days.includes(currentDay)) return false;
        
        const [startHour, startMin] = s.startTime.split(':').map(Number);
        const [endHour, endMin] = s.endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        return currentTime >= startMinutes && currentTime <= endMinutes;
      })
      .map(s => db.assets.find(a => a.id === s.assetId))
      .filter(Boolean);
    
    // If no scheduled assets, return all assets
    const playlist = scheduledAssets.length > 0 ? scheduledAssets : db.assets;
    
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
