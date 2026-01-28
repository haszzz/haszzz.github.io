const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const CSVHandler = require('./utils/csvHandler');
const AudioGenerator = require('./utils/audioGenerator');

const app = express();
const PORT = process.env.PORT || 3001;

// Media directory path - use the real memrise-clone media folder
const MEDIA_DIR = '/Users/hassan/projet/memrise-clone/public/courses/media';

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fsSync.existsSync(dataDir)) {
    fsSync.mkdirSync(dataDir, { recursive: true });
}

app.use(express.json());
app.use(express.static('public'));
app.use('/media', express.static(MEDIA_DIR));

const PROGRESS_FILE = path.join(__dirname, 'data', 'progress.json');
const CSV_FILES = ['2.csv', '2s.csv', '3.csv', '4.csv'];

async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveProgress(progress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
}

app.get('/api/csv/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    if (!CSV_FILES.includes(filename)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const filePath = path.join(__dirname, filename);
    const handler = new CSVHandler(filePath);
    await handler.read();

    const progress = await loadProgress();
    const verifiedWords = progress[filename]?.verifiedWords || [];

    handler.entries.forEach(entry => {
      entry.verified = verifiedWords.includes(entry.lineNumber);
    });

    res.json({
      headers: handler.headers,
      entries: handler.entries
    });
  } catch (error) {
    console.error('Erreur lors de la lecture du CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/csv/:filename/tableaux', async (req, res) => {
  try {
    const filename = req.params.filename;
    if (!CSV_FILES.includes(filename)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const filePath = path.join(__dirname, filename);
    const handler = new CSVHandler(filePath);
    await handler.read();

    const progress = await loadProgress();
    const verifiedWords = progress[filename]?.verifiedWords || [];

    handler.entries.forEach(entry => {
      entry.verified = verifiedWords.includes(entry.lineNumber);
    });

    const grouped = handler.groupByTableau();

    res.json(Object.values(grouped));
  } catch (error) {
    console.error('Erreur lors du regroupement par tableau:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/csv/:filename/:lineNumber', async (req, res) => {
  try {
    const filename = req.params.filename;
    const lineNumber = parseInt(req.params.lineNumber);
    const updatedData = req.body;

    if (!CSV_FILES.includes(filename)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const filePath = path.join(__dirname, filename);
    const handler = new CSVHandler(filePath);
    await handler.read();

    const updatedEntry = handler.updateEntry(lineNumber, updatedData);
    if (!updatedEntry) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }

    await handler.save();

    res.json(updatedEntry);
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/csv/:filename/swap', async (req, res) => {
  try {
    const filename = req.params.filename;
    const { lineNumber1, lineNumber2 } = req.body;

    if (!CSV_FILES.includes(filename)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const filePath = path.join(__dirname, filename);
    const handler = new CSVHandler(filePath);
    await handler.read();

    const success = handler.swapEntries(lineNumber1, lineNumber2);
    if (!success) {
      return res.status(404).json({ error: 'Impossible d\'échanger les positions' });
    }

    await handler.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de l\'échange:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/csv/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const { afterLineNumber, newEntry } = req.body;

    if (!CSV_FILES.includes(filename)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const filePath = path.join(__dirname, filename);
    const handler = new CSVHandler(filePath);
    await handler.read();

    const addedEntry = handler.addEntry(afterLineNumber, newEntry);
    if (!addedEntry) {
      return res.status(404).json({ error: 'Impossible d\'ajouter l\'entrée' });
    }

    await handler.save();

    res.json(addedEntry);
  } catch (error) {
    console.error('Erreur lors de l\'ajout:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/csv/:filename/:lineNumber', async (req, res) => {
  try {
    const filename = req.params.filename;
    const lineNumber = parseInt(req.params.lineNumber);

    if (!CSV_FILES.includes(filename)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const filePath = path.join(__dirname, filename);
    const handler = new CSVHandler(filePath);
    await handler.read();

    const deleted = handler.deleteEntry(lineNumber);
    if (!deleted) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }

    await handler.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audio/test', async (req, res) => {
  try {
    const { settings } = req.body;

    // Test phrase in Arabic
    const testPhrase = 'السَّلامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكاتُهُ';

    const audioGen = new AudioGenerator(MEDIA_DIR);

    // Use a temporary folder for test audio
    const testDir = 'test';
    const result = await audioGen.generateArabicAudio(testPhrase, testDir, settings);

    res.json({
      success: true,
      audioUrl: `/media/${testDir}/${result.fileName}`,
      message: 'Audio de test généré avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la génération audio de test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/audio/regenerate', async (req, res) => {
  try {
    const { filename, lineNumber, arabicText, niveau, settings } = req.body;

    if (!CSV_FILES.includes(filename)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const audioGen = new AudioGenerator(MEDIA_DIR);
    const result = await audioGen.generateArabicAudio(arabicText, niveau, settings);

    const filePath = path.join(__dirname, filename);
    const handler = new CSVHandler(filePath);
    await handler.read();

    const updatedEntry = handler.updateEntry(lineNumber, { audio: result.fileName });
    if (!updatedEntry) {
      return res.status(404).json({ error: 'Entrée non trouvée' });
    }

    await handler.save();

    res.json({
      success: true,
      audioFile: result.fileName,
      entry: updatedEntry
    });
  } catch (error) {
    console.error('Erreur lors de la régénération audio:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/progress/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const { verifiedWords, verifiedTableaux } = req.body;

    const progress = await loadProgress();
    progress[filename] = {
      verifiedWords: verifiedWords || [],
      verifiedTableaux: verifiedTableaux || [],
      lastUpdated: new Date().toISOString()
    };

    await saveProgress(progress);

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la progression:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/progress/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const progress = await loadProgress();

    res.json(progress[filename] || {
      verifiedWords: [],
      verifiedTableaux: [],
      lastUpdated: null
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la progression:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\nServeur démarré sur http://localhost:${PORT}`);
  console.log(`Fichiers CSV disponibles: ${CSV_FILES.join(', ')}`);
  console.log(`Dossier media: ${MEDIA_DIR}`);

  // Check if media directory exists
  if (!fsSync.existsSync(MEDIA_DIR)) {
    console.log(`⚠️  ATTENTION: Le dossier media n'existe pas! Création en cours...`);
    fsSync.mkdirSync(MEDIA_DIR, { recursive: true });
    console.log(`✓ Dossier media créé: ${MEDIA_DIR}`);
  } else {
    console.log(`✓ Dossier media trouvé`);
  }

  console.log(`\nOuvrez votre navigateur à l'adresse ci-dessus pour commencer.\n`);
});
