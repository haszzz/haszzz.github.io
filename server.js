const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const CSVHandler = require('./utils/csvHandler');
const AudioGenerator = require('./utils/audioGenerator');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static('public'));
app.use('/media', express.static('media'));

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

app.post('/api/audio/regenerate', async (req, res) => {
  try {
    const { filename, lineNumber, arabicText, niveau } = req.body;

    if (!CSV_FILES.includes(filename)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const audioGen = new AudioGenerator(path.join(__dirname, 'media'));
    const result = await audioGen.generateArabicAudio(arabicText, niveau);

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
  console.log(`\nOuvrez votre navigateur à l'adresse ci-dessus pour commencer.\n`);
});
