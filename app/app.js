// =====================================================================
// Signaler-DPF — application (prototype)
// Interface statique + Supabase (connexion par code, base, fichiers).
// =====================================================================
const C = window.DPF_CONFIG || {};
const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const app = document.getElementById('app');

const PHASES = ['Constat', 'Caractérisation', 'Avertissement', 'COSTU', 'PV de grande voirie', 'Tribunal et suites'];
const ROLE_LABEL = { agent: 'Agent VNF', gestionnaire: 'Gestionnaire du domaine', bajc: 'Agent du BAJC', admin: 'Administrateur' };
const TYPES = ['Situation normale', 'Occupation illégale', 'Dégradation', 'Autre'];

const S = { email: null, role: 'agent', view: 'agent' };
let sb = null;

// ---------- utilitaires ----------------------------------------------
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoOf(new Date());
const parseIso = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = (s) => { if (!s) return '—'; const d = parseIso(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const fmtDT = (s) => { const d = new Date(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return isoOf(d); };
const daysSince = (s) => Math.floor((parseIso(today()) - parseIso(s)) / 86400000);
const nameFromEmail = (e) => (String(e || '').split('@')[0] || '').split(/[._-]+/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join(' ');
const can = (...roles) => roles.includes(S.role) || S.role === 'admin';

function toast(msg, ms = 3500) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}
function fail(e) { console.error(e); toast('Erreur : ' + (e?.message || e), 6000); }

async function upload(file, folder) {
  const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { error } = await sb.storage.from('pieces').upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}
async function uploadAll(input, folder) {
  const out = [];
  for (const f of Array.from(input?.files || [])) out.push(await upload(f, folder));
  return out;
}
async function resolveFiles(root) {
  for (const el of root.querySelectorAll('[data-path]')) {
    try {
      const { data } = await sb.storage.from('pieces').createSignedUrl(el.dataset.path, 3600);
      if (!data?.signedUrl) continue;
      if (el.tagName === 'IMG') el.src = data.signedUrl; else el.href = data.signedUrl;
    } catch (e) { /* fichier inaccessible */ }
  }
}
async function addJournal(constatId, texte) {
  const { error } = await sb.from('journal').insert({ constat_id: constatId, texte });
  if (error) console.warn(error);
}
const DEMO = () => !!(sb && sb.demo);
function notify(to, subject, body) { if (sb && sb.demoMail) sb.demoMail(to, subject, body); }
const BALU_DOM = () => C.BALU_DOMAINE || 'balu-domaine@vnf.fr';
const BALU_BAJC = () => C.BALU_BAJC || 'balu-bajc@vnf.fr';

async function updateConstat(id, patch) {
  const { data, error } = await sb.from('constats').update(patch).eq('id', id).select().single();
  if (error) throw error;
  if (!data) throw new Error('action non autorisée pour votre profil');
  return data;
}

// ---------- démarrage -------------------------------------------------
async function boot() {
  if (window.__DPF_MOCK__) sb = window.__DPF_MOCK__;
  else if (C.DEMO && window.__DPF_DEMO__) sb = window.__DPF_DEMO__;
  else {
    if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('VOTRE-PROJET')) return renderNoConfig();
    const { createClient } = await import(CDN);
    sb = createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  }
  const { data } = await sb.auth.getSession();
  if (data?.session) await setUser(data.session.user);
  window.addEventListener('hashchange', route);
  route();
}

async function setUser(user) {
  S.email = (user?.email || '').toLowerCase();
  const { data, error } = await sb.rpc('my_role');
  S.role = !error && data ? data : 'agent';
  const chosen = sessionStorage.getItem('dpf_profil') || 'agent';
  S.view = (chosen === 'agent' || S.role === chosen || S.role === 'admin') ? chosen : 'agent';
}

function renderDemoStrip() {
  const el = document.getElementById('demostrip');
  if (el) el.remove();
}

function renderNoConfig() {
  app.innerHTML = `<div class="page page-narrow"><div class="card">
    <h1 style="font-size:22px">Configuration à compléter</h1>
    <p>Ouvrez le fichier <span class="mono">app/config.js</span> et renseignez l’adresse et la clé publique de votre projet Supabase (voir le README).</p>
  </div></div>`;
}

// ---------- navigation ------------------------------------------------
function renderChrome(active) {
  const bar = document.getElementById('topbar');
  renderDemoStrip();
  if (!S.email) { bar.hidden = true; return; }
  bar.hidden = false;
  const links = [];
  if (can('gestionnaire', 'bajc')) links.push(['#/tableau', 'Tableau de bord', 'tableau']);
  links.push(['#/signaler', 'Signaler', 'signaler'], ['#/mes-constats', 'Mes constats', 'mes']);
  if (S.role === 'admin') links.push(['#/utilisateurs', 'Utilisateurs', 'users']);
  if (DEMO()) links.push(['#/courriels', 'Courriels', 'mails']);
  document.getElementById('nav').innerHTML = links.map(([href, label, k]) => `<a href="${href}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''}>${label}</a>`).join('');
  document.getElementById('me').innerHTML = `<div class="who"><span>${h(nameFromEmail(S.email))}</span><small>${h(ROLE_LABEL[S.role])}</small></div><button type="button" id="logout">Déconnexion</button>`;
  document.getElementById('logout').onclick = async () => { await sb.auth.signOut(); S.email = null; location.hash = '#/connexion'; };
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const r = parts[0] || '';
  if (!S.email && r !== 'code' && r !== 'reinitialiser') { renderChrome(); return viewLogin(); }
  try {
    switch (r) {
      case 'connexion': renderChrome(); return viewLogin();
      case 'code': renderChrome(); return viewCode();
      case 'signaler': renderChrome('signaler'); return viewSignaler();
      case 'envoye': renderChrome('mes'); return viewEnvoye(parts[1]);
      case 'mes-constats': renderChrome('mes'); return viewMesConstats();
      case 'tableau': renderChrome('tableau'); return can('gestionnaire', 'bajc') ? viewTableau() : (location.hash = '#/signaler');
      case 'dossier': renderChrome('tableau'); return viewDossier(parts[1]);
      case 'reinitialiser': if (DEMO() && confirm('Remettre les dossiers d’exemple d’origine ?')) sb.demoReset(); else location.hash = '#/'; return;
      case 'courriels': renderChrome('mails'); return viewCourriels();
      case 'utilisateurs': renderChrome('users'); return S.role === 'admin' ? viewUsers() : (location.hash = '#/');
      default:
        location.hash = (S.view === 'agent' || !can('gestionnaire', 'bajc')) ? '#/signaler' : '#/tableau';
    }
  } catch (e) { fail(e); }
}

// ---------- connexion -------------------------------------------------
function brandHead(title) {
  return `<div class="mobile-head">
    <div style="display:flex;align-items:center;gap:10px">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="#7FC1E8" stroke-width="2.2" stroke-linecap="round"><path d="M3 10c3-3 5-3 8 0s5 3 8 0 5-3 6-1"/><path d="M3 17c3-3 5-3 8 0s5 3 8 0 5-3 6-1"/></svg>
      <div><b style="font-size:18px">signaler-dpf</b><div class="small" style="color:#C3CED4">Domaine public fluvial · Seine-Nord</div></div>
    </div>
    <h1>${title}</h1></div>`;
}

function viewLogin() {
  const chosen = sessionStorage.getItem('dpf_profil') || 'agent';
  const roles = [['agent', 'Agent VNF', 'Signaler une anomalie constatée sur le terrain'],
    ['gestionnaire', 'Gestionnaire du domaine', 'Caractériser et instruire les dossiers'],
    ['bajc', 'Agent du BAJC', 'Documenter la phase judiciaire']];
  app.innerHTML = `<div class="mobile">${brandHead('Signaler, instruire et suivre les anomalies sur le DPF')}
  <form class="mobile-body" id="f">
    <fieldset style="display:flex;flex-direction:column;gap:10px">
      <legend class="lbl">Je me connecte en tant que</legend>
      ${roles.map(([v, t, d]) => `<label class="role"><input type="radio" name="profil" value="${v}" ${v === chosen ? 'checked' : ''}><span><b>${t}</b><span>${d}</span></span></label>`).join('')}
    </fieldset>
    <div><label class="lbl" for="mail">Adresse électronique${C.ALLOWED_DOMAIN ? ' ' + h(C.ALLOWED_DOMAIN.toUpperCase().split('.')[0]) : ''}</label>
      <input class="in" id="mail" name="mail" type="email" required autocomplete="email" placeholder="prenom.nom@${h(C.ALLOWED_DOMAIN || 'vnf.fr')}" value="${h(sessionStorage.getItem('dpf_email') || '')}"></div>
    <div id="msg"></div>
    <button class="btn btn-p btn-block" type="submit">Recevoir mon code</button>
    <p class="small muted" style="margin:0">Ni mot de passe, ni création de compte : un code à usage unique vous est envoyé par courriel.</p>
  </form></div>`;
  document.getElementById('f').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const email = String(fd.get('mail') || '').trim().toLowerCase();
    const msg = document.getElementById('msg');
    if (C.ALLOWED_DOMAIN && !email.endsWith('@' + C.ALLOWED_DOMAIN)) { msg.innerHTML = `<div class="err">Seules les adresses @${h(C.ALLOWED_DOMAIN)} sont acceptées.</div>`; return; }
    const btn = ev.submitter; btn.disabled = true; btn.textContent = 'Envoi du code…';
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    btn.disabled = false; btn.textContent = 'Recevoir mon code';
    if (error) { msg.innerHTML = `<div class="err">${h(error.message)}</div>`; return; }
    sessionStorage.setItem('dpf_email', email);
    sessionStorage.setItem('dpf_profil', fd.get('profil'));
    location.hash = '#/code';
  };
}

function viewCode() {
  const email = sessionStorage.getItem('dpf_email');
  if (!email) { location.hash = '#/connexion'; return; }
  app.innerHTML = `<div class="mobile">
  <div style="padding:12px 20px;background:#fff;border-bottom:1px solid var(--line)"><a href="#/connexion" style="display:inline-flex;align-items:center;min-height:44px;font-weight:500;text-decoration:none">‹ Modifier l’adresse</a></div>
  <form class="mobile-body" id="f">
    <h1 style="font-size:26px">Saisissez votre code</h1>
    <p style="margin:0;color:var(--ink2)">Un code vient d’être envoyé à <b style="color:var(--ink)">${h(email)}</b>. Pensez à vérifier les courriers indésirables.</p>
    ${DEMO() && !sb.demoMailReady() && sb.demoCode() ? `<div class="mailbox"><div class="small" style="color:var(--late);font-weight:600">Envoi des courriels non configuré (voir GOOGLE_SCRIPT_URL dans config.js) : code affiché provisoirement.</div><div>Saisissez ce code dans l’application : <b class="mono" style="font-size:22px;letter-spacing:.15em">${h(sb.demoCode())}</b></div><button type="button" class="btn btn-s" id="fill" style="min-height:38px">Recopier le code</button></div>` : ''}
    <div><label class="lbl" for="code">Code à usage unique</label>
      <input class="in mono" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" required maxlength="10" style="font-size:26px;letter-spacing:.3em;text-align:center;min-height:58px"></div>
    <div id="msg"></div>
    <button class="btn btn-p btn-block" type="submit">Me connecter</button>
    <button class="btn btn-s btn-block" type="button" id="resend">Renvoyer un code</button>
  </form></div>`;
  document.getElementById('code').focus();
  const fillBtn = document.getElementById('fill'); if (fillBtn) fillBtn.onclick = () => { document.getElementById('code').value = sb.demoCode(); };
  document.getElementById('resend').onclick = async () => {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    toast(error ? 'Erreur : ' + error.message : 'Nouveau code envoyé.'); if (!error && DEMO()) viewCode();
  };
  document.getElementById('f').onsubmit = async (ev) => {
    ev.preventDefault();
    const token = String(new FormData(ev.target).get('code') || '').replace(/\s/g, '');
    const btn = ev.submitter; btn.disabled = true;
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    btn.disabled = false;
    if (error) { document.getElementById('msg').innerHTML = `<div class="err">Code incorrect ou expiré. ${h(error.message)}</div>`; return; }
    await setUser(data.user || data.session?.user);
    const chosen = sessionStorage.getItem('dpf_profil') || 'agent';
    if (S.view !== chosen) toast(`Votre adresse n’a pas le profil « ${ROLE_LABEL[chosen]} ». Vous êtes connecté en tant qu’agent.`, 6000);
    location.hash = '#/';
  };
}

// ---------- phase 1 : signaler ---------------------------------------
function miniSteps(phase) {
  return `<div class="mini-steps" aria-hidden="true">${PHASES.map((_, i) => `<i class="${i + 1 < phase ? 'done' : i + 1 === phase ? 'now' : ''}"></i>`).join('')}</div>`;
}

function viewSignaler() {
  app.innerHTML = `<div class="mobile">
  <div style="background:#fff;border-bottom:1px solid var(--line);padding:16px 20px;display:flex;flex-direction:column;gap:10px">
    ${miniSteps(1)}<span class="small muted">Phase 1 sur 6 · Constat</span><h1 style="font-size:24px">Signaler une anomalie</h1></div>
  <form class="mobile-body" id="f">
    <div class="auto"><div><span class="muted">Date du constat</span><b>${fmt(today())}</b></div><div><span class="muted">Constatant</span><b>${h(nameFromEmail(S.email))}</b></div>
      <div style="grid-column:span 2" class="muted">Renseignés automatiquement. Le numéro est attribué à l’envoi.</div></div>
    <div><label class="lbl" for="voie">Voie d’eau concernée</label>
      <select class="in" id="voie" name="voie" required><option value="">Choisir une voie d’eau…</option>${(C.VOIES || []).map((v) => `<option>${h(v)}</option>`).join('')}</select></div>
    <div><span class="lbl">Localisation précise</span>
      <p class="hint" style="margin:0 0 8px">Capture d’écran Google Maps zoomée sur le lieu, avec un repère visible (écluse, pont, PK).</p>
      <label class="drop"><span id="carteLbl">Ajouter la capture de carte</span><small>image</small><input type="file" name="carte" accept="image/*"></label>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
        <button type="button" class="btn btn-s" id="gps">Joindre aussi ma position GPS</button>
        <span class="small" id="gpsTxt"></span>
        <input type="hidden" name="lat"><input type="hidden" name="lng">
      </div></div>
    <div><span class="lbl">Photo(s) du constat</span>
      <label class="drop"><span id="photosLbl">Prendre ou choisir des photos</span><small>plusieurs possibles</small><input type="file" name="photos" accept="image/*" multiple></label></div>
    <div><label class="lbl" for="com">Commentaire explicatif</label>
      <p class="hint" style="margin:0 0 8px">Ce que vous avez vu, depuis quand si vous le savez, tout détail utile au pôle domaine.</p>
      <textarea class="in" id="com" name="com" rows="5"></textarea></div>
    <div id="msg"></div>
    <button class="btn btn-p btn-block" type="submit">Envoyer au pôle domaine</button>
  </form></div>`;
  const f = document.getElementById('f');
  f.carte.onchange = () => { document.getElementById('carteLbl').textContent = f.carte.files[0]?.name || 'Ajouter la capture de carte'; };
  f.photos.onchange = () => { const n = f.photos.files.length; document.getElementById('photosLbl').textContent = n ? `${n} photo(s) sélectionnée(s)` : 'Prendre ou choisir des photos'; };
  document.getElementById('gps').onclick = () => {
    const t = document.getElementById('gpsTxt');
    if (!navigator.geolocation) { t.textContent = 'Localisation non disponible sur cet appareil.'; return; }
    t.textContent = 'Recherche de la position…';
    navigator.geolocation.getCurrentPosition((p) => {
      f.lat.value = p.coords.latitude; f.lng.value = p.coords.longitude;
      t.innerHTML = `<span style="color:var(--green);font-weight:500">Position enregistrée : ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} (± ${Math.round(p.coords.accuracy)} m)</span>`;
    }, (e) => { t.textContent = 'Position refusée ou indisponible : ' + e.message; }, { enableHighAccuracy: true, timeout: 15000 });
  };
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const msg = document.getElementById('msg');
    if (!f.voie.value) { msg.innerHTML = '<div class="err">Choisissez la voie d’eau.</div>'; return; }
    if (!f.com.value.trim() && !f.photos.files.length) { msg.innerHTML = '<div class="err">Ajoutez au moins une photo ou un commentaire.</div>'; return; }
    const btn = ev.submitter; btn.disabled = true; btn.textContent = 'Envoi en cours…';
    try {
      const folder = 'constats/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now());
      const photos = await uploadAll(f.photos, folder);
      const carte = f.carte.files[0] ? await upload(f.carte.files[0], folder) : null;
      const { data, error } = await sb.from('constats').insert({
        voie_eau: f.voie.value, commentaire: f.com.value.trim() || null, photos, carte,
        gps_lat: f.lat.value ? Number(f.lat.value) : null, gps_lng: f.lng.value ? Number(f.lng.value) : null,
        constatant_nom: nameFromEmail(S.email)
      }).select().single();
      if (error) throw error;
      await addJournal(data.id, `Constat déposé par ${nameFromEmail(S.email)}`);
      notify(S.email, `Accusé de réception de votre constat ${data.numero}`, `Votre constat du ${fmt(data.date_constat)} (${data.voie_eau}) a bien été transmis au pôle domaine sous le n° ${data.numero}. Il sera traité dans les meilleurs délais.`);
      location.hash = '#/envoye/' + data.id;
    } catch (e) { fail(e); btn.disabled = false; btn.textContent = 'Envoyer au pôle domaine'; }
  };
}

// ---------- suivi constatant -----------------------------------------
function statusOf(c) {
  if (c.statut === 'regularise') return ['Régularisé', 'ok'];
  if (c.statut === 'classe') return ['Classé · situation normale', 'ok'];
  if (c.statut === 'termine') return ['Procédure terminée', 'ok'];
  if (c.phase === 2) return [c.caracterise_le ? 'Caractérisé' : 'Envoyé, à caractériser', 'new'];
  return ['Phase ' + c.phase + ' · ' + PHASES[c.phase - 1], ''];
}

async function viewEnvoye(id) {
  app.innerHTML = '<div class="loading">Chargement…</div>';
  const { data: c, error } = await sb.from('constats').select('*').eq('id', id).single();
  if (error) throw error;
  const steps = [
    ['Constat envoyé', fmt(c.date_constat), true],
    ['Caractérisation par le pôle domaine', c.caracterise_le ? fmt(c.caracterise_le) : 'En attente', !!c.caracterise_le],
    ['Avertissement du contrevenant', c.avt_valide_le ? fmt(c.avt_date_affichage) : '', !!c.avt_valide_le],
    ['COSTU envoyé', c.costu_envoi_valide_le ? fmt(c.costu_date_envoi) : '', !!c.costu_envoi_valide_le],
    ['Situation régularisée', c.regularise_le ? fmt(c.regularise_le) : '', c.statut === 'regularise']
  ];
  const firstTodo = steps.findIndex((s) => !s[2]);
  app.innerHTML = `<div class="mobile"><div class="mobile-body">
    <section class="card" style="border-color:var(--green-line)">
      <div style="width:48px;height:48px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h1 style="font-size:23px">Constat transmis au pôle domaine</h1>
      <div><span class="muted small">N° de constat</span> <span class="mono" style="font-size:18px">${h(c.numero)}</span></div>
      <p style="margin:0;color:var(--ink2)">Le pôle domaine traitera votre constat dans les meilleurs délais. Vous pouvez suivre son avancement dans « Mes constats ».</p>
    </section>
    <section style="display:flex;flex-direction:column;gap:12px"><h2 style="font-size:18px">Suivi de ce constat</h2>
      <ol class="timeline">${steps.map((s, i) => `<li class="${s[2] ? 'done' : i === firstTodo ? 'now' : ''}"><span class="dot"></span><div><b style="font-weight:${s[2] || i === firstTodo ? 600 : 400}">${s[0]}</b><div class="small muted">${s[1]}</div></div></li>`).join('')}</ol></section>
    <a class="btn btn-s" href="#/signaler">Signaler une autre anomalie</a>
    <a class="btn btn-s" href="#/mes-constats">Voir mes constats</a>
  </div></div>`;
}

async function viewMesConstats() {
  app.innerHTML = '<div class="loading">Chargement…</div>';
  const { data, error } = await sb.from('constats').select('*').eq('constatant_email', S.email).order('created_at', { ascending: false });
  if (error) throw error;
  app.innerHTML = `<div class="page page-narrow"><div class="title-row"><h1>Mes constats</h1><a class="btn btn-p" href="#/signaler">Signaler</a></div>
    <div class="list">${data.length ? data.map((c) => { const [s, k] = statusOf(c); return `<a class="item" href="#/envoye/${c.id}"><div class="item-top"><span class="mono">${h(c.numero)}</span><span class="pill ${k}">${h(s)}</span></div><span class="small" style="color:var(--ink2)">${h(c.intitule || c.voie_eau)} · ${fmt(c.date_constat)}</span></a>`; }).join('') : '<div class="card empty">Vous n’avez encore signalé aucune anomalie.</div>'}</div></div>`;
}

// ---------- alertes ---------------------------------------------------
function alertsFor(c) {
  if (c.statut !== 'ouvert') return [];
  const t = today(); const a = [];
  if (c.phase === 2) a.push({ late: daysSince(c.date_constat) > 7, tag: 'À caractériser', detail: `Constat reçu le ${fmt(c.date_constat)} (${h(c.voie_eau)}).` });
  if (c.phase === 3) {
    if (!c.avt_valide_le) a.push({ late: false, tag: 'Avertissement à afficher', detail: 'Déposer l’avertissement signé et la photo de l’affichage.' });
    else { const due = addDays(c.avt_date_affichage, 14); a.push(t >= due ? { late: true, tag: 'J+14 atteint', detail: `Avertissement affiché depuis ${daysSince(c.avt_date_affichage)} jours : un COSTU peut être établi si l’infraction demeure.` } : { late: false, tag: `J+14 le ${fmt(due)}`, detail: `Avertissement affiché le ${fmt(c.avt_date_affichage)}.` }); }
  }
  if (c.phase === 4) {
    if (!c.costu_envoi_valide_le) a.push({ late: false, tag: 'COSTU à envoyer', detail: 'Établir le COSTU dans GeDo puis valider l’envoi.' });
    else if (!c.costu_fin_valide_le) a.push({ late: false, tag: 'Retour du RAR attendu', detail: `COSTU envoyé le ${fmt(c.costu_date_envoi)}.` });
    else { const due = addDays(c.costu_date_reception, 30); a.push(t >= due ? { late: true, tag: 'J+30 atteint', detail: `Notification du COSTU terminée depuis ${daysSince(c.costu_date_reception)} jours : un PV peut être établi si l’infraction demeure.` } : { late: false, tag: `J+30 le ${fmt(due)}`, detail: `Notification du COSTU terminée le ${fmt(c.costu_date_reception)}.` }); }
  }
  if (c.phase === 5) {
    if (!c.bajc_sollicite_le) a.push({ late: false, tag: 'Projet de PV à préparer', detail: 'Visite, photos et projet de PV à transmettre au BAJC.' });
    else if (!c.bajc_retour_le) { const n = daysSince(c.bajc_sollicite_le); a.push({ late: n >= 10, tag: n >= 10 ? `Relance J+${Math.min(30, Math.floor(n / 10) * 10)}` : 'Relecture BAJC', detail: `Projet de PV transmis au BAJC le ${fmt(c.bajc_sollicite_le)}, sans retour depuis ${n} jours.` }); }
    else if (!c.pv_envoi_valide_le) a.push({ late: false, tag: 'PV à envoyer', detail: `Retour du BAJC le ${fmt(c.bajc_retour_le)}.` });
    else if (!c.pv_fin_valide_le) a.push({ late: false, tag: 'Fin de notification du PV', detail: `PV envoyé le ${fmt(c.pv_date_envoi)}.` });
  }
  if (c.phase === 6) {
    if (!c.tribunal_saisi_le) a.push({ late: false, tag: 'Saisine à faire', detail: 'Le BAJC doit saisir le tribunal.' });
    else if (!c.jugement_recu_le) a.push({ late: false, tag: 'Jugement attendu', detail: `Tribunal saisi le ${fmt(c.tribunal_saisi_le)}.` });
    else if (!c.jugement_notif_valide_le) a.push({ late: false, tag: 'Notification du jugement', detail: `Jugement du ${fmt(c.jugement_date)}.` });
  }
  return a;
}

// ---------- tableau de bord ------------------------------------------
const DASH = { filtre: null, q: '' };

async function viewTableau() {
  app.innerHTML = '<div class="loading">Chargement…</div>';
  const { data, error } = await sb.from('constats').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  if (DASH.filtre === null) DASH.filtre = S.role === 'bajc' ? 5 : 0;
  const all = data;
  const open = all.filter((c) => c.statut === 'ouvert');
  const cards = [[2, 'À caractériser'], [3, 'Avertissement'], [4, 'COSTU'], [5, 'PV de grande voirie'], [6, 'Tribunal et suites']]
    .map(([n, l]) => { const items = open.filter((c) => c.phase === n); const late = items.filter((c) => alertsFor(c).some((a) => a.late)).length; return { n, l, count: items.length, late }; });
  const alerts = open.flatMap((c) => alertsFor(c).map((a) => ({ ...a, c }))).sort((a, b) => (b.late - a.late));
  const voies = (C.VOIES || []).map((v) => [v, open.filter((c) => c.voie_eau === v).length]);
  const max = Math.max(1, ...voies.map((v) => v[1]));
  const week = all.filter((c) => daysSince(c.date_constat) < 7).length;
  const closed = all.filter((c) => c.statut !== 'ouvert').length;

  const draw = () => {
    const q = DASH.q.toLowerCase();
    const rows = all.filter((c) => (DASH.filtre === 0 ? true : DASH.filtre === 'clos' ? c.statut !== 'ouvert' : (c.statut === 'ouvert' && c.phase === DASH.filtre)))
      .filter((c) => !q || [c.numero, c.intitule, c.voie_eau, c.constatant_nom].join(' ').toLowerCase().includes(q));
    document.getElementById('rows').innerHTML = rows.length ? rows.map((c) => { const a = alertsFor(c)[0]; const [s, k] = statusOf(c);
      return `<tr><td><a class="mono" href="#/dossier/${c.id}">${h(c.numero)}</a></td><td style="font-weight:500">${h(c.intitule || 'Nouveau constat')}</td><td>${h(c.voie_eau)}</td><td><span class="pill ${k}">${h(s)}</span></td><td>${fmt(c.date_constat)}</td><td>${a ? `<span style="${a.late ? 'font-weight:600;color:var(--late)' : ''}">${h(a.tag)}</span>` : '—'}</td><td>${h(c.constatant_nom || c.constatant_email)}</td></tr>`; }).join('')
      : '<tr><td colspan="7" class="empty">Aucun dossier.</td></tr>';
    document.querySelectorAll('[data-f]').forEach((b) => b.setAttribute('aria-pressed', String(String(DASH.filtre) === b.dataset.f)));
    document.getElementById('flabel').textContent = DASH.filtre === 0 ? 'tous' : DASH.filtre === 'clos' ? 'clos' : 'phase ' + DASH.filtre;
  };

  app.innerHTML = `<div class="page">
    <div class="title-row"><div><h1>Tableau de bord</h1><span class="muted">${h(ROLE_LABEL[S.role])} · ${open.length} dossier(s) ouvert(s)</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:10px"><input class="in" id="q" type="search" placeholder="N°, intitulé, voie d’eau…" aria-label="Rechercher un dossier" style="width:280px;max-width:100%" value="${h(DASH.q)}">${S.role === 'bajc' ? '' : '<a class="btn btn-p" href="#/signaler">Nouveau constat</a>'}</div></div>
    <section style="display:flex;flex-direction:column;gap:12px"><h2 style="font-size:18px">Flux de travail par phase</h2>
      <div class="cards">${cards.map((c) => `<button type="button" class="pcard" data-f="${c.n}"><span class="small muted">Phase ${c.n}</span><span class="l">${c.l}</span><span><span class="n">${c.count}</span> <span class="small muted">dossier(s)</span></span>${c.late ? `<span class="small" style="font-weight:600;color:var(--late)">${c.late} échéance(s) atteinte(s)</span>` : ''}</button>`).join('')}</div></section>
    <div class="cols">
      <section class="card col-main" style="flex:999 1 560px"><h2>Échéances et relances</h2>
        <ul class="alerts">${alerts.length ? alerts.slice(0, 12).map((a) => `<li class="${a.late ? 'late' : ''}"><span class="pill ${a.late ? 'late' : ''}">${h(a.tag)}</span><div class="t"><b>${h(a.c.numero)} · ${h(a.c.intitule || a.c.voie_eau)}</b><span class="small" style="color:var(--ink2)">${a.detail}</span></div><a href="#/dossier/${a.c.id}" style="font-weight:600;font-size:14px">Ouvrir</a></li>`).join('') : '<li class="empty">Rien à signaler.</li>'}</ul></section>
      <aside class="col-side">
        <section class="card"><h2>En un coup d’œil</h2><div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="kv"><span>dossiers ouverts</span><b style="font-size:28px">${open.length}</b></div>
          <div class="kv"><span>échéances atteintes</span><b style="font-size:28px;color:var(--late)">${alerts.filter((a) => a.late).length}</b></div>
          <div class="kv"><span>constats sur 7 jours</span><b style="font-size:28px">${week}</b></div>
          <div class="kv"><span>clos (régularisés, classés, terminés)</span><b style="font-size:28px;color:var(--green-d)">${closed}</b></div></div></section>
        <section class="card"><h2>Dossiers ouverts par voie d’eau</h2><div class="bars">${voies.map(([v, n]) => `<div><div style="display:flex;justify-content:space-between;font-size:14px"><span>${h(v)}</span><b>${n}</b></div><div class="track"><div class="fill" style="width:${Math.round(n / max * 100)}%"></div></div></div>`).join('')}</div></section>
      </aside></div>
    <section class="card"><div class="title-row"><h2>Dossiers · <span id="flabel"></span></h2>
      <div class="tabs" role="group" aria-label="Filtrer">${[[0, 'Tous'], [2, '2 · Caractérisation'], [3, '3 · Avertissement'], [4, '4 · COSTU'], [5, '5 · PV'], [6, '6 · Tribunal'], ['clos', 'Clos']].map(([v, l]) => `<button type="button" data-f="${v}">${l}</button>`).join('')}</div></div>
      <div class="scroll"><table><thead><tr><th>N°</th><th>Intitulé</th><th>Voie d’eau</th><th>Statut</th><th>Constaté le</th><th>Prochaine étape</th><th>Constatant</th></tr></thead><tbody id="rows"></tbody></table></div></section>
  </div>`;
  document.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { const v = b.dataset.f; const nv = v === 'clos' ? 'clos' : Number(v); DASH.filtre = (b.classList.contains('pcard') && DASH.filtre === nv) ? 0 : nv; draw(); }; });
  document.getElementById('q').oninput = (e) => { DASH.q = e.target.value; draw(); };
  draw();
}

// ---------- fiche dossier --------------------------------------------
const fDate = (name, label, v, dis) => `<div><label class="lbl" for="${name}">${label}</label><input class="in" type="date" id="${name}" name="${name}" value="${h(v || '')}" ${dis ? 'disabled' : ''}></div>`;
const fText = (name, label, v, dis) => `<div><label class="lbl" for="${name}">${label}</label><input class="in" id="${name}" name="${name}" value="${h(v || '')}" ${dis ? 'disabled' : ''}></div>`;
const fileLinks = (paths) => { const arr = (Array.isArray(paths) ? paths : [paths]).filter(Boolean); return arr.length ? `<div class="files">${arr.map((p) => `<a class="file" data-path="${h(p)}" target="_blank" rel="noopener">${h(p.split('/').pop().replace(/^\d+-\w{5}-/, ''))}</a>`).join('')}</div>` : '<span class="muted small">—</span>'; };
const fFile = (name, label, accept, current, dis, multiple) => `<div><span class="lbl">${label}</span>${dis ? fileLinks(current) : `${current && (current.length || typeof current === 'string') ? fileLinks(current) : ''}<label class="drop" style="min-height:64px"><span data-for="${name}">${current && current.length ? 'Remplacer' : 'Déposer le fichier'}</span><input type="file" name="${name}" accept="${accept}" ${multiple ? 'multiple' : ''}></label>`}</div>`;
const by = (who, when) => who ? `<span class="pill">Validé le ${fmt(when)} par ${h(nameFromEmail(who))}</span>` : '';

function sub(n, state, title, badge, body) {
  return `<section class="card ${state === 'now' ? 'active' : ''}"><div class="sub" style="flex-wrap:wrap"><span class="num ${state}">${state === 'done' ? '✓' : n}</span><h2 style="flex:1">${title}</h2>${badge || ''}</div>${body}</section>`;
}

async function viewDossier(id) {
  app.innerHTML = '<div class="loading">Chargement…</div>';
  const [{ data: c, error }, { data: jr }] = await Promise.all([
    sb.from('constats').select('*').eq('id', id).single(),
    sb.from('journal').select('*').eq('constat_id', id).order('at', { ascending: false })
  ]);
  if (error) throw error;
  const open = c.statut === 'ouvert';
  const G = open && can('gestionnaire');
  const B = open && can('bajc');
  const acts = {};
  const folder = 'dossiers/' + c.id;
  const ph = c.phase;
  const blocks = [];

  // Constat reçu
  blocks.push(`<details class="card" ${ph === 2 ? 'open' : ''} style="gap:0"><summary style="cursor:pointer;min-height:32px"><b>Constat reçu</b> <span class="muted small">· ${fmt(c.date_constat)} par ${h(c.constatant_nom || c.constatant_email)}</span></summary>
    <div style="display:flex;flex-direction:column;gap:14px;margin-top:14px">
    ${c.photos?.length || c.carte ? `<div class="thumbs">${[...(c.photos || []), c.carte].filter(Boolean).map((p) => `<a data-path="${h(p)}" target="_blank" rel="noopener"><img data-path="${h(p)}" alt="Pièce jointe au constat"></a>`).join('')}</div>` : ''}
    <div class="grid"><div class="kv"><span>Voie d’eau</span><span>${h(c.voie_eau)}</span></div>
      <div class="kv"><span>Position GPS</span><span>${c.gps_lat ? `<span class="mono small">${c.gps_lat.toFixed(5)}, ${c.gps_lng.toFixed(5)}</span> · <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${c.gps_lat},${c.gps_lng}">ouvrir la carte</a>` : '—'}</span></div>
      <div class="kv"><span>Constatant</span><span>${h(c.constatant_email)}</span></div></div>
    <div class="kv"><span>Commentaire du constatant</span><span style="white-space:pre-line">${h(c.commentaire || '—')}</span></div></div></details>`);

  // Phase 2
  if (ph >= 2) {
    const done = !!c.caracterise_le; const ed = G && ph === 2;
    blocks.push(sub(2, done ? 'done' : 'now', 'Caractérisation', by(c.caracterise_par, c.caracterise_le), `<form data-act="p2" style="display:flex;flex-direction:column;gap:16px">
      <div class="grid"><div><label class="lbl" for="type_constat">Type de constat</label><select class="in" id="type_constat" name="type_constat" ${ed ? '' : 'disabled'}><option value="">Choisir…</option>${TYPES.map((t) => `<option ${t === c.type_constat ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      ${fText('intitule', 'Intitulé du constat', c.intitule, !ed)}</div>
      <div><label class="lbl" for="plan_action">Plan d’action</label><textarea class="in" id="plan_action" name="plan_action" rows="4" ${ed ? '' : 'disabled'}>${h(c.plan_action || '')}</textarea></div>
      ${ed ? '<div class="actions"><button class="btn btn-p" type="submit">Valider la caractérisation</button><span class="small muted">« Situation normale » classe le dossier.</span></div>' : ''}</form>`));
    acts.p2 = async (f) => {
      if (!f.type_constat.value || !f.intitule.value.trim() || !f.plan_action.value.trim()) throw new Error('renseignez le type, l’intitulé et le plan d’action');
      const normal = f.type_constat.value === 'Situation normale';
      await updateConstat(c.id, { type_constat: f.type_constat.value, intitule: f.intitule.value.trim(), plan_action: f.plan_action.value.trim(), caracterise_par: S.email, caracterise_le: today(), phase: normal ? 2 : 3, statut: normal ? 'classe' : 'ouvert' });
      await addJournal(c.id, `Caractérisation validée (${f.type_constat.value})${normal ? ' · dossier classé' : ''}`);
      notify(c.constatant_email, `Votre constat ${c.numero} a été caractérisé`, `Le pôle domaine a caractérisé votre constat : « ${f.intitule.value.trim()} » (${f.type_constat.value}).`);
    };
  }

  // Phase 3
  if (ph >= 3) {
    const done = !!c.avt_valide_le; const ed = G && ph === 3 && !done;
    let body = `<form data-act="p3" style="display:flex;flex-direction:column;gap:16px">
      ${done ? `<div><span class="muted small">N° d’avertissement</span> <span class="mono">${h(c.avt_numero)}</span></div>` : ''}
      <div class="grid">${fFile('avt_pdf', 'Avertissement signé (PDF)', 'application/pdf', c.avt_pdf, !ed)}${fDate('avt_date_affichage', 'Date d’affichage', c.avt_date_affichage, !ed)}${fFile('avt_photo', 'Photo de l’avertissement affiché', 'image/*', c.avt_photo, !ed)}</div>
      ${ed ? '<div class="info">À la validation : un n° d’avertissement est attribué et le délai de 14 jours démarre.</div><div class="actions"><button class="btn btn-p" type="submit">Valider l’affichage de l’avertissement</button></div>' : ''}</form>`;
    if (done && ph === 3) {
      const due = addDays(c.avt_date_affichage, 14); const ok = today() >= due;
      body += `<div class="${ok ? 'warn' : 'info'}">${ok ? `Avertissement affiché depuis ${daysSince(c.avt_date_affichage)} jours : un COSTU peut être établi si l’infraction demeure.` : `Échéance J+14 le <b>${fmt(due)}</b> (J+${daysSince(c.avt_date_affichage)} aujourd’hui).`}</div>
        ${G ? `<form data-act="to4" class="actions"><button class="btn ${ok ? 'btn-p' : 'btn-s'}" type="submit">Passer au COSTU (phase 4)</button></form>` : ''}`;
    }
    blocks.push(sub(3, ph > 3 ? 'done' : 'now', 'Avertissement du contrevenant', by(c.avt_valide_par, c.avt_valide_le), body));
    acts.p3 = async (f) => {
      if (!f.avt_pdf.files[0] || !f.avt_date_affichage.value || !f.avt_photo.files[0]) throw new Error('le PDF signé, la date d’affichage et la photo sont nécessaires');
      const pdf = await upload(f.avt_pdf.files[0], folder); const photo = await upload(f.avt_photo.files[0], folder);
      const d = await updateConstat(c.id, { avt_pdf: pdf, avt_photo: photo, avt_date_affichage: f.avt_date_affichage.value, avt_valide_par: S.email, avt_valide_le: today() });
      await addJournal(c.id, `Affichage de l’avertissement ${d.avt_numero} validé (affiché le ${fmt(d.avt_date_affichage)})`);
      notify('(programmé) ' + BALU_DOM(), `[J+14 le ${fmt(addDays(d.avt_date_affichage, 14))}] Avertissement ${d.avt_numero} affiché depuis 14 jours`, `Alerte programmée : un COSTU pourra être établi pour ${c.numero} si l’infraction demeure.`);
    };
    acts.to4 = async () => { await updateConstat(c.id, { phase: 4 }); await addJournal(c.id, 'Passage à la phase 4 (COSTU)'); };
  }

  // Phase 4
  if (ph >= 4) {
    const sent = !!c.costu_envoi_valide_le; const fin = !!c.costu_fin_valide_le; const cur = ph === 4;
    let html = `<div class="info">Établissez d’abord le COSTU dans GeDo (« occupation illégale »). Le PDF, la preuve d’envoi et les photos restent dans GeDo.</div>`;
    html += `<form data-act="p4a" style="display:flex;flex-direction:column;gap:14px"><div class="sub"><span class="num ${sent ? 'done' : 'now'}">${sent ? '✓' : 1}</span><h3 style="flex:1">Envoi du COSTU</h3>${by(c.costu_envoi_valide_par, c.costu_envoi_valide_le)}</div>
      <div class="grid">${fDate('costu_date_etab', 'Date d’établissement', c.costu_date_etab, !(G && cur && !sent))}${fText('costu_numero', 'N° du COSTU (GeDo)', c.costu_numero, !(G && cur && !sent))}${fDate('costu_date_envoi', 'Date d’envoi en RAR', c.costu_date_envoi, !(G && cur && !sent))}</div>
      ${G && cur && !sent ? '<div class="actions"><button class="btn btn-p" type="submit">Valider l’envoi du COSTU</button></div>' : ''}</form>`;
    if (sent) html += `<form data-act="p4b" style="display:flex;flex-direction:column;gap:14px;padding-top:14px;border-top:1px solid #E3E8EA"><div class="sub"><span class="num ${fin ? 'done' : 'now'}">${fin ? '✓' : 2}</span><h3 style="flex:1">Fin de la notification</h3>${by(c.costu_fin_valide_par, c.costu_fin_valide_le)}</div>
      <p class="small muted" style="margin:0">Au retour de La Poste : pli distribué, ou avisé et non retiré sous 15 jours.</p>
      <div class="grid">${fDate('costu_date_reception', 'Date de réception ou de non-délivrance du RAR', c.costu_date_reception, !(G && cur && !fin))}</div>
      ${G && cur && !fin ? '<div class="actions"><button class="btn btn-p" type="submit">Valider la fin de la notification du COSTU</button><span class="small muted">Démarre le délai de 30 jours.</span></div>' : ''}</form>`;
    if (fin && cur) {
      const due = addDays(c.costu_date_reception, 30); const ok = today() >= due;
      html += `<div class="${ok ? 'warn' : 'info'}">${ok ? `Notification terminée depuis ${daysSince(c.costu_date_reception)} jours : un PV peut être établi si l’infraction demeure.` : `Échéance J+30 le <b>${fmt(due)}</b>.`}</div>${G ? `<form data-act="to5" class="actions"><button class="btn ${ok ? 'btn-p' : 'btn-s'}" type="submit">Passer au PV (phase 5)</button></form>` : ''}`;
    }
    blocks.push(`<section class="card ${cur ? 'active' : ''}"><div class="sub"><span class="num ${cur ? 'now' : 'done'}">${cur ? 4 : '✓'}</span><h2>COSTU</h2></div>${html}</section>`);
    acts.p4a = async (f) => {
      if (!f.costu_date_etab.value || !f.costu_numero.value.trim() || !f.costu_date_envoi.value) throw new Error('les trois champs sont nécessaires');
      await updateConstat(c.id, { costu_date_etab: f.costu_date_etab.value, costu_numero: f.costu_numero.value.trim(), costu_date_envoi: f.costu_date_envoi.value, costu_envoi_valide_par: S.email, costu_envoi_valide_le: today() });
      await addJournal(c.id, `Envoi du COSTU n° ${f.costu_numero.value.trim()} validé`);
      notify(c.constatant_email, `Un COSTU a été envoyé suite à votre constat ${c.numero}`, `Un constat d’occupation sans titre (COSTU) a été adressé au contrevenant suite à votre constat « ${c.intitule} ».`);
    };
    acts.p4b = async (f) => {
      if (!f.costu_date_reception.value) throw new Error('indiquez la date de réception ou de non-délivrance');
      await updateConstat(c.id, { costu_date_reception: f.costu_date_reception.value, costu_fin_valide_par: S.email, costu_fin_valide_le: today() });
      await addJournal(c.id, `Fin de la notification du COSTU validée (${fmt(f.costu_date_reception.value)})`);
      notify('(programmé) ' + BALU_DOM(), `[J+30 le ${fmt(addDays(f.costu_date_reception.value, 30))}] Notification du COSTU terminée depuis 30 jours`, `Alerte programmée : un PV pourra être établi pour ${c.numero} si l’infraction demeure.`);
    };
    acts.to5 = async () => { await updateConstat(c.id, { phase: 5 }); await addJournal(c.id, 'Passage à la phase 5 (PV de grande voirie)'); };
  }

  // Phase 5
  if (ph >= 5) {
    const cur = ph === 5; const E = G && cur;
    const a = !!c.bajc_sollicite_le, b = !!c.bajc_retour_le, cc = !!c.pv_envoi_valide_le, d = !!c.pv_fin_valide_le;
    const st = (done, prevDone) => done ? 'done' : prevDone ? 'now' : '';
    let html = `${c.pv_numero ? `<div><span class="muted small">N° du PV</span> <span class="mono">${h(c.pv_numero)}</span></div>` : ''}
    <form data-act="p5a" style="display:flex;flex-direction:column;gap:14px"><div class="sub"><span class="num ${st(a, true)}">${a ? '✓' : 1}</span><h3 style="flex:1">Visite et projet de PV</h3>${a ? `<span class="pill">BAJC sollicité le ${fmt(c.bajc_sollicite_le)}</span>` : ''}</div>
      <div class="grid">${fDate('pv_date_visite', 'Date de visite', c.pv_date_visite, !(E && !a))}${fFile('pv_photos', 'Photo(s) de la visite', 'image/*', c.pv_photos, !(E && !a), true)}${fFile('pv_projet', 'Projet de PV (Word)', '.doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword', c.pv_projet, !(E && !a))}</div>
      ${E && !a ? '<div class="actions"><button class="btn btn-p" type="submit">Solliciter le BAJC sur le projet de PV</button><span class="small muted">Attribue un n° de PV et démarre le suivi des relances.</span></div>' : ''}</form>`;
    if (a) {
      const n = daysSince(c.bajc_sollicite_le);
      html += `<form data-act="p5b" style="display:flex;flex-direction:column;gap:14px;padding-top:14px;border-top:1px solid #E3E8EA"><div class="sub"><span class="num ${st(b, a)}">${b ? '✓' : 2}</span><h3 style="flex:1">Retour du BAJC</h3>${!b && n >= 10 ? `<span class="pill late">Sans retour depuis ${n} jours</span>` : ''}</div>
        ${!b ? `<div class="small muted">Relances prévues : J+10 (${fmt(addDays(c.bajc_sollicite_le, 10))}), J+20 (${fmt(addDays(c.bajc_sollicite_le, 20))}), J+30 (${fmt(addDays(c.bajc_sollicite_le, 30))}).</div>` : ''}
        <div class="grid">${fDate('bajc_retour_le', 'Date de retour du BAJC', c.bajc_retour_le, !(cur && can('gestionnaire', 'bajc') && !b))}</div>
        ${cur && can('gestionnaire', 'bajc') && !b ? '<div class="actions"><button class="btn btn-p" type="submit">Enregistrer le retour du BAJC</button></div>' : ''}</form>`;
    }
    if (b) html += `<form data-act="p5c" style="display:flex;flex-direction:column;gap:14px;padding-top:14px;border-top:1px solid #E3E8EA"><div class="sub"><span class="num ${st(cc, b)}">${cc ? '✓' : 3}</span><h3 style="flex:1">PV signé et envoi</h3>${by(c.pv_envoi_valide_par, c.pv_envoi_valide_le)}</div>
        <div class="grid">${fFile('pv_signe', 'PV signé (PDF)', 'application/pdf', c.pv_signe, !(E && !cc))}${fFile('pv_notification', 'Notification du PV (PDF)', 'application/pdf', c.pv_notification, !(E && !cc))}${fFile('pv_preuve_envoi', 'Preuve d’envoi (PDF)', 'application/pdf', c.pv_preuve_envoi, !(E && !cc))}${fDate('pv_date_envoi', 'Date d’envoi en RAR du PV', c.pv_date_envoi, !(E && !cc))}</div>
        ${E && !cc ? '<div class="actions"><button class="btn btn-p" type="submit">Valider l’envoi du PV</button></div>' : ''}</form>`;
    if (cc) html += `<form data-act="p5d" style="display:flex;flex-direction:column;gap:14px;padding-top:14px;border-top:1px solid #E3E8EA"><div class="sub"><span class="num ${st(d, cc)}">${d ? '✓' : 4}</span><h3 style="flex:1">Fin de la notification</h3>${by(c.pv_fin_valide_par, c.pv_fin_valide_le)}</div>
        <div class="grid">${fDate('pv_date_fin_notif', 'Date de fin de la notification du RAR', c.pv_date_fin_notif, !(E && !d))}
        <fieldset><legend class="lbl">Résultat</legend>
          <label class="radio"><input type="radio" name="pv_resultat" value="delivre" ${c.pv_resultat === 'delivre' ? 'checked' : ''} ${E && !d ? '' : 'disabled'}>Pli délivré au destinataire</label>
          <label class="radio"><input type="radio" name="pv_resultat" value="non_retire" ${c.pv_resultat === 'non_retire' ? 'checked' : ''} ${E && !d ? '' : 'disabled'}>Pli avisé non retiré</label></fieldset></div>
        ${E && !d ? '<div class="actions"><button class="btn btn-p" type="submit">Valider la fin de notification du PV</button><span class="small muted">Transmet le dossier au BAJC (phase 6).</span></div>' : ''}</form>`;
    blocks.push(`<section class="card ${cur ? 'active' : ''}"><div class="sub"><span class="num ${cur ? 'now' : 'done'}">${cur ? 5 : '✓'}</span><h2>Procès-verbal de grande voirie</h2></div>${html}</section>`);
    acts.p5a = async (f) => {
      if (!f.pv_date_visite.value || !f.pv_projet.files[0]) throw new Error('la date de visite et le projet de PV sont nécessaires');
      const photos = await uploadAll(f.pv_photos, folder); const projet = await upload(f.pv_projet.files[0], folder);
      const dd = await updateConstat(c.id, { pv_date_visite: f.pv_date_visite.value, pv_photos: photos, pv_projet: projet, bajc_sollicite_le: today() });
      await addJournal(c.id, `Projet de PV ${dd.pv_numero} transmis au BAJC pour relecture`);
      notify(`${BALU_BAJC()} (copie : ${BALU_DOM()})`, `Relecture du projet de PV ${dd.pv_numero} (${c.numero})`, `Merci de relire le projet de procès-verbal ci-joint. Pièces jointes : projet de PV (Word) et ${photos.length} photo(s) de la visite.`);
      notify('(programmé) ' + BALU_DOM(), `[J+10, J+20, J+30] Relances si le BAJC n’a pas répondu (${dd.pv_numero})`, `Relances programmées les ${fmt(addDays(today(), 10))}, ${fmt(addDays(today(), 20))} et ${fmt(addDays(today(), 30))}, annulées dès que la date de retour du BAJC est saisie.`);
    };
    acts.p5b = async (f) => {
      if (!f.bajc_retour_le.value) throw new Error('indiquez la date de retour');
      await updateConstat(c.id, { bajc_retour_le: f.bajc_retour_le.value });
      await addJournal(c.id, `Retour du BAJC enregistré (${fmt(f.bajc_retour_le.value)})`);
    };
    acts.p5c = async (f) => {
      if (!f.pv_signe.files[0] || !f.pv_notification.files[0] || !f.pv_preuve_envoi.files[0] || !f.pv_date_envoi.value) throw new Error('les trois PDF et la date d’envoi sont nécessaires');
      const [s1, s2, s3] = [await upload(f.pv_signe.files[0], folder), await upload(f.pv_notification.files[0], folder), await upload(f.pv_preuve_envoi.files[0], folder)];
      await updateConstat(c.id, { pv_signe: s1, pv_notification: s2, pv_preuve_envoi: s3, pv_date_envoi: f.pv_date_envoi.value, pv_envoi_valide_par: S.email, pv_envoi_valide_le: today() });
      await addJournal(c.id, `Envoi du PV validé (RAR du ${fmt(f.pv_date_envoi.value)})`);
    };
    acts.p5d = async (f) => {
      const r = f.querySelector('input[name="pv_resultat"]:checked');
      if (!f.pv_date_fin_notif.value || !r) throw new Error('indiquez la date et le résultat');
      await updateConstat(c.id, { pv_date_fin_notif: f.pv_date_fin_notif.value, pv_resultat: r.value, pv_fin_valide_par: S.email, pv_fin_valide_le: today(), phase: 6 });
      await addJournal(c.id, `Fin de notification du PV validée (${r.value === 'delivre' ? 'pli délivré' : 'pli avisé non retiré'}) · dossier transmis au BAJC`);
      notify(BALU_BAJC(), `Dossier ${c.numero} : entrée en phase judiciaire`, `La notification du PV ${c.pv_numero} est terminée. Le dossier est prêt pour la phase judiciaire ; merci de renseigner l’application.`);
    };
  }

  // Phase 6
  if (ph >= 6) {
    const s1 = !!c.tribunal_saisi_le && !!c.tribunal_valide_par, s2 = !!c.jugement_recu_le, s3 = !!c.jugement_notif_valide_le;
    let html = `<form data-act="p6a" style="display:flex;flex-direction:column;gap:14px"><div class="sub"><span class="num ${s1 ? 'done' : 'now'}">${s1 ? '✓' : 1}</span><h3 style="flex:1">Saisine du tribunal</h3>${by(c.tribunal_valide_par, c.tribunal_saisi_le)}</div>
      <div class="grid">${fDate('tribunal_saisi_le', 'Date de saisine du tribunal', c.tribunal_saisi_le, !(B && !s1))}</div>
      ${B && !s1 ? '<div class="actions"><button class="btn btn-p" type="submit">Le tribunal a bien été saisi</button></div>' : ''}</form>`;
    if (s1) html += `<form data-act="p6b" style="display:flex;flex-direction:column;gap:14px;padding-top:14px;border-top:1px solid #E3E8EA"><div class="sub"><span class="num ${s2 ? 'done' : 'now'}">${s2 ? '✓' : 2}</span><h3 style="flex:1">Jugement</h3>${c.jug_numero ? `<span class="pill">${h(c.jug_numero)}</span>` : ''}</div>
      <div class="grid">${fDate('jugement_date', 'Date du jugement', c.jugement_date, !(B && !s2))}${fFile('jugement_pdf', 'Jugement (PDF)', 'application/pdf', c.jugement_pdf, !(B && !s2))}</div>
      ${B && !s2 ? '<div class="actions"><button class="btn btn-p" type="submit">VNF est en possession du jugement</button></div>' : ''}</form>`;
    if (s2) html += `<form data-act="p6c" style="display:flex;flex-direction:column;gap:14px;padding-top:14px;border-top:1px solid #E3E8EA"><div class="sub"><span class="num ${s3 ? 'done' : 'now'}">${s3 ? '✓' : 3}</span><h3 style="flex:1">Notification du jugement</h3></div>
      <div class="grid">${fDate('jugement_notifie_le', 'Date de notification du jugement', c.jugement_notifie_le, !(B && !s3))}</div>
      ${B && !s3 ? '<div class="actions"><button class="btn btn-p" type="submit">Le jugement a bien été notifié au contrevenant</button></div>' : ''}</form>`;
    blocks.push(`<section class="card ${open ? 'active' : ''}"><div class="sub"><span class="num ${s3 ? 'done' : 'now'}">${s3 ? '✓' : 6}</span><h2>Tribunal et suites (BAJC)</h2></div>${html}</section>`);
    acts.p6a = async (f) => {
      if (!f.tribunal_saisi_le.value) throw new Error('indiquez la date de saisine');
      await updateConstat(c.id, { tribunal_saisi_le: f.tribunal_saisi_le.value, tribunal_valide_par: S.email });
      await addJournal(c.id, `Tribunal saisi le ${fmt(f.tribunal_saisi_le.value)}`);
      notify(BALU_DOM(), `Dossier ${c.numero} : le tribunal a été saisi`, `Pour information, le tribunal a été saisi le ${fmt(f.tribunal_saisi_le.value)}.`);
    };
    acts.p6b = async (f) => {
      if (!f.jugement_date.value || !f.jugement_pdf.files[0]) throw new Error('la date et le PDF du jugement sont nécessaires');
      const pdf = await upload(f.jugement_pdf.files[0], folder);
      const dd = await updateConstat(c.id, { jugement_date: f.jugement_date.value, jugement_pdf: pdf, jugement_recu_le: today() });
      await addJournal(c.id, `Jugement ${dd.jug_numero} du ${fmt(f.jugement_date.value)} reçu par VNF`);
      notify(BALU_DOM(), `Dossier ${c.numero} : VNF est en possession du jugement`, `Pour information, le jugement ${dd.jug_numero} du ${fmt(f.jugement_date.value)} a été reçu.`);
    };
    acts.p6c = async (f) => {
      if (!f.jugement_notifie_le.value) throw new Error('indiquez la date de notification');
      await updateConstat(c.id, { jugement_notifie_le: f.jugement_notifie_le.value, jugement_notif_valide_le: today(), statut: 'termine' });
      await addJournal(c.id, `Jugement notifié au contrevenant le ${fmt(f.jugement_notifie_le.value)} · procédure terminée`);
      notify(BALU_DOM(), `Dossier ${c.numero} : jugement notifié au contrevenant`, `Pour information, le jugement a été notifié le ${fmt(f.jugement_notifie_le.value)}.`);
    };
  }

  // Colonne latérale
  const banner = c.statut === 'regularise' ? `<div class="card regul"><h2>Situation régularisée</h2><span>Le ${fmt(c.regularise_le)} par ${h(nameFromEmail(c.regularise_par))}</span><span style="white-space:pre-line">${h(c.regularisation_commentaire || '')}</span></div>`
    : c.statut === 'classe' ? '<div class="card regul"><h2>Dossier classé</h2><span>Situation normale constatée lors de la caractérisation.</span></div>'
    : c.statut === 'termine' ? '<div class="card regul"><h2>Procédure terminée</h2><span>Le jugement a été notifié au contrevenant.</span></div>' : '';
  const regul = G ? `<form data-act="reg" class="card regul"><h2>Régularisation</h2><p class="small" style="margin:0;color:var(--ink2)">Possible à toutes les phases. Clôt le dossier.</p>
      ${fDate('regularise_le', 'Date de régularisation', '', false)}<div><label class="lbl" for="rc">Commentaire</label><textarea class="in" id="rc" name="rc" rows="3"></textarea></div>
      <button class="btn btn-g" type="submit">Valider la régularisation</button></form>` : '';
  acts.reg = async (f) => {
    if (!f.regularise_le.value) throw new Error('indiquez la date de régularisation');
    if (!confirm('Confirmer la régularisation ? Le dossier sera clos.')) throw new Error('annulé');
    await updateConstat(c.id, { regularise_le: f.regularise_le.value, regularisation_commentaire: f.rc.value.trim() || null, regularise_par: S.email, statut: 'regularise' });
    await addJournal(c.id, `Situation régularisée le ${fmt(f.regularise_le.value)}`);
    notify(c.constatant_email, `La situation signalée dans votre constat ${c.numero} est régularisée`, `Merci pour votre signalement. La situation a été régularisée le ${fmt(f.regularise_le.value)}.`);
  };

  app.innerHTML = `<div class="page">
    <a href="#/tableau" class="small" style="font-weight:500">← Tableau de bord</a>
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px">
      <span class="mono" style="font-size:16px;padding:4px 10px;border-radius:6px;background:#E3E8EA">${h(c.numero)}</span>
      <h1 style="font-size:26px">${h(c.intitule || 'Nouveau constat à caractériser')}</h1>
      <span class="small" style="color:var(--ink2)">${h(c.voie_eau)}${c.type_constat ? ' · ' + h(c.type_constat.toLowerCase()) : ''}</span></div>
    <ol class="steps" aria-label="Phases du processus">${PHASES.map((p, i) => { const n = i + 1; const k = n < ph || (!open && n <= ph) ? 'done' : n === ph ? 'now' : 'todo'; return `<li class="${k}" ${k === 'now' ? 'aria-current="step"' : ''}><div class="bar"></div><small>Phase ${n} · ${k === 'done' ? 'faite' : k === 'now' ? 'en cours' : 'à venir'}</small><b>${p}</b></li>`; }).join('')}</ol>
    <div class="cols"><div class="col-main">${blocks.join('')}</div>
      <aside class="col-side">${banner}
        <section class="card"><h2 style="font-size:16px">Journal du dossier</h2><ul class="journal">${(jr || []).map((j) => `<li><span class="small muted">${fmtDT(j.at)} · ${h(nameFromEmail(j.par))}</span><span>${h(j.texte)}</span></li>`).join('') || '<li class="muted">Aucune action.</li>'}</ul></section>
        ${regul}</aside></div></div>`;

  app.querySelectorAll('input[type=file]').forEach((inp) => { inp.onchange = () => { const s = app.querySelector(`[data-for="${inp.name}"]`); if (s) s.textContent = inp.files.length > 1 ? `${inp.files.length} fichiers` : (inp.files[0]?.name || 'Déposer le fichier'); }; });
  app.querySelectorAll('form[data-act]').forEach((form) => {
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const btn = ev.submitter; if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = 'Enregistrement…'; }
      try { await acts[form.dataset.act](form); toast('Enregistré.'); viewDossier(id); }
      catch (e) { if (e.message !== 'annulé') fail(e); if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t; } }
    };
  });
  resolveFiles(app);
}

// ---------- courriels (démonstration) --------------------------------
async function viewCourriels() {
  app.innerHTML = '<div class="loading">Chargement…</div>';
  const sent = sb.demoOutbox ? sb.demoOutbox() : [];
  const { data } = await sb.from('constats').select('*');
  const t = today(); const auto = [];
  (data || []).filter((c) => c.statut === 'ouvert').forEach((c) => {
    if (c.phase === 3 && c.avt_valide_le) auto.push({ d: addDays(c.avt_date_affichage, 14), to: BALU_DOM(), s: `Avertissement ${c.avt_numero} affiché depuis 14 jours (${c.numero})`, b: 'Un COSTU peut être établi si l’infraction demeure.', id: c.id });
    if (c.phase === 4 && c.costu_fin_valide_le) auto.push({ d: addDays(c.costu_date_reception, 30), to: BALU_DOM(), s: `Notification du COSTU terminée depuis 30 jours (${c.numero})`, b: 'Un PV peut être établi si l’infraction demeure.', id: c.id });
    if (c.phase === 5 && c.bajc_sollicite_le && !c.bajc_retour_le) [10, 20, 30].forEach((n) => auto.push({ d: addDays(c.bajc_sollicite_le, n), to: BALU_DOM(), s: `Relance J+${n} : le BAJC n’a pas répondu (${c.pv_numero})`, b: `Projet de PV transmis le ${fmt(c.bajc_sollicite_le)}.`, id: c.id }));
  });
  const past = auto.filter((a) => a.d <= t).sort((a, b) => b.d.localeCompare(a.d));
  const next = auto.filter((a) => a.d > t).sort((a, b) => a.d.localeCompare(b.d));
  const row = (when, to, s, b, id, tag) => `<li class="mail"><div class="item-top"><b>${h(s)}</b>${tag}</div><span class="small muted">${when} · à ${h(to)}</span><span class="small" style="white-space:pre-line">${h(b)}</span>${id ? `<a class="small" href="#/dossier/${id}">Ouvrir le dossier</a>` : ''}</li>`;
  app.innerHTML = `<div class="page" style="max-width:920px">
    <div class="title-row"><div><h1>Courriels automatiques</h1><span class="muted">Courriels générés automatiquement par l’application, sans action des agents.</span></div></div>
    <section class="card"><h2>Programmés</h2><ul class="alerts">${next.map((a) => row('Le ' + fmt(a.d), a.to, a.s, a.b, a.id, '<span class="pill">Programmé</span>')).join('') || '<li class="empty">Aucun envoi programmé.</li>'}</ul></section>
    <section class="card"><h2>Alertes envoyées (échéances atteintes)</h2><ul class="alerts">${past.map((a) => row('Le ' + fmt(a.d), a.to, a.s, a.b, a.id, '<span class="pill late">Alerte</span>')).join('') || '<li class="empty">Aucune.</li>'}</ul></section>
    <section class="card"><h2>Historique des notifications</h2><ul class="alerts">${sent.map((m) => row(fmtDT(m.at), m.to, m.subject, m.body, null, '<span class="pill ok">Notification</span>')).join('') || '<li class="empty">Aucune notification pour l’instant.</li>'}</ul></section>
  </div>`;
}

// ---------- utilisateurs (admin) -------------------------------------
async function viewUsers() {
  app.innerHTML = '<div class="loading">Chargement…</div>';
  const { data, error } = await sb.from('roles').select('*').order('role');
  if (error) throw error;
  app.innerHTML = `<div class="page" style="max-width:820px">
    <div class="title-row"><h1>Utilisateurs et profils</h1></div>
    <p class="muted" style="margin:0">Toute personne qui se connecte est « agent ». Ajoutez ici les gestionnaires du domaine et les agents du BAJC.</p>
    <form class="card" id="f"><h2>Ajouter ou modifier un profil</h2><div class="grid">
      <div><label class="lbl" for="em">Adresse électronique</label><input class="in" id="em" name="em" type="email" required></div>
      <div><label class="lbl" for="ro">Profil</label><select class="in" id="ro" name="ro"><option value="gestionnaire">Gestionnaire du domaine</option><option value="bajc">Agent du BAJC</option><option value="admin">Administrateur</option></select></div></div>
      <div class="actions"><button class="btn btn-p" type="submit">Enregistrer</button></div></form>
    <section class="card"><h2>Profils attribués</h2><div class="scroll"><table style="min-width:0"><thead><tr><th>Adresse</th><th>Profil</th><th></th></tr></thead><tbody>
      ${data.map((r) => `<tr><td>${h(r.email)}</td><td>${h(ROLE_LABEL[r.role])}</td><td style="text-align:right">${r.email === S.email ? '<span class="small muted">vous</span>' : `<button class="btn btn-s" style="min-height:36px" data-del="${h(r.email)}">Retirer</button>`}</td></tr>`).join('')}</tbody></table></div></section></div>`;
  document.getElementById('f').onsubmit = async (ev) => {
    ev.preventDefault(); const f = ev.target;
    const { error: e } = await sb.from('roles').upsert({ email: f.em.value.trim().toLowerCase(), role: f.ro.value });
    if (e) return fail(e); toast('Profil enregistré.'); viewUsers();
  };
  app.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => {
    if (!confirm(`Retirer le profil de ${b.dataset.del} ? La personne redeviendra agent.`)) return;
    const { error: e } = await sb.from('roles').delete().eq('email', b.dataset.del);
    if (e) return fail(e); viewUsers();
  }; });
}

boot().catch(fail);
