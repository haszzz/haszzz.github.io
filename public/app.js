let currentFile = null;
let currentTableau = null;
let allEntries = [];
let tableaux = [];
let verifiedWords = [];
let currentEditingLine = null;
let currentAddAfterLine = null;

// Tinder mode
let tinderMode = false;
let tinderCurrentIndex = 0;
let tinderWords = [];

// Settings
let audioSettings = {
    service: 'gtts',
    voice: 'ar',
    quality: 'standard'
};

const csvSelect = document.getElementById('csv-select');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const tableauxView = document.getElementById('tableaux-view');
const wordsView = document.getElementById('words-view');
const tinderView = document.getElementById('tinder-view');
const tableauxList = document.getElementById('tableaux-list');
const wordsTbody = document.getElementById('words-tbody');
const tableauTitle = document.getElementById('tableau-title');
const backToTableaux = document.getElementById('back-to-tableaux');
const verifyAllTableau = document.getElementById('verify-all-tableau');
const saveChanges = document.getElementById('save-changes');
const tinderModeBtn = document.getElementById('tinder-mode-btn');
const audioPlayer = document.getElementById('audio-player');

const editModal = document.getElementById('edit-modal');
const addModal = document.getElementById('add-modal');
const settingsModal = document.getElementById('settings-modal');
const moveWordModal = document.getElementById('move-word-modal');
const editArabic = document.getElementById('edit-arabic');
const editFrench = document.getElementById('edit-french');
const addArabic = document.getElementById('add-arabic');
const addFrench = document.getElementById('add-french');

// Search elements
const searchSection = document.getElementById('search-section');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchResults = document.getElementById('search-results');

let currentMoveWord = null;

csvSelect.addEventListener('change', handleFileSelect);
backToTableaux.addEventListener('click', showTableauxView);
verifyAllTableau.addEventListener('click', verifyAllWordsInTableau);
saveChanges.addEventListener('click', saveProgress);
tinderModeBtn.addEventListener('click', enterTinderMode);

// Settings
document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('cancel-settings').addEventListener('click', closeSettings);
document.getElementById('save-settings').addEventListener('click', saveSettings);
document.getElementById('test-voice-btn').addEventListener('click', testVoice);

// Tinder mode event listeners
document.getElementById('exit-tinder').addEventListener('click', exitTinderMode);
document.getElementById('tinder-accept').addEventListener('click', tinderAccept);
document.getElementById('tinder-skip').addEventListener('click', tinderSkip);
document.getElementById('tinder-edit').addEventListener('click', tinderEdit);
document.getElementById('card-play-audio').addEventListener('click', tinderPlayAudio);
document.getElementById('card-regenerate-audio').addEventListener('click', tinderRegenerateAudio);

// Keyboard support for tinder mode
document.addEventListener('keydown', handleTinderKeyboard);

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        closeModals();
        closeSettings();
    });
});

document.getElementById('cancel-edit').addEventListener('click', closeModals);
document.getElementById('cancel-add').addEventListener('click', closeModals);
document.getElementById('confirm-edit').addEventListener('click', confirmEdit);
document.getElementById('confirm-add').addEventListener('click', confirmAdd);

// Move word modal
document.getElementById('cancel-move').addEventListener('click', () => {
    moveWordModal.classList.add('hidden');
    currentMoveWord = null;
});
document.getElementById('confirm-move').addEventListener('click', confirmMoveWord);

// Search
searchBtn.addEventListener('click', performSearch);
clearSearchBtn.addEventListener('click', clearSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

// Load settings on startup
loadSettings();

async function handleFileSelect(e) {
    const filename = e.target.value;
    if (!filename) return;

    currentFile = filename;
    showLoading(true);
    hideError();

    try {
        const [entriesData, progressData] = await Promise.all([
            fetch(`/api/csv/${filename}`).then(r => r.json()),
            fetch(`/api/progress/${filename}`).then(r => r.json())
        ]);

        allEntries = entriesData.entries;
        verifiedWords = progressData.verifiedWords || [];

        allEntries.forEach(entry => {
            entry.verified = verifiedWords.includes(entry.lineNumber);
        });

        const tableauxData = await fetch(`/api/csv/${filename}/tableaux`).then(r => r.json());
        tableaux = tableauxData;

        // Show search section when file is loaded
        searchSection.classList.remove('hidden');

        showTableauxView();
    } catch (err) {
        showError(`Erreur lors du chargement: ${err.message}`);
    } finally {
        showLoading(false);
    }
}

function showTableauxView() {
    tableauxView.classList.remove('hidden');
    wordsView.classList.add('hidden');

    tableauxList.innerHTML = '';

    const totalWords = tableaux.reduce((sum, t) => sum + t.totalWords, 0);
    const totalVerified = tableaux.reduce((sum, t) => sum + t.verifiedWords, 0);
    const overallPercent = Math.round((totalVerified / totalWords) * 100) || 0;

    document.getElementById('overall-progress').textContent =
        `Progression globale: ${totalVerified}/${totalWords} mots vérifiés (${overallPercent}%)`;

    tableaux.forEach(tableau => {
        const card = document.createElement('div');
        card.className = 'tableau-card';

        if (tableau.percentComplete === 100) {
            card.classList.add('completed');
        } else if (tableau.percentComplete > 0) {
            card.classList.add('in-progress');
        } else {
            card.classList.add('not-started');
        }

        card.innerHTML = `
            <h3>Tableau ${tableau.tableau}</h3>
            <div class="progress-bar">
                <div class="progress-bar-fill" style="width: ${tableau.percentComplete}%"></div>
            </div>
            <div class="tableau-stats">
                <span>${tableau.verifiedWords}/${tableau.totalWords} mots</span>
                <span>${tableau.percentComplete}%</span>
            </div>
        `;

        card.addEventListener('click', () => showWordsView(tableau));
        tableauxList.appendChild(card);
    });
}

function showWordsView(tableau) {
    currentTableau = tableau;
    tableauxView.classList.add('hidden');
    wordsView.classList.remove('hidden');

    tableauTitle.textContent = `Tableau ${tableau.tableau} (${tableau.verifiedWords}/${tableau.totalWords} vérifiés)`;

    wordsTbody.innerHTML = '';

    tableau.words.forEach(entry => {
        const row = document.createElement('tr');
        if (entry.verified) {
            row.classList.add('verified-row');
        }

        const niveau = currentFile.replace('.csv', '');

        const isFirstInTableau = tableau.words.indexOf(entry) === 0;
        const isLastInTableau = tableau.words.indexOf(entry) === tableau.words.length - 1;

        row.innerHTML = `
            <td class="col-check">
                <input type="checkbox" ${entry.verified ? 'checked' : ''}
                       onchange="toggleVerified(${entry.lineNumber})">
            </td>
            <td class="col-arabic">
                <span class="arabic-text">${entry.arabic}</span>
            </td>
            <td class="col-french">${entry.french}</td>
            <td class="col-audio">
                <div class="audio-controls">
                    <button class="icon-btn" onclick="playAudio('${niveau}', '${entry.audio}')" title="Écouter">
                        🔊
                    </button>
                    <button class="icon-btn" onclick="regenerateAudio(${entry.lineNumber}, '${entry.arabic}', '${niveau}')" title="Régénérer">
                        🔄
                    </button>
                </div>
            </td>
            <td class="col-actions">
                <div class="action-buttons">
                    <div class="position-controls">
                        <button class="btn-icon" onclick="moveWordUp(${entry.lineNumber})" ${isFirstInTableau ? 'disabled' : ''} title="Monter">
                            ↑
                        </button>
                        <button class="btn-icon" onclick="moveWordDown(${entry.lineNumber})" ${isLastInTableau ? 'disabled' : ''} title="Descendre">
                            ↓
                        </button>
                    </div>
                    <button class="btn btn-small btn-primary" onclick="editEntry(${entry.lineNumber})">
                        Modifier
                    </button>
                    <button class="btn btn-small btn-success" onclick="addEntryAfter(${entry.lineNumber})">
                        + Insérer
                    </button>
                    <button class="btn btn-small btn-danger" onclick="deleteEntry(${entry.lineNumber})">
                        Supprimer
                    </button>
                </div>
            </td>
        `;

        wordsTbody.appendChild(row);
    });
}

function toggleVerified(lineNumber) {
    const entry = allEntries.find(e => e.lineNumber === lineNumber);
    if (entry) {
        entry.verified = !entry.verified;

        if (entry.verified && !verifiedWords.includes(lineNumber)) {
            verifiedWords.push(lineNumber);
        } else if (!entry.verified) {
            verifiedWords = verifiedWords.filter(ln => ln !== lineNumber);
        }

        updateTableauStats();

        // Auto-save progress
        saveProgressSilently();
    }
}

function verifyAllWordsInTableau() {
    if (!currentTableau) return;

    currentTableau.words.forEach(entry => {
        entry.verified = true;
        if (!verifiedWords.includes(entry.lineNumber)) {
            verifiedWords.push(entry.lineNumber);
        }
    });

    showWordsView(currentTableau);
    updateTableauStats();

    // Auto-save progress
    saveProgressSilently();
}

function updateTableauStats() {
    if (!currentTableau) return;

    currentTableau.verifiedWords = currentTableau.words.filter(w => w.verified).length;
    currentTableau.percentComplete = Math.round((currentTableau.verifiedWords / currentTableau.totalWords) * 100);

    tableauTitle.textContent = `Tableau ${currentTableau.tableau} (${currentTableau.verifiedWords}/${currentTableau.totalWords} vérifiés)`;
}

async function saveProgress() {
    if (!currentFile) return;

    showLoading(true);

    try {
        await fetch(`/api/progress/${currentFile}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verifiedWords })
        });

        alert('Progression sauvegardée avec succès!');
    } catch (err) {
        showError(`Erreur lors de la sauvegarde: ${err.message}`);
    } finally {
        showLoading(false);
    }
}

async function saveProgressSilently() {
    if (!currentFile) return;

    try {
        await fetch(`/api/progress/${currentFile}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verifiedWords })
        });

        // Show auto-save indicator
        showAutoSaveIndicator();
    } catch (err) {
        console.error('Erreur lors de la sauvegarde automatique:', err);
    }
}

function showAutoSaveIndicator() {
    const indicator = document.getElementById('auto-save-indicator');
    if (!indicator) return;

    indicator.classList.remove('hidden');
    indicator.classList.add('show');

    setTimeout(() => {
        indicator.classList.remove('show');
        setTimeout(() => {
            indicator.classList.add('hidden');
        }, 300);
    }, 2000);
}

function playAudio(niveau, audioFile) {
    audioPlayer.src = `/media/${niveau}/${audioFile}`;
    audioPlayer.play();
}

async function regenerateAudio(lineNumber, arabicText, niveau) {
    const btn = event.target;
    btn.classList.add('regenerating');
    btn.disabled = true;

    try {
        const response = await fetch('/api/audio/regenerate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: currentFile,
                lineNumber,
                arabicText,
                niveau,
                settings: audioSettings
            })
        });

        const result = await response.json();

        if (result.success) {
            const entry = allEntries.find(e => e.lineNumber === lineNumber);
            if (entry) {
                entry.audio = result.audioFile;
            }

            const tableauEntry = currentTableau.words.find(e => e.lineNumber === lineNumber);
            if (tableauEntry) {
                tableauEntry.audio = result.audioFile;
            }

            showWordsView(currentTableau);

            setTimeout(() => {
                playAudio(niveau, result.audioFile);
            }, 300);

            alert('Audio régénéré avec succès!');
        }
    } catch (err) {
        showError(`Erreur lors de la régénération: ${err.message}`);
    } finally {
        btn.classList.remove('regenerating');
        btn.disabled = false;
    }
}

function editEntry(lineNumber) {
    const entry = allEntries.find(e => e.lineNumber === lineNumber);
    if (!entry) return;

    currentEditingLine = lineNumber;
    editArabic.value = entry.arabic;
    editFrench.value = entry.french;

    editModal.classList.remove('hidden');
}

async function confirmEdit() {
    if (!currentEditingLine) return;

    const updatedData = {
        arabic: editArabic.value,
        french: editFrench.value
    };

    try {
        const response = await fetch(`/api/csv/${currentFile}/${currentEditingLine}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        const result = await response.json();

        const entry = allEntries.find(e => e.lineNumber === currentEditingLine);
        if (entry) {
            entry.arabic = result.arabic;
            entry.french = result.french;
        }

        const tableauEntry = currentTableau.words.find(e => e.lineNumber === currentEditingLine);
        if (tableauEntry) {
            tableauEntry.arabic = result.arabic;
            tableauEntry.french = result.french;
        }

        // Update in tinder mode if active
        if (tinderMode) {
            const tinderWord = tinderWords[tinderCurrentIndex];
            if (tinderWord && tinderWord.lineNumber === currentEditingLine) {
                tinderWord.arabic = result.arabic;
                tinderWord.french = result.french;
            }
        }

        closeModals();

        if (tinderMode) {
            showTinderCard();
        } else {
            showWordsView(currentTableau);
        }

        alert('Entrée modifiée avec succès!');
    } catch (err) {
        showError(`Erreur lors de la modification: ${err.message}`);
    }
}

function addEntryAfter(lineNumber) {
    currentAddAfterLine = lineNumber;
    addArabic.value = '';
    addFrench.value = '';

    addModal.classList.remove('hidden');
}

async function confirmAdd() {
    if (!currentAddAfterLine) return;

    const entry = allEntries.find(e => e.lineNumber === currentAddAfterLine);
    if (!entry) return;

    const newEntry = {
        arabic: addArabic.value,
        french: addFrench.value,
        audio: 'placeholder.mp3',
        tags: entry.tags,
        tableauNumber: entry.tableauNumber
    };

    try {
        const response = await fetch(`/api/csv/${currentFile}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                afterLineNumber: currentAddAfterLine,
                newEntry
            })
        });

        const result = await response.json();

        // Recharger les données et rester dans le tableau actuel
        const tableauId = currentTableau.tableau;
        const [entriesData, tableauxData] = await Promise.all([
            fetch(`/api/csv/${currentFile}`).then(r => r.json()),
            fetch(`/api/csv/${currentFile}/tableaux`).then(r => r.json())
        ]);

        allEntries = entriesData.entries;
        allEntries.forEach(entry => {
            entry.verified = verifiedWords.includes(entry.lineNumber);
        });
        tableaux = tableauxData;

        // Retrouver le tableau actuel avec les données mises à jour
        currentTableau = tableaux.find(t => t.tableau === tableauId);
        if (currentTableau) {
            showWordsView(currentTableau);
        }

        closeModals();

        alert('Mot ajouté avec succès!');
    } catch (err) {
        showError(`Erreur lors de l'ajout: ${err.message}`);
    }
}

async function deleteEntry(lineNumber) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette entrée?')) return;

    try {
        await fetch(`/api/csv/${currentFile}/${lineNumber}`, {
            method: 'DELETE'
        });

        // Recharger les données et rester dans le tableau actuel
        const tableauId = currentTableau.tableau;
        const [entriesData, tableauxData] = await Promise.all([
            fetch(`/api/csv/${currentFile}`).then(r => r.json()),
            fetch(`/api/csv/${currentFile}/tableaux`).then(r => r.json())
        ]);

        allEntries = entriesData.entries;
        allEntries.forEach(entry => {
            entry.verified = verifiedWords.includes(entry.lineNumber);
        });
        tableaux = tableauxData;

        // Retrouver le tableau actuel avec les données mises à jour
        currentTableau = tableaux.find(t => t.tableau === tableauId);
        if (currentTableau) {
            showWordsView(currentTableau);
        }

        alert('Entrée supprimée avec succès!');
    } catch (err) {
        showError(`Erreur lors de la suppression: ${err.message}`);
    }
}

function closeModals() {
    editModal.classList.add('hidden');
    addModal.classList.add('hidden');
    currentEditingLine = null;
    currentAddAfterLine = null;
}

function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showError(message) {
    error.textContent = message;
    error.classList.remove('hidden');
}

function hideError() {
    error.classList.add('hidden');
}

// ===== TINDER MODE =====

function enterTinderMode() {
    if (!currentTableau || !currentTableau.words.length) return;

    // Filter only unverified words
    const unverifiedWords = currentTableau.words.filter(word => !word.verified);

    if (unverifiedWords.length === 0) {
        alert('Tous les mots de ce tableau sont déjà vérifiés!');
        return;
    }

    tinderMode = true;
    tinderWords = [...unverifiedWords];
    tinderCurrentIndex = 0;

    wordsView.classList.add('hidden');
    tinderView.classList.remove('hidden');

    document.getElementById('tinder-title').textContent = `Mode Rapide - Tableau ${currentTableau.tableau}`;

    showTinderCard();
}

function exitTinderMode() {
    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    tinderMode = false;
    tinderView.classList.add('hidden');

    if (currentTableau) {
        showWordsView(currentTableau);
    }
}

function showTinderCard() {
    if (tinderCurrentIndex >= tinderWords.length) {
        alert('Tous les mots du tableau ont été vérifiés!');
        exitTinderMode();
        return;
    }

    const word = tinderWords[tinderCurrentIndex];
    const niveau = currentFile.replace('.csv', '');

    document.getElementById('card-arabic').textContent = word.arabic;
    document.getElementById('card-french').textContent = word.french;
    document.getElementById('tinder-counter').textContent =
        `${tinderCurrentIndex + 1} / ${tinderWords.length}`;

    // Remove any animation classes
    const card = document.getElementById('tinder-card');
    card.classList.remove('swipe-left', 'swipe-right');

    // Auto-play audio: Arabic first, then French
    setTimeout(() => {
        playAudio(niveau, word.audio);

        // Play French after Arabic audio finishes
        audioPlayer.onended = () => {
            speakFrench(word.french);
            audioPlayer.onended = null; // Reset handler
        };
    }, 300);
}

function speakFrench(text) {
    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1;
        utterance.volume = 1;

        window.speechSynthesis.speak(utterance);
    }
}

function tinderAccept() {
    const word = tinderWords[tinderCurrentIndex];

    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    // Mark as verified
    word.verified = true;
    if (!verifiedWords.includes(word.lineNumber)) {
        verifiedWords.push(word.lineNumber);
    }

    // Update in allEntries
    const entry = allEntries.find(e => e.lineNumber === word.lineNumber);
    if (entry) {
        entry.verified = true;
    }

    // Auto-save progress
    saveProgressSilently();

    // Animate card
    const card = document.getElementById('tinder-card');
    card.classList.add('swipe-right');

    setTimeout(() => {
        tinderCurrentIndex++;
        showTinderCard();
    }, 300);
}

function tinderSkip() {
    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    // Don't mark as verified, just skip
    const card = document.getElementById('tinder-card');
    card.classList.add('swipe-right');

    setTimeout(() => {
        tinderCurrentIndex++;
        showTinderCard();
    }, 300);
}

function tinderEdit() {
    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    const word = tinderWords[tinderCurrentIndex];
    currentEditingLine = word.lineNumber;

    editArabic.value = word.arabic;
    editFrench.value = word.french;

    editModal.classList.remove('hidden');
}

function tinderPlayAudio() {
    const word = tinderWords[tinderCurrentIndex];
    const niveau = currentFile.replace('.csv', '');

    playAudio(niveau, word.audio);

    // Play French after Arabic audio finishes
    audioPlayer.onended = () => {
        speakFrench(word.french);
        audioPlayer.onended = null;
    };
}

async function tinderRegenerateAudio() {
    const word = tinderWords[tinderCurrentIndex];
    const niveau = currentFile.replace('.csv', '');

    const btn = document.getElementById('card-regenerate-audio');
    btn.disabled = true;
    btn.style.opacity = '0.5';

    try {
        const response = await fetch('/api/audio/regenerate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: currentFile,
                lineNumber: word.lineNumber,
                arabicText: word.arabic,
                niveau,
                settings: audioSettings
            })
        });

        const result = await response.json();

        if (result.success) {
            word.audio = result.audioFile;

            const entry = allEntries.find(e => e.lineNumber === word.lineNumber);
            if (entry) {
                entry.audio = result.audioFile;
            }

            setTimeout(() => {
                playAudio(niveau, result.audioFile);

                // Play French after Arabic audio finishes
                audioPlayer.onended = () => {
                    speakFrench(word.french);
                    audioPlayer.onended = null;
                };
            }, 300);
        }
    } catch (err) {
        showError(`Erreur: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function handleTinderKeyboard(e) {
    if (!tinderMode || editModal.classList.contains('hidden') === false) return;

    switch(e.key) {
        case 'ArrowRight':
            e.preventDefault();
            tinderAccept();
            break;
        case 'ArrowDown':
            e.preventDefault();
            tinderSkip();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            tinderEdit();
            break;
        case ' ':
            e.preventDefault();
            tinderPlayAudio();
            break;
    }
}

// ===== ARABIC KEYBOARD =====

const arabicKeyboardLayout = {
    letters: [
        ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'],
        ['د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص'],
        ['ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق'],
        ['ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'],
        ['ء', 'آ', 'أ', 'ؤ', 'إ', 'ئ', 'ى', 'ة']
    ],
    diacritics: [
        ['َ', 'ُ', 'ِ', 'ً', 'ٌ', 'ٍ', 'ْ', 'ّ', 'ـ']
    ],
    special: [
        ['/', '،', '؛', '؟', ' ']
    ]
};

let currentArabicInput = null;

function createArabicKeyboard(containerId, inputId) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    currentArabicInput = input;

    container.innerHTML = '';

    // Letters section
    const lettersSection = document.createElement('div');
    lettersSection.className = 'keyboard-section';
    lettersSection.innerHTML = '<div class="keyboard-section-title">حروف (Lettres)</div>';

    arabicKeyboardLayout.letters.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';

        row.forEach(char => {
            const btn = document.createElement('button');
            btn.className = 'key-btn';
            btn.textContent = char;
            btn.type = 'button';
            btn.onclick = () => insertChar(char, input);
            rowDiv.appendChild(btn);
        });

        lettersSection.appendChild(rowDiv);
    });

    // Diacritics section
    const diacriticsSection = document.createElement('div');
    diacriticsSection.className = 'keyboard-section';
    diacriticsSection.innerHTML = '<div class="keyboard-section-title">تشكيل (Diacritiques)</div>';

    arabicKeyboardLayout.diacritics.forEach(row => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';

        row.forEach(char => {
            const btn = document.createElement('button');
            btn.className = 'key-btn diacritic';
            btn.textContent = char;
            btn.type = 'button';
            btn.title = getDiacriticName(char);
            btn.onclick = () => insertChar(char, input);
            rowDiv.appendChild(btn);
        });

        diacriticsSection.appendChild(rowDiv);
    });

    // Special characters and actions
    const specialSection = document.createElement('div');
    specialSection.className = 'keyboard-section';
    specialSection.innerHTML = '<div class="keyboard-section-title">رموز وإجراءات (Symboles et Actions)</div>';

    const specialRow = document.createElement('div');
    specialRow.className = 'keyboard-row';

    arabicKeyboardLayout.special.forEach(char => {
        const btn = document.createElement('button');
        btn.className = 'key-btn special';
        btn.textContent = char === ' ' ? 'مسافة' : char;
        btn.type = 'button';
        btn.onclick = () => insertChar(char, input);
        specialRow.appendChild(btn);
    });

    // Backspace button
    const backspaceBtn = document.createElement('button');
    backspaceBtn.className = 'key-btn action';
    backspaceBtn.textContent = '⌫ مسح';
    backspaceBtn.type = 'button';
    backspaceBtn.onclick = () => backspace(input);
    specialRow.appendChild(backspaceBtn);

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'key-btn action';
    clearBtn.textContent = '✕ مسح الكل';
    clearBtn.type = 'button';
    clearBtn.onclick = () => clearInput(input);
    specialRow.appendChild(clearBtn);

    specialSection.appendChild(specialRow);

    container.appendChild(lettersSection);
    container.appendChild(diacriticsSection);
    container.appendChild(specialSection);
}

function insertChar(char, input) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;

    input.value = text.substring(0, start) + char + text.substring(end);
    input.selectionStart = input.selectionEnd = start + char.length;
    input.focus();
}

function backspace(input) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;

    if (start !== end) {
        // Delete selection
        input.value = text.substring(0, start) + text.substring(end);
        input.selectionStart = input.selectionEnd = start;
    } else if (start > 0) {
        // Delete one character before cursor
        input.value = text.substring(0, start - 1) + text.substring(start);
        input.selectionStart = input.selectionEnd = start - 1;
    }

    input.focus();
}

function clearInput(input) {
    input.value = '';
    input.focus();
}

function getDiacriticName(char) {
    const names = {
        'َ': 'Fatha',
        'ُ': 'Damma',
        'ِ': 'Kasra',
        'ً': 'Tanwin Fath',
        'ٌ': 'Tanwin Damm',
        'ٍ': 'Tanwin Kasr',
        'ْ': 'Sukun',
        'ّ': 'Shadda',
        'ـ': 'Tatweel'
    };
    return names[char] || char;
}

// Initialize keyboards when modals open
const originalEditEntry = editEntry;
editEntry = function(lineNumber) {
    originalEditEntry(lineNumber);
    setTimeout(() => {
        createArabicKeyboard('arabic-keyboard', 'edit-arabic');
    }, 50);
};

const originalAddEntryAfter = addEntryAfter;
addEntryAfter = function(lineNumber) {
    originalAddEntryAfter(lineNumber);
    setTimeout(() => {
        createArabicKeyboard('arabic-keyboard-add', 'add-arabic');
    }, 50);
};

const originalTinderEdit = tinderEdit;
tinderEdit = function() {
    originalTinderEdit();
    setTimeout(() => {
        createArabicKeyboard('arabic-keyboard', 'edit-arabic');
    }, 50);
};

// ===== SETTINGS MANAGEMENT =====

function loadSettings() {
    const saved = localStorage.getItem('audioSettings');
    if (saved) {
        try {
            audioSettings = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

function openSettings() {
    document.getElementById('tts-service').value = audioSettings.service;
    document.getElementById('tts-voice').value = audioSettings.voice;
    document.getElementById('audio-quality').value = audioSettings.quality;

    settingsModal.classList.remove('hidden');
}

function closeSettings() {
    settingsModal.classList.add('hidden');
}

function saveSettings() {
    audioSettings.service = document.getElementById('tts-service').value;
    audioSettings.voice = document.getElementById('tts-voice').value;
    audioSettings.quality = document.getElementById('audio-quality').value;

    localStorage.setItem('audioSettings', JSON.stringify(audioSettings));

    closeSettings();
    alert('Paramètres audio sauvegardés! Les prochaines régénérations utiliseront ces paramètres.');
}

async function testVoice() {
    const btn = document.getElementById('test-voice-btn');
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.textContent = '⏳ Génération...';

    try {
        // Get current settings from UI
        const testSettings = {
            service: document.getElementById('tts-service').value,
            voice: document.getElementById('tts-voice').value,
            quality: document.getElementById('audio-quality').value
        };

        const response = await fetch('/api/audio/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                settings: testSettings
            })
        });

        const result = await response.json();

        if (result.success) {
            // Play the test audio
            audioPlayer.src = result.audioUrl;
            await audioPlayer.play();

            btn.textContent = '✓ Test terminé';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        } else {
            throw new Error(result.error || 'Erreur lors de la génération');
        }
    } catch (err) {
        showError(`Erreur lors du test audio: ${err.message}`);
        btn.textContent = originalText;
    } finally {
        btn.disabled = false;
    }
}

// ===== MOVE WORD POSITION (UP/DOWN) =====

async function moveWordUp(lineNumber) {
    if (!currentTableau) return;

    const currentIndex = currentTableau.words.findIndex(w => w.lineNumber === lineNumber);
    if (currentIndex <= 0) return; // Already at the top

    const currentWord = currentTableau.words[currentIndex];
    const previousWord = currentTableau.words[currentIndex - 1];

    try {
        showLoading(true);

        // Swap positions in the CSV file
        const response = await fetch(`/api/csv/${currentFile}/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lineNumber1: previousWord.lineNumber,
                lineNumber2: currentWord.lineNumber
            })
        });

        if (!response.ok) {
            throw new Error('Erreur lors du déplacement');
        }

        // Reload data to reflect changes
        await reloadCurrentTableau();
    } catch (err) {
        showError(`Erreur lors du déplacement: ${err.message}`);
    } finally {
        showLoading(false);
    }
}

async function moveWordDown(lineNumber) {
    if (!currentTableau) return;

    const currentIndex = currentTableau.words.findIndex(w => w.lineNumber === lineNumber);
    if (currentIndex < 0 || currentIndex >= currentTableau.words.length - 1) return; // Already at the bottom

    const currentWord = currentTableau.words[currentIndex];
    const nextWord = currentTableau.words[currentIndex + 1];

    try {
        showLoading(true);

        // Swap positions in the CSV file
        const response = await fetch(`/api/csv/${currentFile}/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lineNumber1: currentWord.lineNumber,
                lineNumber2: nextWord.lineNumber
            })
        });

        if (!response.ok) {
            throw new Error('Erreur lors du déplacement');
        }

        // Reload data to reflect changes
        await reloadCurrentTableau();
    } catch (err) {
        showError(`Erreur lors du déplacement: ${err.message}`);
    } finally {
        showLoading(false);
    }
}

async function reloadCurrentTableau() {
    const tableauId = currentTableau.tableau;

    const [entriesData, tableauxData] = await Promise.all([
        fetch(`/api/csv/${currentFile}`).then(r => r.json()),
        fetch(`/api/csv/${currentFile}/tableaux`).then(r => r.json())
    ]);

    allEntries = entriesData.entries;
    allEntries.forEach(entry => {
        entry.verified = verifiedWords.includes(entry.lineNumber);
    });
    tableaux = tableauxData;

    currentTableau = tableaux.find(t => t.tableau === tableauId);
    if (currentTableau) {
        showWordsView(currentTableau);
    }
}

// ===== SEARCH AND MOVE WORD FUNCTIONALITY =====

function performSearch() {
    const query = searchInput.value.trim();

    if (!query) {
        alert('Veuillez entrer un mot à rechercher');
        return;
    }

    // Search through all entries for Arabic or French matches
    const results = allEntries.filter(entry => {
        const arabicMatch = entry.arabic.toLowerCase().includes(query.toLowerCase());
        const frenchMatch = entry.french.toLowerCase().includes(query.toLowerCase());
        return arabicMatch || frenchMatch;
    });

    displaySearchResults(results);
}

function displaySearchResults(results) {
    searchResults.innerHTML = '';

    if (results.length === 0) {
        searchResults.innerHTML = '<p class="search-no-results">Aucun résultat trouvé</p>';
        searchResults.classList.remove('hidden');
        return;
    }

    const resultCount = document.createElement('p');
    resultCount.style.marginBottom = '15px';
    resultCount.style.fontWeight = '600';
    resultCount.textContent = `${results.length} résultat(s) trouvé(s)`;
    searchResults.appendChild(resultCount);

    results.forEach(entry => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';

        const wordInfo = document.createElement('div');
        wordInfo.className = 'search-result-content';
        wordInfo.innerHTML = `
            <div class="search-result-arabic">${entry.arabic}</div>
            <div class="search-result-french">${entry.french}</div>
            <div class="search-result-tableau">Tableau: ${entry.tableauNumber}</div>
        `;

        const actions = document.createElement('div');
        actions.className = 'search-result-actions';

        const moveBtn = document.createElement('button');
        moveBtn.className = 'btn btn-primary btn-small';
        moveBtn.textContent = '↔️ Déplacer';
        moveBtn.onclick = () => openMoveWordModal(entry.lineNumber);

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.textContent = '✏️ Modifier';
        editBtn.onclick = () => {
            editEntry(entry.lineNumber);
        };

        actions.appendChild(moveBtn);
        actions.appendChild(editBtn);

        resultItem.appendChild(wordInfo);
        resultItem.appendChild(actions);

        searchResults.appendChild(resultItem);
    });

    searchResults.classList.remove('hidden');
}

function clearSearch() {
    searchInput.value = '';
    searchResults.innerHTML = '';
    searchResults.classList.add('hidden');
}

function openMoveWordModal(lineNumber) {
    const entry = allEntries.find(e => e.lineNumber === lineNumber);
    if (!entry) return;

    currentMoveWord = entry;

    // Populate modal with word info
    document.getElementById('move-word-text').textContent = entry.arabic;
    document.getElementById('move-word-french').textContent = entry.french;
    document.getElementById('move-word-current-tableau').textContent = entry.tableauNumber;

    // Populate tableau dropdown
    const targetSelect = document.getElementById('move-target-tableau');
    targetSelect.innerHTML = '<option value="">-- Choisir un tableau --</option>';

    tableaux.forEach(tableau => {
        // Don't include the current tableau in the list
        if (tableau.tableau !== entry.tableauNumber) {
            const option = document.createElement('option');
            option.value = tableau.tableau;
            option.textContent = `Tableau ${tableau.tableau}`;
            targetSelect.appendChild(option);
        }
    });

    moveWordModal.classList.remove('hidden');
}

async function confirmMoveWord() {
    if (!currentMoveWord) return;

    const targetTableau = document.getElementById('move-target-tableau').value;

    if (!targetTableau) {
        alert('Veuillez sélectionner un tableau de destination');
        return;
    }

    showLoading(true);

    try {
        // Get the old tags and construct new tags with the new tableau number
        const oldTags = currentMoveWord.tags;
        // Replace the tableau number in the tags
        // Format: "Book_name::XX_Tableau_YYY-ZZZ"
        const newTags = oldTags.replace(/::(\d+_Tableau_[\d-]+)/, `::${targetTableau}`);

        // Update the entry via API
        const response = await fetch(`/api/csv/${currentFile}/${currentMoveWord.lineNumber}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                arabic: currentMoveWord.arabic,
                french: currentMoveWord.french,
                tags: newTags
            })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la mise à jour');
        }

        // Reload all data to reflect the change
        const [entriesData, tableauxData] = await Promise.all([
            fetch(`/api/csv/${currentFile}`).then(r => r.json()),
            fetch(`/api/csv/${currentFile}/tableaux`).then(r => r.json())
        ]);

        allEntries = entriesData.entries;
        allEntries.forEach(entry => {
            entry.verified = verifiedWords.includes(entry.lineNumber);
        });
        tableaux = tableauxData;

        // Close modal and clear search
        moveWordModal.classList.add('hidden');
        currentMoveWord = null;

        // Refresh search results if there are any
        if (!searchResults.classList.contains('hidden')) {
            performSearch();
        }

        // If we're in a tableau view, refresh it
        if (currentTableau) {
            const tableauId = currentTableau.tableau;
            currentTableau = tableaux.find(t => t.tableau === tableauId);
            if (currentTableau && !wordsView.classList.contains('hidden')) {
                showWordsView(currentTableau);
            }
        }

        alert(`Mot déplacé avec succès vers le Tableau ${targetTableau}!`);
    } catch (err) {
        showError(`Erreur lors du déplacement: ${err.message}`);
    } finally {
        showLoading(false);
    }
}
