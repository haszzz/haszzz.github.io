let currentFile = null;
let currentTableau = null;
let allEntries = [];
let tableaux = [];
let verifiedWords = [];
let currentEditingLine = null;
let currentAddAfterLine = null;

const csvSelect = document.getElementById('csv-select');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const tableauxView = document.getElementById('tableaux-view');
const wordsView = document.getElementById('words-view');
const tableauxList = document.getElementById('tableaux-list');
const wordsTbody = document.getElementById('words-tbody');
const tableauTitle = document.getElementById('tableau-title');
const backToTableaux = document.getElementById('back-to-tableaux');
const verifyAllTableau = document.getElementById('verify-all-tableau');
const saveChanges = document.getElementById('save-changes');
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

        closeModals();
        showWordsView(currentTableau);

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
