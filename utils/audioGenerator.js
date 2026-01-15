const gtts = require('gtts');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AudioGenerator {
  constructor(mediaBasePath) {
    this.mediaBasePath = mediaBasePath;
  }

  generateFileName(arabicText) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(arabicText).digest('hex').substring(0, 8);
    return `generated_${timestamp}_${hash}.mp3`;
  }

  async generateArabicAudio(arabicText, niveau) {
    return new Promise((resolve, reject) => {
      const cleanedText = this.cleanArabicText(arabicText);
      const fileName = this.generateFileName(cleanedText);
      const outputDir = path.join(this.mediaBasePath, niveau.toString());
      const outputPath = path.join(outputDir, fileName);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const speech = new gtts(cleanedText, 'ar');

      speech.save(outputPath, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            fileName: fileName,
            fullPath: outputPath
          });
        }
      });
    });
  }

  cleanArabicText(text) {
    const cleaned = text
      .replace(/[\/،؛]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  deleteAudioFile(niveau, fileName) {
    const filePath = path.join(this.mediaBasePath, niveau.toString(), fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

module.exports = AudioGenerator;
