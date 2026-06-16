# ISI Student Portal — Frontend

Interface React + Tailwind CSS pour le portail étudiant ISI Tunis.

## Stack

- **React 18** + React Router v6
- **Tailwind CSS 3** (design system complet)
- **Axios** (appels API avec intercepteurs JWT)
- **Lucide React** (icônes)
- **React Hot Toast** (notifications)
- **Vite** (bundler)

## Démarrage

### Prérequis
- Node.js 18+ : https://nodejs.org
- Backend FastAPI lancé sur `http://localhost:8000`

### Installation

```bash
cd frontend-portal
npm install
npm run dev
```

Ouvrez **http://localhost:3000**

## Comptes de test

| Rôle       | Identifiant                    | Mot de passe |
|------------|-------------------------------|--------------|
| Scolarité  | scolarite@universite.tn       | Admin@2024   |
| Étudiant   | MAT_CIN (après import Excel)  | (aucun)      |

## Pages

### Scolarité
| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/scolarite` | Statistiques, taux d'inscription, accès rapides |
| Étudiants | `/scolarite/etudiants` | Liste paginée + recherche + filtres |
| Import | `/scolarite/import` | Glisser-déposer fichier Excel SALIMA |
| Export | `/scolarite/export` | Téléchargement Excel format SALIMA |

### Étudiant
| Page | URL | Description |
|------|-----|-------------|
| Mon dossier | `/etudiant` | Consultation identité, filière, notes |
| Mon inscription | `/etudiant/inscription` | Complétion coordonnées + soumission finale |

## Structure

```
src/
├── components/
│   ├── ui/index.jsx        → Btn, Input, Badge, Card, Table, Modal, Pagination…
│   └── layout/Layout.jsx   → Sidebar + Outlet
├── context/
│   └── AuthContext.jsx     → Token JWT en localStorage
├── pages/
│   ├── Login.jsx
│   ├── scolarite/
│   │   ├── Dashboard.jsx
│   │   ├── EtudiantsList.jsx
│   │   ├── ImportPage.jsx
│   │   └── ExportPage.jsx
│   └── etudiant/
│       ├── Profile.jsx
│       └── Inscription.jsx
├── services/
│   └── api.js              → Toutes les fonctions Axios
└── App.jsx                 → Routes + guards par rôle
```

## Build production

```bash
npm run build
# Le dossier dist/ contient les fichiers statiques à déployer
```
