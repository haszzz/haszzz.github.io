# Gestionnaire de Vocabulaire Arabe-Français

Application web pour gérer, vérifier et modifier les entrées de vocabulaire dans les fichiers CSV (format Anki).

## Fonctionnalités

- **Groupement par tableau** - Organisation des mots par tableaux de vocabulaire
- **Navigation intuitive** - Parcourir tableau par tableau avec indicateurs de progression
- **Système de suivi** - Marquer les mots et tableaux comme vérifiés
- **Lecture audio** - Écouter la prononciation des mots arabes
- **Régénération audio** - Générer un nouveau fichier audio si la prononciation n'est pas correcte
- **Édition inline** - Modifier les entrées directement dans l'interface
- **Ajout de mots** - Insérer de nouvelles entrées entre les mots existants
- **Persistance** - Sauvegarde automatique de la progression

## Installation

```bash
# Les dépendances sont déjà installées
# Si nécessaire, réinstaller avec:
npm install
```

## Démarrage

```bash
# Lancer le serveur
npm start

# Ou directement:
node server.js
```

L'application sera accessible à l'adresse: **http://localhost:3001**

## Utilisation

### 1. Vue d'ensemble
1. Ouvrez votre navigateur à http://localhost:3001
2. Sélectionnez un fichier CSV (2.csv, 3.csv, 4.csv, etc.)
3. La vue par tableaux s'affiche avec la progression

### 2. Vérification par tableau
1. Cliquez sur un tableau pour voir ses mots
2. Pour chaque mot:
   - Cliquez sur 🔊 pour écouter la prononciation
   - Si le son n'est pas correct: Cliquez sur 🔄 pour régénérer l'audio
   - Vérifiez l'orthographe arabe et française
   - Cochez ✓ pour marquer comme vérifié
   - Double-cliquez sur "Modifier" pour éditer
   - Cliquez sur "+ Insérer" pour ajouter un mot après
3. Cliquez sur "✓ Marquer tout le tableau" pour marquer tous les mots
4. Cliquez sur "💾 Sauvegarder" pour enregistrer la progression

### 3. Reprise du travail
- La progression est sauvegardée dans `data/progress.json`
- Au prochain lancement, votre avancement est restauré
- Les tableaux vérifiés sont marqués en vert
- Les tableaux en cours affichent le pourcentage de progression

## Structure du Projet

```
haszzz.github.io/
├── server.js              # Serveur Express avec APIs REST
├── package.json           # Dépendances Node.js
├── utils/
│   ├── csvHandler.js      # Gestion des fichiers CSV
│   └── audioGenerator.js  # Génération audio TTS
├── public/
│   ├── index.html         # Interface utilisateur
│   ├── style.css          # Styles
│   └── app.js             # Logique frontend
├── data/
│   └── progress.json      # Progression (créé automatiquement)
├── media/                 # Fichiers audio MP3
│   ├── 2/
│   ├── 3/
│   └── 4/
└── *.csv                  # Fichiers de vocabulaire

```

## APIs

### Endpoints disponibles

- `GET /api/csv/:filename` - Récupérer les entrées d'un CSV
- `GET /api/csv/:filename/tableaux` - Liste des tableaux avec statistiques
- `PUT /api/csv/:filename/:lineNumber` - Modifier une entrée
- `POST /api/csv/:filename` - Ajouter une entrée
- `DELETE /api/csv/:filename/:lineNumber` - Supprimer une entrée
- `POST /api/audio/regenerate` - Régénérer l'audio d'un mot
- `POST /api/progress/:filename` - Sauvegarder la progression
- `GET /api/progress/:filename` - Récupérer la progression

## Technologies

- **Backend**: Node.js + Express
- **Frontend**: HTML + CSS + JavaScript (vanilla)
- **Parser CSV**: csv-parser + csv-writer
- **TTS**: gTTS (Google Text-to-Speech) pour l'arabe

## Notes Importantes

- Les fichiers audio régénérés sont sauvegardés dans `media/{niveau}/`
- Le format Anki est préservé (`[sound:fichier.mp3]`)
- Les modifications sont écrites directement dans les fichiers CSV
- Les 3 premières lignes de métadonnées CSV sont préservées
- Encodage UTF-8 pour supporter l'arabe et le français

## Dépannage

**Le serveur ne démarre pas (port occupé):**
```bash
# Trouver et arrêter le processus sur le port 3001
lsof -ti:3001 | xargs kill -9
```

**Les fichiers audio ne se lisent pas:**
- Vérifiez que les fichiers MP3 existent dans `media/{niveau}/`
- Vérifiez les permissions des dossiers media

**Erreur lors de la génération audio:**
- Vérifiez que gTTS est installé: `npm install gtts`
- Vérifiez la connexion internet (gTTS nécessite l'API Google)

## Sauvegarde

Avant d'utiliser l'application sur des fichiers importants:

```bash
# Créer une sauvegarde des CSV
cp 2.csv 2.csv.backup
cp 3.csv 3.csv.backup
cp 4.csv 4.csv.backup

# Ou tout sauvegarder
git add -A
git commit -m "Backup avant modifications"
```

## Licence

MIT
