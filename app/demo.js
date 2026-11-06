// =====================================================================
// Signaler-DPF — MODE DÉMONSTRATION
// Remplace Supabase par une base fictive stockée dans le navigateur.
// Aucun courriel n'est réellement envoyé : ils sont listés dans « Courriels ».
// =====================================================================
(function () {
  const KEY = 'dpf_demo_v1';
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  const agoTs = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 12, 0, 0); return d.toISOString(); };
  const Y = new Date().getFullYear();

  // ---------- données fictives ----------
  function seed() {
    const G = 'claire.dupont@vnf.fr', B = 'antoine.roux@vnf.fr';
    const base = (o) => ({ phase: 2, statut: 'ouvert', photos: ['demo:photo'], carte: 'demo:carte', pv_photos: [], gps_lat: null, gps_lng: null, ...o });
    const car = (d, type, titre, plan) => ({ type_constat: type, intitule: titre, plan_action: plan, caracterise_par: G, caracterise_le: ago(d) });
    const list = [
      base({ constatant_email: 'camille.martin@vnf.fr', date_constat: ago(1), voie_eau: 'Canal du Nord', commentaire: 'Ponton en bois installé en rive droite, environ 50 m en aval de l’écluse. Une barque y est amarrée. Pas de panneau d’autorisation visible.', gps_lat: 49.5841, gps_lng: 2.9612 }),
      base({ constatant_email: 'julien.leroy@vnf.fr', date_constat: ago(9), voie_eau: 'Vieille Oise', commentaire: 'Dépôt de gravats et de déchets verts en haut de berge, accès par le chemin communal.' }),
      base({ constatant_email: 'sophie.petit@vnf.fr', date_constat: ago(6), voie_eau: 'Canal de la Somme', phase: 3, ...car(4, 'Occupation illégale', 'Abri de pêche non autorisé', 'Identifier l’occupant. Afficher un avertissement sur l’abri.'), commentaire: 'Abri en tôle construit sur la berge, utilisé par des pêcheurs.' }),
      base({ constatant_email: 'camille.martin@vnf.fr', date_constat: ago(24), voie_eau: 'Rivière Oise canalisée', phase: 3, ...car(21, 'Occupation illégale', 'Ponton privé sans titre, rive droite', 'Vérifier l’absence de titre dans GeDo. Afficher un avertissement sous 8 jours.'), avt_pdf: 'demo:avertissement.pdf', avt_photo: 'demo:photo', avt_date_affichage: ago(16), avt_valide_par: G, avt_valide_le: ago(16), commentaire: 'Ponton fixe avec garde-corps, raccordé à une propriété privée.' }),
      base({ constatant_email: 'sophie.petit@vnf.fr', date_constat: ago(14), voie_eau: 'Canal latéral à l’Oise', phase: 3, ...car(11, 'Occupation illégale', 'Clôture sur le chemin de halage', 'Afficher un avertissement, puis COSTU si la clôture demeure.'), avt_pdf: 'demo:avertissement.pdf', avt_photo: 'demo:photo', avt_date_affichage: ago(5), avt_valide_par: G, avt_valide_le: ago(5), commentaire: 'Clôture grillagée qui coupe le chemin de halage sur environ 30 m.' }),
      base({ constatant_email: 'laure.girard@vnf.fr', date_constat: ago(60), voie_eau: 'Canal de la Somme', phase: 4, ...car(57, 'Occupation illégale', 'Abri de jardin sur le DPF', 'Avertissement puis COSTU.'), avt_pdf: 'demo:avertissement.pdf', avt_photo: 'demo:photo', avt_date_affichage: ago(45), avt_valide_par: G, avt_valide_le: ago(45), costu_date_etab: ago(11), costu_numero: 'GEDO-2026-0458', costu_date_envoi: ago(10), costu_envoi_valide_par: G, costu_envoi_valide_le: ago(10), commentaire: 'Abri de jardin et potager installés sur la parcelle VNF.' }),
      base({ constatant_email: 'alain.moreau@vnf.fr', date_constat: ago(110), voie_eau: 'Canal latéral à l’Oise', phase: 4, ...car(105, 'Occupation illégale', 'Bateau-logement sans autorisation', 'Avertissement, COSTU, puis PV si nécessaire.'), avt_pdf: 'demo:avertissement.pdf', avt_photo: 'demo:photo', avt_date_affichage: ago(95), avt_valide_par: G, avt_valide_le: ago(95), costu_date_etab: ago(70), costu_numero: 'GEDO-2026-0391', costu_date_envoi: ago(68), costu_envoi_valide_par: G, costu_envoi_valide_le: ago(68), costu_date_reception: ago(35), costu_fin_valide_par: G, costu_fin_valide_le: ago(34), commentaire: 'Péniche habitée amarrée en permanence hors zone autorisée.' }),
      base({ constatant_email: 'julien.leroy@vnf.fr', date_constat: ago(150), voie_eau: 'Canal du Nord', phase: 5, ...car(146, 'Dégradation', 'Stockage de matériaux sur le quai', 'Avertissement, COSTU puis PV de grande voirie.'), avt_pdf: 'demo:avertissement.pdf', avt_photo: 'demo:photo', avt_date_affichage: ago(140), avt_valide_par: G, avt_valide_le: ago(140), costu_date_etab: ago(120), costu_numero: 'GEDO-2026-0312', costu_date_envoi: ago(119), costu_envoi_valide_par: G, costu_envoi_valide_le: ago(119), costu_date_reception: ago(100), costu_fin_valide_par: G, costu_fin_valide_le: ago(99), pv_date_visite: ago(25), pv_photos: ['demo:photo'], pv_projet: 'demo:projet_PV.docx', bajc_sollicite_le: ago(22), commentaire: 'Stockage de parpaings et de sable sur le quai, gênant l’accès des bateaux.' }),
      base({ constatant_email: 'paul.bernard@vnf.fr', date_constat: ago(260), voie_eau: 'Rivière Oise canalisée', phase: 6, ...car(255, 'Dégradation', 'Rejet non autorisé', 'Constat, avertissement, COSTU puis PV.'), avt_pdf: 'demo:avertissement.pdf', avt_photo: 'demo:photo', avt_date_affichage: ago(245), avt_valide_par: G, avt_valide_le: ago(245), costu_date_etab: ago(225), costu_numero: 'GEDO-2026-0105', costu_date_envoi: ago(224), costu_envoi_valide_par: G, costu_envoi_valide_le: ago(224), costu_date_reception: ago(205), costu_fin_valide_par: G, costu_fin_valide_le: ago(204), pv_date_visite: ago(170), pv_photos: ['demo:photo'], pv_projet: 'demo:projet_PV.docx', bajc_sollicite_le: ago(168), bajc_retour_le: ago(150), pv_signe: 'demo:PV_signe.pdf', pv_notification: 'demo:notification_PV.pdf', pv_preuve_envoi: 'demo:preuve_envoi.pdf', pv_date_envoi: ago(140), pv_envoi_valide_par: G, pv_envoi_valide_le: ago(140), pv_date_fin_notif: ago(120), pv_resultat: 'delivre', pv_fin_valide_par: G, pv_fin_valide_le: ago(119), tribunal_saisi_le: ago(48), tribunal_valide_par: B, commentaire: 'Canalisation rejetant des eaux grises directement dans la rivière.' }),
      base({ constatant_email: 'camille.martin@vnf.fr', date_constat: ago(80), voie_eau: 'Rivière Aisne canalisée', phase: 3, statut: 'regularise', ...car(76, 'Occupation illégale', 'Clôture déplacée en limite du DPF', 'Avertissement.'), avt_pdf: 'demo:avertissement.pdf', avt_photo: 'demo:photo', avt_date_affichage: ago(70), avt_valide_par: G, avt_valide_le: ago(70), regularise_le: ago(58), regularisation_commentaire: 'Le riverain a reculé sa clôture en limite de propriété. Vérifié sur place.', regularise_par: G, commentaire: 'Clôture posée sur le domaine public.' }),
      base({ constatant_email: 'laure.girard@vnf.fr', date_constat: ago(30), voie_eau: 'Rivière Aisne canalisée', statut: 'classe', ...car(28, 'Situation normale', 'Barque amarrée temporairement', 'Aucune suite : amarrage autorisé.'), commentaire: 'Barque amarrée près du pont, à vérifier.' })
    ];
    const db = { constats: [], journal: [], roles: [], outbox: [], files: {}, seq: { cst: 100, avt: 30, pv: 10, jug: 3, id: 0, j: 0, m: 0 } };
    // ordre chronologique de création
    list.sort((a, b) => a.date_constat.localeCompare(b.date_constat)).forEach((c) => {
      const r = { id: ++db.seq.id, created_at: agoTs(Math.round((Date.now() - new Date(c.date_constat)) / 864e5)), constatant_nom: nameOf(c.constatant_email), ...c };
      r.numero = `CST-${Y}-${pad4(++db.seq.cst)}`;
      trig(db, r);
      db.constats.push(r);
      journalSeed(db, r);
    });
    return db;
  }
  const pad4 = (n) => String(n).padStart(4, '0');
  const nameOf = (e) => (String(e).split('@')[0] || '').split(/[._-]+/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
  function trig(db, n) {
    if (n.avt_valide_le && !n.avt_numero) n.avt_numero = `AVT-${Y}-${pad4(++db.seq.avt)}`;
    if (n.bajc_sollicite_le && !n.pv_numero) n.pv_numero = `PV-${Y}-${pad4(++db.seq.pv)}`;
    if (n.jugement_recu_le && !n.jug_numero) n.jug_numero = `JUG-${Y}-${pad4(++db.seq.jug)}`;
    return n;
  }
  function journalSeed(db, c) {
    const add = (date, par, texte) => { if (date) db.journal.push({ id: ++db.seq.j, constat_id: c.id, at: new Date(date + 'T10:00:00').toISOString(), par, texte }); };
    add(c.date_constat, c.constatant_email, `Constat déposé par ${nameOf(c.constatant_email)}`);
    add(c.caracterise_le, c.caracterise_par, `Caractérisation validée (${c.type_constat})${c.statut === 'classe' ? ' · dossier classé' : ''}`);
    add(c.avt_valide_le, c.avt_valide_par, `Affichage de l’avertissement ${c.avt_numero} validé`);
    add(c.costu_envoi_valide_le, c.costu_envoi_valide_par, `Envoi du COSTU n° ${c.costu_numero} validé`);
    add(c.costu_fin_valide_le, c.costu_fin_valide_par, 'Fin de la notification du COSTU validée');
    add(c.bajc_sollicite_le, 'claire.dupont@vnf.fr', `Projet de PV ${c.pv_numero} transmis au BAJC pour relecture`);
    add(c.bajc_retour_le, 'claire.dupont@vnf.fr', 'Retour du BAJC enregistré');
    add(c.pv_envoi_valide_le, c.pv_envoi_valide_par, 'Envoi du PV validé');
    add(c.pv_fin_valide_le, c.pv_fin_valide_par, 'Fin de notification du PV validée · dossier transmis au BAJC');
    add(c.tribunal_saisi_le, c.tribunal_valide_par, 'Tribunal saisi');
    add(c.regularise_le, c.regularise_par, 'Situation régularisée');
  }

  // ---------- persistance ----------
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
  if (!db || !db.constats) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('stockage plein', e); } };
  save();

  let session = null;
  try { session = JSON.parse(sessionStorage.getItem('dpf_demo_session')); } catch (e) { session = null; }
  const codes = {};

  // ---------- requêtes ----------
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.one = false; }
    select() { return this; } insert(r) { this.op = 'insert'; this.row = r; return this; }
    update(p) { this.op = 'update'; this.patch = p; return this; } upsert(r) { this.op = 'upsert'; this.row = r; return this; }
    delete() { this.op = 'delete'; return this; } eq(k, v) { this.f.push([k, v]); return this; }
    order(k, o) { this.ord = [k, o?.ascending !== false]; return this; } single() { this.one = true; return this; }
    then(a, b) { return Promise.resolve().then(() => this.exec()).then(a, b); }
    match(r) { return this.f.every(([k, v]) => String(r[k]) === String(v)); }
    exec() {
      const T = db[this.t] || (db[this.t] = []);
      const me = session?.user?.email;
      if (this.op === 'insert') {
        let r = { ...this.row };
        if (this.t === 'constats') {
          r = trig(db, { id: ++db.seq.id, numero: `CST-${Y}-${pad4(++db.seq.cst)}`, created_at: new Date().toISOString(), phase: 2, statut: 'ouvert', constatant_email: me, date_constat: iso(new Date()), photos: [], pv_photos: [], ...r, constatant_email: me });
        }
        if (this.t === 'journal') r = { id: ++db.seq.j, at: new Date().toISOString(), par: me, ...r };
        T.push(r); save(); return { data: r, error: null };
      }
      if (this.op === 'update') {
        const rows = T.filter((r) => this.match(r)); rows.forEach((r) => { Object.assign(r, this.patch); trig(db, r); });
        save(); return { data: this.one ? rows[0] || null : rows, error: null };
      }
      if (this.op === 'upsert') { const i = T.findIndex((r) => r.email === this.row.email); if (i >= 0) T[i] = this.row; else T.push(this.row); save(); return { data: null, error: null }; }
      if (this.op === 'delete') { db[this.t] = T.filter((r) => !this.match(r)); save(); return { data: null, error: null }; }
      let rows = T.filter((r) => this.match(r));
      const role = sessionStorage.getItem('dpf_profil') || 'agent';
      if (this.t === 'constats') rows = rows.filter((r) => role === 'gestionnaire' || r.constatant_email === me || (role === 'bajc' && r.phase >= 5));
      if (this.ord) { const [k, asc] = this.ord; rows = rows.slice().sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1)); }
      return this.one ? (rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'dossier introuvable ou non visible avec ce profil' } }) : { data: rows, error: null };
    }
  }

  // ---------- fichiers ----------
  const placeholder = (label) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#C9D6DD"/><g fill="none" stroke="#1A5A85" stroke-width="3"><path d="M120 200l60-60 40 40 30-30 50 50"/><circle cx="260" cy="110" r="18"/></g><text x="200" y="260" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#13212B">${label.replace(/[<&>]/g, '')}</text></svg>`);
  function shrink(file) {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) return resolve(null);
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => { const s = Math.min(1, 900 / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = img.width * s; cv.height = img.height * s; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); resolve(cv.toDataURL('image/jpeg', 0.7)); };
      img.onerror = () => resolve(null); img.src = url;
    });
  }

  // ---------- courriels simulés ----------
  function mail(to, subject, body) {
    db.outbox.unshift({ id: ++db.seq.m, at: new Date().toISOString(), to, subject, body });
    save();
  }

  const mailReady = () => /^https:\/\/script\.google\.com\//.test((window.DPF_CONFIG || {}).GOOGLE_SCRIPT_URL || '');

  window.__DPF_DEMO__ = {
    demo: true,
    auth: {
      getSession: async () => ({ data: { session } }),
      signInWithOtp: async ({ email }) => {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        codes[email] = code; sessionStorage.setItem('dpf_demo_code', code);
        if (!mailReady()) return { error: null };
        const url = (window.DPF_CONFIG || {}).GOOGLE_SCRIPT_URL;
        const body = JSON.stringify({ to_email: email, code });
        try {
          const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
          const txt = (await res.text()).trim();
          return txt === 'ok' ? { error: null } : { error: { message: 'Envoi du courriel impossible : ' + txt } };
        } catch (e) {
          // Certains navigateurs bloquent la lecture de la réponse : on envoie sans la lire.
          try { await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }); return { error: null }; }
          catch (e2) { return { error: { message: 'Envoi du courriel impossible : ' + e2.message } }; }
        }
      },
      verifyOtp: async ({ email, token }) => {
        const expected = codes[email] || sessionStorage.getItem('dpf_demo_code');
        if (token !== expected) return { data: {}, error: { message: 'Le code ne correspond pas.' } };
        session = { user: { email } }; sessionStorage.setItem('dpf_demo_session', JSON.stringify(session)); sessionStorage.removeItem('dpf_demo_code');
        return { data: { user: session.user, session }, error: null };
      },
      signOut: async () => { session = null; sessionStorage.removeItem('dpf_demo_session'); }
    },
    // En démonstration, le profil choisi à la connexion est accordé.
    rpc: async () => ({ data: sessionStorage.getItem('dpf_profil') || 'agent', error: null }),
    from: (t) => new Q(t),
    storage: { from: () => ({
      upload: async (path, file) => { const d = await shrink(file); db.files[path] = d || placeholder(file.name); save(); return { error: null }; },
      createSignedUrl: async (path) => ({ data: { signedUrl: db.files[path] || placeholder(path.startsWith('demo:') ? path.slice(5) : path.split('/').pop()) }, error: null })
    }) },
    demoCode: () => sessionStorage.getItem('dpf_demo_code'),
    demoMailReady: mailReady,
    demoMail: mail,
    demoOutbox: () => db.outbox.slice(),
    demoReset: () => { localStorage.removeItem(KEY); sessionStorage.clear(); location.hash = '#/connexion'; location.reload(); }
  };
})();
