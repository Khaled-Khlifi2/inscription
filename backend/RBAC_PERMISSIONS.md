  
  
  
  # Documentation RBAC - Permissions et Configuration par Défaut



---

## Liste des Permissions

Les permissions sont organisées par ressource et suivent le format `ressource:action`. Les suffixes spéciaux indiquent la portée :
- `_own` : Action sur ses propres données
- `_level` : Action sur les données de son niveau (responsables)
- `_all` : Action sur toutes les données (scolarité)

### Permissions Étudiant

| ID | Nom                 | Description                  | Ressource |   Action   |
|----|---------------------|------------------------------|-----------|------------|
| 1  | `etudiant:read_own` | Lire ses propres données     | etudiant  | read_own   |
| 2  | `etudiant:update_own`| Modifier ses propres données| etudiant  | update_own |

### Permissions Inscription

| ID | Nom                      | Description                             | Ressource     | Action     |
|----|--------------------------|-----------------------------------------|---------------|------------|
| 3  | `inscription:create_own` | Créer sa propre inscription             |  inscription  | create_own |
| 4  | `inscription:read_own`   | Lire sa propre inscription              |  inscription  | read_own   |
| 5  | `inscription:update_own` | Modifier sa propre inscription          |  inscription  | update_own |
| 6  | `inscription:read_level` | Lire les inscriptions de son niveau     |  inscription  | read_level |
| 7  | `inscription:approve_level`| Approuver les inscriptions de son niveau| inscription | approve_level|
| 8  | `inscription:read_all`   | Lire toutes les inscriptions            |  inscription  | read_all   |
| 9  | `inscription:approve_all`| Approuver toutes les inscriptions       |  inscription  | approve_all|

### Permissions Note

| ID |         Nom        |          Description           | Ressource |   Action   |
|----|--------------------|--------------------------------|-----------|------------|
| 10 | `note:read_own`    | Lire ses propres notes         |    note   | read_own   |
| 11 | `note:read_level`  | Lire les notes de son niveau   |    note   | read_level |
| 12 | `note:create_level`| Créer des notes pour son niveau|    note   | create_level |
| 13 | `note:update_level`| Modifier les notes de son niveau|   note   | update_level |
| 14 | `note:read_all`    | Lire toutes les notes          |    note   | read_all   |
| 15 | `note:manage_all`  | Gérer toutes les notes         |    note   | manage_all |

### Permissions Pièce Jointe

| ID |            Nom            |               Description           |  Ressource   |   Action   |
|----|---------------------------|-------------------------------------|--------------|------------|
| 16 | `piece_jointe:create_own` | Uploader ses propres pièces jointes | piece_jointe | create_own |
| 17 | `piece_jointe:read_own`   | Lire ses propres pièces jointes     | piece_jointe | read_own   |
| 18 | `piece_jointe:read_level` | Lire les pièces jointes de son niveau| piece_jointe| read_level |

### Permissions Niveau

| ID | Nom                 |     Description       |  Ressource  |   Action    |
|----|---------------------|-----------------------|-------------|-------------|
| 19 | `niveau:read_all`   | Lire tous les niveaux |    niveau   |   read_all  |
| 20 | `niveau:manage_all` | Gérer tous les niveaux|    niveau   |  manage_all |

### Permissions Utilisateur

| ID |            Nom            |            Description         | Ressource |       Action       |
|----|---------------------------|--------------------------------|-----------|--------------------| 
| 21 | `user:manage_responsable` | Gérer les comptes responsables |    user   | manage_responsable |
| 22 | `user:manage_scolarite`   | Gérer les comptes scolarité    |    user   | manage_scolarite   |

---

## Configuration par Défaut des Rôles

### Rôle : Étudiant

**Description :** Étudiant - accès limité à ses propres données

**Permissions assignées (9) :**
- `etudiant:read_own` - Lire ses propres données
- `etudiant:update_own` - Modifier ses propres données
- `inscription:create_own` - Créer sa propre inscription
- `inscription:read_own` - Lire sa propre inscription
- `inscription:update_own` - Modifier sa propre inscription
- `note:read_own` - Lire ses propres notes
- `piece_jointe:create_own` - Uploader ses propres pièces jointes
- `piece_jointe:read_own` - Lire ses propres pièces jointes
- `niveau:read_all` - Lire tous les niveaux

### Rôle : Responsable

**Description :** Responsable de niveau - gestion des inscriptions de son niveau

**Permissions assignées (7) :**
- `inscription:read_level` - Lire les inscriptions de son niveau
- `inscription:approve_level` - Approuver les inscriptions de son niveau
- `note:read_level` - Lire les notes de son niveau
- `note:create_level` - Créer des notes pour son niveau
- `note:update_level` - Modifier les notes de son niveau
- `piece_jointe:read_level` - Lire les pièces jointes de son niveau
- `niveau:read_all` - Lire tous les niveaux

### Rôle : Scolarité

**Description :** Scolarité - accès administratif global

**Permissions assignées (8) :**
- `inscription:read_all` - Lire toutes les inscriptions
- `inscription:approve_all` - Approuver toutes les inscriptions
- `note:read_all` - Lire toutes les notes
- `note:manage_all` - Gérer toutes les notes
- `niveau:read_all` - Lire tous les niveaux
- `niveau:manage_all` - Gérer tous les niveaux
- `user:manage_responsable` - Gérer les comptes responsables
- `user:manage_scolarite` - Gérer les comptes scolarité

---

## Matrice Rôle-Permission

| Permission              | Étudiant  | Responsable|  Scolarité  |
|-------------------------|-----------|------------|-------------
| etudiant:read_own       |     ✅    |    ❌     |     ❌     |
| etudiant:update_own     |     ✅    |    ❌     |     ❌     |
| inscription:create_own  |     ✅    |    ❌     |     ❌     |
| inscription:read_own    |     ✅    |    ❌     |     ❌     |
| inscription:update_own  |     ✅    |    ❌     |     ❌     |
| inscription:read_level  |     ❌    |    ✅     |     ❌     |
| inscription:approve_level|    ❌    |    ✅     |     ❌     |
| inscription:read_all    |     ❌    |    ❌     |     ✅     |
| inscription:approve_all |     ❌    |    ❌     |     ✅     |
| note:read_own           |     ✅    |    ❌     |     ❌     |
| note:read_level         |     ❌    |    ✅     |     ❌     |
| note:create_level       |     ❌    |    ✅     |     ❌     |
| note:update_level       |     ❌    |    ✅     |     ❌     |
| note:read_all           |     ❌    |    ❌     |     ✅     |
| note:manage_all         |     ❌    |    ❌     |     ✅     |
| piece_jointe:create_own |     ✅    |    ❌     |     ❌     |
| piece_jointe:read_own   |     ✅    |    ❌     |     ❌     |
| piece_jointe:read_level |     ❌    |    ✅     |     ❌     |
| niveau:read_all         |     ✅    |    ✅     |     ✅     |
| niveau:manage_all       |     ❌    |    ❌     |     ✅     |
| user:manage_responsable |     ❌    |    ❌     |     ✅     |
| user:manage_scolarite   |     ❌    |    ❌     |     ✅     |

---

## Résumé

- **Total des permissions :** 22
- **Total des rôles :** 3
- **Permissions par rôle :**
  - Étudiant : 9 permissions
  - Responsable : 7 permissions
  - Scolarité : 8 permissions

