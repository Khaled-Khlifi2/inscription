"""Generation du recu d'inscription etudiant."""
import base64
import hashlib
import os
from datetime import datetime
from html import escape

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.etudiant_service import ANNEE_EN_COURS, EtudiantService


def _txt(value, default="-") -> str:
    if value is None or value == "":
        return default
    return escape(str(value))


def _date(value) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y")
    return escape(str(value))


def _datetime(value) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    return escape(str(value))


def _photo_data_uri(inscription) -> str | None:
    photo = next((p for p in inscription.pieces_jointes if p.type_document == "photo"), None)
    if not photo or not photo.chemin or not os.path.exists(photo.chemin):
        return None
    with open(photo.chemin, "rb") as f:
        content = f.read()
    mime = photo.mime_type or "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}"


def _qr_like(seed: str) -> str:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    bits = "".join(f"{b:08b}" for b in digest)
    cells = []
    i = 0
    for y in range(21):
        for x in range(21):
            finder = (
                (x < 7 and y < 7)
                or (x >= 14 and y < 7)
                or (x < 7 and y >= 14)
            )
            if finder:
                local_x = x % 14
                local_y = y % 14
                on = (
                    local_x in {0, 1, 5, 6}
                    or local_y in {0, 1, 5, 6}
                    or (2 <= local_x <= 4 and 2 <= local_y <= 4)
                )
            else:
                on = bits[i % len(bits)] == "1"
                i += 1
            if on:
                cells.append(f'<span style="grid-column:{x + 1};grid-row:{y + 1}"></span>')
    return "".join(cells)


class ReceiptService:
    @staticmethod
    async def build_inscription_receipt_html(db: AsyncSession, mat_cin: str) -> str:
        etudiant = await EtudiantService.get_by_mat_cin(db, mat_cin)
        inscription = next(
            (
                i for i in etudiant.inscriptions
                if i.annee_universitaire == ANNEE_EN_COURS and i.statut == "validee"
            ),
            None,
        )
        if not inscription:
            raise HTTPException(
                status_code=409,
                detail="Le recu est disponible uniquement apres validation de l'inscription.",
            )

        full_name = f"{etudiant.prenom_fr or ''} {etudiant.nom_fr or ''}".strip()
        niveau = etudiant.niveau.libelle if etudiant.niveau else "-"
        filiere = etudiant.lib_filiere or etudiant.cfil or "-"
        approval_date = _date(inscription.traite_le or etudiant.completed_at)
        created_at = _datetime(datetime.now())
        receipt_ref = f"REC-{inscription.id}-{etudiant.mat_cin}"
        photo_uri = _photo_data_uri(inscription)
        qr = _qr_like(f"{receipt_ref}|{full_name}|{ANNEE_EN_COURS}")

        photo_html = (
            f'<img src="{photo_uri}" alt="Photo etudiant"/>'
            if photo_uri
            else '<div class="photo-placeholder">PHOTO</div>'
        )

        return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Recu d'inscription - {_txt(etudiant.mat_cin)}</title>
  <style>
    @page {{ size: A4; margin: 9mm; }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: #e5e7eb;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
    }}
    .toolbar {{
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 12px;
      background: #111827;
    }}
    .toolbar button {{
      border: 0;
      border-radius: 8px;
      background: #16a34a;
      color: white;
      font-weight: 700;
      padding: 10px 16px;
      cursor: pointer;
    }}
    .page {{
      width: 210mm;
      min-height: 297mm;
      margin: 18px auto;
      padding: 10mm 11mm 14mm;
      background: white;
      position: relative;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(15, 23, 42, .18);
    }}
    .corner {{
      position: absolute;
      top: 0;
      left: 0;
      width: 38mm;
      height: 38mm;
      background: linear-gradient(135deg, #d1d5db 0 50%, transparent 50%);
    }}
    .header {{
      display: grid;
      grid-template-columns: 52mm 1fr 38mm;
      border: 2px solid #1d2fb5;
      min-height: 21mm;
      position: relative;
      z-index: 1;
    }}
    .logo {{
      border-right: 2px solid #1d2fb5;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 5px;
    }}
    .logo-lines {{
      color: #172554;
      font-size: 11px;
      letter-spacing: 4px;
      line-height: 1.25;
      border-bottom: 2px solid #1d2fb5;
    }}
    .logo-isi {{ color: #087a14; font-size: 34px; font-weight: 900; }}
    .title {{
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #087a14;
      font-weight: 800;
      text-align: center;
      font-size: 18px;
      line-height: 1.25;
    }}
    .title span {{ font-weight: 500; }}
    .meta {{
      border-left: 2px solid #1d2fb5;
      display: grid;
      grid-template-rows: 1fr 1.3fr 1fr;
      text-align: center;
      font-size: 12px;
      font-weight: 700;
    }}
    .meta div {{ display: flex; align-items: center; justify-content: center; border-bottom: 2px solid #1d2fb5; padding: 3px; }}
    .meta div:last-child {{ border-bottom: 0; }}
    .program {{
      display: grid;
      grid-template-columns: 1fr 34mm;
      gap: 8mm;
      align-items: start;
      margin: 8mm 6mm 7mm;
      color: #0915b8;
      text-align: center;
    }}
    .program h1 {{ margin: 10mm 0 1mm; font-size: 20px; }}
    .program p {{ margin: 0; font-size: 16px; font-weight: 600; }}
    .qr {{
      display: grid;
      grid-template-columns: repeat(21, 1fr);
      grid-template-rows: repeat(21, 1fr);
      width: 31mm;
      height: 31mm;
      gap: 1px;
      margin: 0 auto 3mm;
      background: white;
    }}
    .qr span {{ background: #000; }}
    .qr-label {{ color: #6b7280; font-size: 14px; font-weight: 700; }}
    .identity {{
      display: grid;
      grid-template-columns: 1fr 38mm;
      gap: 5mm;
      align-items: stretch;
      margin-bottom: 5mm;
    }}
    .id-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1px;
      background: white;
    }}
    .cell {{
      background: #f0f0f0;
      padding: 8px 10px;
      min-height: 12mm;
      color: #6b7280;
      font-size: 15px;
    }}
    .cell.large {{ min-height: 23mm; display: flex; align-items: center; }}
    .cell b, .line b {{ color: #111827; font-size: 15px; }}
    .ar {{ direction: rtl; text-align: right; font-weight: 700; }}
    .photo {{
      border: 2px solid #111827;
      padding: 2mm;
      height: 40mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .photo img {{ width: 100%; height: 100%; object-fit: cover; }}
    .photo-placeholder {{
      width: 100%;
      height: 100%;
      background: #e5e7eb;
      color: #6b7280;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      letter-spacing: 2px;
    }}
    .section-title {{
      background: #283593;
      color: white;
      text-align: center;
      font-weight: 900;
      padding: 8px;
      margin-top: 6mm;
      font-size: 15px;
      text-transform: uppercase;
    }}
    .line {{
      background: #f0f0f0;
      padding: 8px 10px;
      color: #6b7280;
      font-size: 15px;
      min-height: 9mm;
    }}
    .line.white {{ background: white; }}
    .two {{ display: grid; grid-template-columns: 1fr 1fr; gap: 1px; }}
    .slash {{ color: #08851d; font-weight: 900; padding: 0 7px; }}
    .footer {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: end;
      gap: 12mm;
      margin-top: 12mm;
    }}
    .level-box {{
      background: #c93567;
      color: white;
      font-size: 48px;
      line-height: 1;
      font-weight: 900;
      text-align: center;
      padding: 12mm 8mm;
    }}
    .signature {{ text-align: center; color: #4b5563; font-size: 13px; }}
    .signature .script {{ margin-top: 10mm; font-style: italic; font-weight: 700; color: #374151; }}
    .bottom-band {{
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 15mm;
      border-bottom: 5mm solid #283593;
      background: linear-gradient(145deg, transparent 0 68%, #d7376e 68% 100%);
    }}
    .welcome {{
      position: absolute;
      right: 16mm;
      bottom: 5mm;
      color: white;
      font-size: 22px;
      font-style: italic;
      font-weight: 700;
    }}
    @media print {{
      body {{ background: white; }}
      .toolbar {{ display: none; }}
      .page {{ margin: 0; box-shadow: none; width: auto; min-height: auto; }}
    }}
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
  <main class="page">
    <div class="corner"></div>
    <section class="header">
      <div class="logo">
        <div class="logo-lines">INSTITUT<br/>SUPERIEUR<br/>INFORMATIQUE<br/><span style="letter-spacing:0">المعهد العالي للإعلامية</span></div>
        <div class="logo-isi">ISI</div>
      </div>
      <div class="title">Reçu d'inscription administrative<br/><span>AU {escape(ANNEE_EN_COURS)}</span></div>
      <div class="meta">
        <div>GSA-FR-04-01</div>
        <div>Date d'approbation<br/>{approval_date}</div>
        <div>Page 1/1</div>
      </div>
    </section>

    <section class="program">
      <div>
        <h1>{_txt(niveau)}</h1>
        <p>{_txt(filiere)}</p>
      </div>
      <div>
        <div class="qr">{qr}</div>
        <div class="qr-label">{_txt(etudiant.cfil or etudiant.niveau.code if etudiant.niveau else etudiant.cfil)}</div>
      </div>
    </section>

    <section class="identity">
      <div class="id-grid">
        <div class="cell">Nom : <b>{_txt(etudiant.nom_fr)}</b></div>
        <div class="cell ar">اللقب : <b>{_txt(etudiant.nom_ar)}</b></div>
        <div class="cell">Prénom : <b>{_txt(etudiant.prenom_fr)}</b></div>
        <div class="cell ar">الاسم : <b>{_txt(etudiant.prenom_ar)}</b></div>
        <div class="cell large">Carte d'identité : <b>{_txt(etudiant.mat_cin)}</b></div>
        <div class="cell large">TEL : <b>{_txt(etudiant.telephone_portable)}</b><br/>Fixe : <b>{_txt(etudiant.telephone_fixe)}</b></div>
      </div>
      <div class="photo">{photo_html}</div>
    </section>

    <div class="section-title">Informations personnelles</div>
    <div class="two">
      <div class="line">Email : <b>{_txt(etudiant.email)}</b></div>
      <div class="line">Email personnel : <b>{_txt(etudiant.email)}</b></div>
      <div class="line white">Date de naissance : <b>{_txt(etudiant.date_naissance)}</b></div>
      <div class="line white">Nationalité : <b>Tunisienne</b> <span class="slash">/</span> Genre : <b>{_txt(etudiant.sexe)}</b></div>
      <div class="line">Lieu : <b>{_txt(etudiant.lieu_naiss_fr)}</b><br/>Gouvernorat: <b>{_txt(etudiant.code_gouvernorat)}</b></div>
      <div class="line ar">مكان الولادة: <b>{_txt(etudiant.lieu_naiss_ar)}</b><br/>ولاية الولادة: <b>{_txt(etudiant.code_gouvernorat)}</b></div>
    </div>
    <div class="line white">Adresse: <b>{_txt(etudiant.adresse_fr)}</b></div>

    <div class="section-title">Baccalauréat</div>
    <div class="line">Section : <b>{_txt(etudiant.bac_section or etudiant.code_type_bac)}</b>
      <span class="slash">/</span> Année: <b>{_txt(etudiant.bac_annee)}</b>
      <span class="slash">/</span> Gouvernorat: <b>{_txt(etudiant.code_gouvernorat)}</b>
    </div>
    <div class="line white">Session: <b>{_txt(etudiant.bac_session)}</b>
      <span class="slash">/</span> Moyenne: <b>{_txt(etudiant.bac_moyenne)}</b>
      <span class="slash">/</span> Mention: <b>{_txt(etudiant.bac_mention)}</b>
    </div>

    <div class="section-title">Contact en cas de besoin</div>
    <div class="two">
      <div class="line">Nom & Prénom: <b>{_txt((etudiant.contact_nom or '') + ' ' + (etudiant.contact_prenom or ''))}</b></div>
      <div class="line">Affiliation: <b>{_txt(etudiant.contact_affiliation)}</b></div>
      <div class="line white">Adresse: <b>{_txt(etudiant.contact_adresse)}</b></div>
      <div class="line white">Tél: <b>{_txt(etudiant.contact_tel)}</b></div>
    </div>

    <div class="line white" style="margin-top:6mm">J'autorise l'ISI à partager mes infos : <b>Oui</b></div>

    <section class="footer">
      <div class="level-box">{_txt(etudiant.cfil or (etudiant.niveau.code if etudiant.niveau else 'ISI'))}</div>
      <div class="signature">
        Document créé le : {created_at}<br/>
        Référence : {_txt(receipt_ref)}
        <div class="script">Je certifie que les informations ci-dessus sont exactes<br/>Signature</div>
      </div>
    </section>
    <div class="bottom-band"><div class="welcome">Welcome on board</div></div>
  </main>
</body>
</html>"""
