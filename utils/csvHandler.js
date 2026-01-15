const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class CSVHandler {
  constructor(filePath) {
    this.filePath = filePath;
    this.headers = [];
    this.entries = [];
  }

  async read() {
    return new Promise((resolve, reject) => {
      const entries = [];
      const headers = [];
      let lineNumber = 0;

      fs.createReadStream(this.filePath, { encoding: 'utf8' })
        .on('data', (chunk) => {
          const lines = chunk.split('\n');
          lines.forEach((line, index) => {
            if (lineNumber < 3 && line.trim().startsWith('#')) {
              headers.push(line);
            }
            lineNumber++;
          });
        })
        .pipe(csv({
          skipLines: 3,
          headers: ['arabic', 'french', 'audio', 'tags']
        }))
        .on('data', (row) => {
          if (row.arabic.startsWith('#') || !row.arabic.trim()) {
            return;
          }

          const audioMatch = row.audio.match(/\[sound:(.+?)\]/);
          const audioFile = audioMatch ? audioMatch[1] : '';

          const tableauMatch = row.tags.match(/::(\d+_Tableau_[\d-]+)/);
          const tableauNumber = tableauMatch ? tableauMatch[1] : 'Unknown';

          entries.push({
            lineNumber: entries.length + 4,
            arabic: row.arabic,
            french: row.french,
            audio: audioFile,
            audioRaw: row.audio,
            tags: row.tags,
            tableauNumber: tableauNumber,
            verified: false
          });
        })
        .on('end', () => {
          this.headers = headers;
          this.entries = entries;
          resolve({ headers, entries });
        })
        .on('error', reject);
    });
  }

  groupByTableau() {
    const grouped = {};

    this.entries.forEach(entry => {
      const tableau = entry.tableauNumber;
      if (!grouped[tableau]) {
        grouped[tableau] = {
          tableau: tableau,
          words: [],
          totalWords: 0,
          verifiedWords: 0,
          percentComplete: 0,
          firstLine: entry.lineNumber,
          lastLine: entry.lineNumber
        };
      }

      grouped[tableau].words.push(entry);
      grouped[tableau].totalWords++;
      grouped[tableau].lastLine = entry.lineNumber;
      if (entry.verified) {
        grouped[tableau].verifiedWords++;
      }
    });

    Object.keys(grouped).forEach(tableau => {
      const group = grouped[tableau];
      group.percentComplete = Math.round((group.verifiedWords / group.totalWords) * 100);
    });

    return grouped;
  }

  async save() {
    const lines = [...this.headers];

    this.entries.forEach(entry => {
      const audioFormatted = `[sound:${entry.audio}]`;
      const line = `"${entry.arabic}","${entry.french}","${audioFormatted}","${entry.tags}"`;
      lines.push(line);
    });

    await fs.promises.writeFile(this.filePath, lines.join('\n'), 'utf8');
  }

  updateEntry(lineNumber, updatedData) {
    const index = this.entries.findIndex(e => e.lineNumber === lineNumber);
    if (index !== -1) {
      this.entries[index] = { ...this.entries[index], ...updatedData };

      // If tags were updated, recalculate tableauNumber
      if (updatedData.tags) {
        const tableauMatch = updatedData.tags.match(/::(\d+_Tableau_[\d-]+)/);
        this.entries[index].tableauNumber = tableauMatch ? tableauMatch[1] : 'Unknown';
      }

      return this.entries[index];
    }
    return null;
  }

  addEntry(afterLineNumber, newEntry) {
    const index = this.entries.findIndex(e => e.lineNumber === afterLineNumber);
    if (index !== -1) {
      const newLineNumber = afterLineNumber + 1;

      this.entries.forEach(entry => {
        if (entry.lineNumber >= newLineNumber) {
          entry.lineNumber++;
        }
      });

      const entry = {
        lineNumber: newLineNumber,
        arabic: newEntry.arabic,
        french: newEntry.french,
        audio: newEntry.audio,
        audioRaw: `[sound:${newEntry.audio}]`,
        tags: newEntry.tags,
        tableauNumber: newEntry.tableauNumber,
        verified: false
      };

      this.entries.splice(index + 1, 0, entry);
      return entry;
    }
    return null;
  }

  deleteEntry(lineNumber) {
    const index = this.entries.findIndex(e => e.lineNumber === lineNumber);
    if (index !== -1) {
      this.entries.splice(index, 1);

      this.entries.forEach(entry => {
        if (entry.lineNumber > lineNumber) {
          entry.lineNumber--;
        }
      });

      return true;
    }
    return false;
  }

  swapEntries(lineNumber1, lineNumber2) {
    const index1 = this.entries.findIndex(e => e.lineNumber === lineNumber1);
    const index2 = this.entries.findIndex(e => e.lineNumber === lineNumber2);

    if (index1 === -1 || index2 === -1) {
      return false;
    }

    // Swap the entries in the array
    [this.entries[index1], this.entries[index2]] = [this.entries[index2], this.entries[index1]];

    // Update line numbers to reflect new positions
    this.entries[index1].lineNumber = lineNumber1;
    this.entries[index2].lineNumber = lineNumber2;

    return true;
  }
}

module.exports = CSVHandler;
