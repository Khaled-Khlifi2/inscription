# Système RBAC - Guide d'utilisation

## Vue d'ensemble

Le système RBAC (Role-Based Access Control) a été implémenté pour permettre une gestion fine des permissions tout en conservant la compatibilité avec le système existant.

## Architecture

### Modèles de données

- **Role** : Rôles utilisateurs (etudiant, responsable, scolarite)
- **Permission** : Permissions granulaires (ex: `inscription:read_own`, `note:create_level`)
- **UserRole** : Table de liaison entre utilisateurs et rôles
- **RolePermission** : Table de liaison entre rôles et permissions

### Rôles par défaut

1. **etudiant** : Accès limité à ses propres données
2. **responsable** : Gestion des inscriptions de son niveau
3. **scolarite** : Accès administratif global

### Permissions par défaut

#### Étudiant
- `etudiant:read_own` - Lire ses propres données
- `etudiant:update_own` - Modifier ses propres données
- `inscription:create_own` - Créer sa propre inscription
- `inscription:read_own` - Lire sa propre inscription
- `inscription:update_own` - Modifier sa propre inscription
- `note:read_own` - Lire ses propres notes
- `piece_jointe:create_own` - Uploader ses propres pièces jointes
- `piece_jointe:read_own` - Lire ses propres pièces jointes
- `niveau:read_all` - Lire tous les niveaux

#### Responsable
- `inscription:read_level` - Lire les inscriptions de son niveau
- `inscription:approve_level` - Approuver les inscriptions de son niveau
- `note:read_level` - Lire les notes de son niveau
- `note:create_level` - Créer des notes pour son niveau
- `note:update_level` - Modifier les notes de son niveau
- `piece_jointe:read_level` - Lire les pièces jointes de son niveau
- `niveau:read_all` - Lire tous les niveaux

#### Scolarité
- `inscription:read_all` - Lire toutes les inscriptions
- `inscription:approve_all` - Approuver toutes les inscriptions
- `note:read_all` - Lire toutes les notes
- `note:manage_all` - Gérer toutes les notes
- `niveau:read_all` - Lire tous les niveaux
- `niveau:manage_all` - Gérer tous les niveaux
- `user:manage_responsable` - Gérer les comptes responsables
- `user:manage_scolarite` - Gérer les comptes scolarité

## Installation

### 1. Exécuter la migration Alembic

```bash
cd backend
alembic upgrade head
```

Cela créera les tables : `roles`, `permissions`, `role_permissions`, `user_roles`.

### 2. Initialiser les rôles et permissions

```bash
python scripts/init_rbac.py
```

Ce script :
- Crée les rôles par défaut
- Crée les permissions par défaut
- Associe les permissions aux rôles
- Migre les utilisateurs existants vers le nouveau système

## Utilisation dans les endpoints

### Ancien système (toujours compatible)

Les anciennes dépendances continuent de fonctionner :

```python
from app.core.dependencies import require_etudiant, require_scolarite, require_responsable

@router.get("/etudiant/profile")
async def get_profile(current_user: dict = Depends(require_etudiant)):
    # ...
```

### Nouveau système RBAC

Pour une gestion plus fine des permissions :

```python
from app.core.dependencies import has_permission, require_any_permission, require_all_permissions

# Vérifier une permission spécifique
@router.post("/inscription")
async def create_inscription(current_user: dict = Depends(has_permission("inscription:create_own"))):
    # ...

# Vérifier au moins une permission parmi plusieurs
@router.get("/inscriptions")
async def list_inscriptions(current_user: dict = Depends(require_any_permission("inscription:read_own", "inscription:read_level", "inscription:read_all"))):
    # ...

# Vérifier toutes les permissions requises
@router.delete("/inscription/{id}")
async def delete_inscription(current_user: dict = Depends(require_all_permissions("inscription:read_all", "inscription:approve_all"))):
    # ...
```

## Gestion des permissions

### Ajouter une nouvelle permission

```python
from app.models.models import Permission
from app.db.session import get_db

async def add_permission(db: AsyncSession):
    permission = Permission(
        name="nouvelle:permission",
        resource="nouvelle_ressource",
        action="nouvelle_action",
        description="Description de la permission"
    )
    db.add(permission)
    await db.commit()
```

### Associer une permission à un rôle

```python
from app.models.models import RolePermission

async def add_permission_to_role(db: AsyncSession, role_id: int, permission_id: int):
    role_perm = RolePermission(role_id=role_id, permission_id=permission_id)
    db.add(role_perm)
    await db.commit()
```

### Assigner un rôle à un utilisateur

```python
from app.models.models import UserRole

async def assign_role_to_user(db: AsyncSession, user_type: str, user_id: int, role_id: int):
    user_role = UserRole(user_type=user_type, user_id=user_id, role_id=role_id)
    db.add(user_role)
    await db.commit()
```

## Compatibilité

Le système RBAC est conçu pour être **rétrocompatible** :

1. **Fallback automatique** : Si un utilisateur n'a pas de rôle RBAC, le système utilise les permissions par défaut basées sur son type (etudiant, responsable, scolarite).
2. **Anciennes dépendances** : Les fonctions `require_etudiant`, `require_scolarite`, `require_responsable` continuent de fonctionner.
3. **Migration progressive** : Vous pouvez migrer progressivement les endpoints vers le nouveau système RBAC sans casser les fonctionnalités existantes.

## Structure des permissions

Les permissions suivent le format : `ressource:action`

- **ressource** : La ressource concernée (etudiant, inscription, note, etc.)
- **action** : L'action autorisée (read, create, update, delete, etc.)

**Suffixes spéciaux** :
- `_own` : Action sur ses propres données
- `_level` : Action sur les données de son niveau (pour les responsables)
- `_all` : Action sur toutes les données (pour la scolarité)

## Exemples d'utilisation

### Créer un nouveau rôle personnalisé

```python
from app.models.models import Role, Permission, RolePermission

async def create_custom_role(db: AsyncSession):
    # Créer le rôle
    role = Role(name="custom_role", description="Rôle personnalisé")
    db.add(role)
    await db.flush()
    
    # Associer des permissions existantes
    perm1 = await db.get(Permission, 1)  # inscription:read_all
    perm2 = await db.get(Permission, 2)  # note:read_all
    
    db.add(RolePermission(role_id=role.id, permission_id=perm1.id))
    db.add(RolePermission(role_id=role.id, permission_id=perm2.id))
    await db.commit()
```

### Vérifier les permissions d'un utilisateur

```python
from app.services.auth_service import get_user_permissions

async def check_user_permissions(db: AsyncSession, user_type: str, user_id: int):
    permissions = await get_user_permissions(db, user_type, user_id)
    print(f"Permissions de l'utilisateur : {permissions}")
```

## Dépannage

### Les permissions ne sont pas chargées dans le token

Vérifiez que :
1. La migration Alembic a été exécutée
2. Le script `init_rbac.py` a été exécuté
3. L'utilisateur a un rôle assigné dans la table `user_roles`

### Erreur "Permission requise"

L'utilisateur n'a pas la permission nécessaire. Vous pouvez :
1. Vérifier les permissions de l'utilisateur via `get_user_permissions()`
2. Ajouter la permission manquante à son rôle
3. Assigner un rôle différent à l'utilisateur

### Fallback aux permissions par défaut

Si vous voyez que les utilisateurs utilisent le fallback (permissions par défaut), exécutez le script `init_rbac.py` pour migrer tous les utilisateurs vers le nouveau système RBAC.
