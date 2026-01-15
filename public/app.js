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
const editArabic = document.getElementById('edit-arabic');
const editFrench = document.getElementById('edit-french');
const addArabic = document.getElementById('add-arabic');
const addFrench = document.getElementById('add-french');

csvSelect.addEventListener('change', handleFileSelect);
backToTableaux.addEventListener('click', showTableauxView);
verifyAllTableau.addEventListener('click', verifyAllWordsInTableau);
saveChanges.addEventListener('click', saveProgress);
tinderModeBtn.addEventListener('click', enterTinderMode);

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
    btn.addEventListener('click', closeModals);
});

document.getElementById('cancel-edit').addEventListener('click', closeModals);
document.getElementById('cancel-add').addEventListener('click', closeModals);
document.getElementById('confirm-edit').addEventListener('click', confirmEdit);
document.getElementById('confirm-add').addEventListener('click', confirmAdd);

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
                niveau
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

    tinderMode = true;
    tinderWords = [...currentTableau.words];
    tinderCurrentIndex = 0;

    wordsView.classList.add('hidden');
    tinderView.classList.remove('hidden');

    document.getElementById('tinder-title').textContent = `Mode Rapide - Tableau ${currentTableau.tableau}`;

    showTinderCard();
}

function exitTinderMode() {
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

    // Auto-play audio
    setTimeout(() => {
        playAudio(niveau, word.audio);
    }, 300);
}

function tinderAccept() {
    const word = tinderWords[tinderCurrentIndex];

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

    // Animate card
    const card = document.getElementById('tinder-card');
    card.classList.add('swipe-right');

    setTimeout(() => {
        tinderCurrentIndex++;
        showTinderCard();
    }, 300);
}

function tinderSkip() {
    // Don't mark as verified, just skip
    const card = document.getElementById('tinder-card');
    card.classList.add('swipe-right');

    setTimeout(() => {
        tinderCurrentIndex++;
        showTinderCard();
    }, 300);
}

function tinderEdit() {
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
                niveau
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
