"""
Script d'initialisation RBAC

Ce script crée les rôles et permissions par défaut, puis migre les utilisateurs existants
vers le nouveau système RBAC.

Usage:
    python scripts/init_rbac.py
"""
import asyncio
import sys
from pathlib import Path

# Ajouter le répertoire parent au path pour les imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    Etudiant, UserResponsable, UserScolarite,
    Role, Permission, RolePermission, UserRole
)


# Définition des rôles par défaut
DEFAULT_ROLES = [
    {
        "name": "etudiant",
        "description": "Étudiant - accès limité à ses propres données",
    },
    {
        "name": "responsable",
        "description": "Responsable de niveau - gestion des inscriptions de son niveau",
    },
    {
        "name": "scolarite",
        "description": "Scolarité - accès administratif global",
    },
]

# Définition des permissions par défaut
DEFAULT_PERMISSIONS = [
    # Permissions Étudiant
    {"name": "etudiant:read_own", "resource": "etudiant", "action": "read_own", "description": "Lire ses propres données"},
    {"name": "etudiant:update_own", "resource": "etudiant", "action": "update_own", "description": "Modifier ses propres données"},
    
    # Permissions Inscription
    {"name": "inscription:create_own", "resource": "inscription", "action": "create_own", "description": "Créer sa propre inscription"},
    {"name": "inscription:read_own", "resource": "inscription", "action": "read_own", "description": "Lire sa propre inscription"},
    {"name": "inscription:update_own", "resource": "inscription", "action": "update_own", "description": "Modifier sa propre inscription"},
    {"name": "inscription:read_level", "resource": "inscription", "action": "read_level", "description": "Lire les inscriptions de son niveau"},
    {"name": "inscription:approve_level", "resource": "inscription", "action": "approve_level", "description": "Approuver les inscriptions de son niveau"},
    {"name": "inscription:read_all", "resource": "inscription", "action": "read_all", "description": "Lire toutes les inscriptions"},
    {"name": "inscription:approve_all", "resource": "inscription", "action": "approve_all", "description": "Approuver toutes les inscriptions"},
    
    # Permissions Note
    {"name": "note:read_own", "resource": "note", "action": "read_own", "description": "Lire ses propres notes"},
    {"name": "note:read_level", "resource": "note", "action": "read_level", "description": "Lire les notes de son niveau"},
    {"name": "note:create_level", "resource": "note", "action": "create_level", "description": "Créer des notes pour son niveau"},
    {"name": "note:update_level", "resource": "note", "action": "update_level", "description": "Modifier les notes de son niveau"},
    {"name": "note:read_all", "resource": "note", "action": "read_all", "description": "Lire toutes les notes"},
    {"name": "note:manage_all", "resource": "note", "action": "manage_all", "description": "Gérer toutes les notes"},
    
    # Permissions Pièce Jointe
    {"name": "piece_jointe:create_own", "resource": "piece_jointe", "action": "create_own", "description": "Uploader ses propres pièces jointes"},
    {"name": "piece_jointe:read_own", "resource": "piece_jointe", "action": "read_own", "description": "Lire ses propres pièces jointes"},
    {"name": "piece_jointe:read_level", "resource": "piece_jointe", "action": "read_level", "description": "Lire les pièces jointes de son niveau"},
    
    # Permissions Niveau
    {"name": "niveau:read_all", "resource": "niveau", "action": "read_all", "description": "Lire tous les niveaux"},
    {"name": "niveau:manage_all", "resource": "niveau", "action": "manage_all", "description": "Gérer tous les niveaux"},
    
    # Permissions User
    {"name": "user:manage_responsable", "resource": "user", "action": "manage_responsable", "description": "Gérer les comptes responsables"},
    {"name": "user:manage_scolarite", "resource": "user", "action": "manage_scolarite", "description": "Gérer les comptes scolarité"},
]

# Association rôle-permissions par défaut
ROLE_PERMISSIONS = {
    "etudiant": [
        "etudiant:read_own",
        "etudiant:update_own",
        "inscription:create_own",
        "inscription:read_own",
        "inscription:update_own",
        "note:read_own",
        "piece_jointe:create_own",
        "piece_jointe:read_own",
        "niveau:read_all",
    ],
    "responsable": [
        "inscription:read_level",
        "inscription:approve_level",
        "note:read_level",
        "note:create_level",
        "note:update_level",
        "piece_jointe:read_level",
        "niveau:read_all",
    ],
    "scolarite": [
        "inscription:read_all",
        "inscription:approve_all",
        "note:read_all",
        "note:manage_all",
        "niveau:read_all",
        "niveau:manage_all",
        "user:manage_responsable",
        "user:manage_scolarite",
    ],
}


async def create_roles_and_permissions(db: AsyncSession):
    """Crée les rôles et permissions par défaut"""
    print("📋 Création des rôles par défaut...")
    
    # Créer les rôles
    roles_dict = {}
    for role_data in DEFAULT_ROLES:
        result = await db.execute(
            select(Role).where(Role.name == role_data["name"])
        )
        existing_role = result.scalar_one_or_none()
        
        if not existing_role:
            role = Role(**role_data)
            db.add(role)
            await db.flush()
            roles_dict[role.name] = role
            print(f"  ✅ Rôle créé : {role.name}")
        else:
            roles_dict[role.name] = existing_role
            print(f"  ℹ️  Rôle existe déjà : {role.name}")
    
    print("\n📋 Création des permissions par défaut...")
    
    # Créer les permissions
    permissions_dict = {}
    for perm_data in DEFAULT_PERMISSIONS:
        result = await db.execute(
            select(Permission).where(Permission.name == perm_data["name"])
        )
        existing_perm = result.scalar_one_or_none()
        
        if not existing_perm:
            permission = Permission(**perm_data)
            db.add(permission)
            await db.flush()
            permissions_dict[permission.name] = permission
            print(f"  ✅ Permission créée : {permission.name}")
        else:
            permissions_dict[permission.name] = existing_perm
            print(f"  ℹ️  Permission existe déjà : {permission.name}")
    
    print("\n📋 Association des permissions aux rôles...")
    
    # Associer les permissions aux rôles
    for role_name, perm_names in ROLE_PERMISSIONS.items():
        role = roles_dict[role_name]
        
        for perm_name in perm_names:
            permission = permissions_dict[perm_name]
            
            # Vérifier si l'association existe déjà
            result = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == permission.id
                )
            )
            existing_assoc = result.scalar_one_or_none()
            
            if not existing_assoc:
                assoc = RolePermission(role_id=role.id, permission_id=permission.id)
                db.add(assoc)
                print(f"  ✅ {role_name} ← {perm_name}")
            else:
                print(f"  ℹ️  {role_name} ← {perm_name} (existe déjà)")
    
    await db.commit()
    print("\n✅ Rôles et permissions initialisés avec succès!")
    return roles_dict


async def migrate_existing_users(db: AsyncSession, roles_dict: dict):
    """Migre les utilisateurs existants vers le nouveau système RBAC"""
    print("\n📋 Migration des utilisateurs existants...")
    
    # Migrer les étudiants
    print("\n  🎓 Étudiants...")
    result = await db.execute(select(Etudiant).where(Etudiant.is_active == True))
    etudiants = result.scalars().all()
    
    for etudiant in etudiants:
        # Vérifier si l'étudiant a déjà un rôle
        result = await db.execute(
            select(UserRole).where(
                UserRole.user_type == "etudiant",
                UserRole.user_id == etudiant.id
            )
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            role = roles_dict["etudiant"]
            user_role = UserRole(
                user_type="etudiant",
                user_id=etudiant.id,
                role_id=role.id
            )
            db.add(user_role)
            print(f"    ✅ {etudiant.mat_cin} → rôle etudiant")
        else:
            print(f"    ℹ️  {etudiant.mat_cin} → déjà migré")
    
    # Migrer les responsables
    print("\n  👨‍💼 Responsables...")
    result = await db.execute(select(UserResponsable).where(UserResponsable.is_active == True))
    responsables = result.scalars().all()
    
    for resp in responsables:
        result = await db.execute(
            select(UserRole).where(
                UserRole.user_type == "responsable",
                UserRole.user_id == resp.id
            )
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            role = roles_dict["responsable"]
            user_role = UserRole(
                user_type="responsable",
                user_id=resp.id,
                role_id=role.id
            )
            db.add(user_role)
            print(f"    ✅ {resp.email} → rôle responsable")
        else:
            print(f"    ℹ️  {resp.email} → déjà migré")
    
    # Migrer la scolarité
    print("\n  🏢 Scolarité...")
    result = await db.execute(select(UserScolarite).where(UserScolarite.is_active == True))
    scolarite_users = result.scalars().all()
    
    for scolarite in scolarite_users:
        result = await db.execute(
            select(UserRole).where(
                UserRole.user_type == "scolarite",
                UserRole.user_id == scolarite.id
            )
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            role = roles_dict["scolarite"]
            user_role = UserRole(
                user_type="scolarite",
                user_id=scolarite.id,
                role_id=role.id
            )
            db.add(user_role)
            print(f"    ✅ {scolarite.email} → rôle scolarite")
        else:
            print(f"    ℹ️  {scolarite.email} → déjà migré")
    
    await db.commit()
    print("\n✅ Migration des utilisateurs terminée!")


async def main():
    """Fonction principale"""
    print("🚀 Initialisation du système RBAC...\n")
    
    async with AsyncSessionLocal() as async_session:
        try:
            # Créer les rôles et permissions
            roles_dict = await create_roles_and_permissions(async_session)
            
            # Migrer les utilisateurs existants
            await migrate_existing_users(async_session, roles_dict)
            
            print("\n" + "="*50)
            print("✅ Initialisation RBAC terminée avec succès!")
            print("="*50)
            
        except Exception as e:
            await async_session.rollback()
            print(f"\n❌ Erreur lors de l'initialisation : {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())
