/**
 * Signaler-DPF — envoi du code de connexion (version POC)
 * À coller dans https://script.google.com (Nouveau projet), puis :
 * Déployer > Nouveau déploiement > Application web
 *   - Exécuter en tant que : Moi
 *   - Qui a accès : Tout le monde
 * Copier l'URL obtenue dans app/config.js (GOOGLE_SCRIPT_URL).
 */

// Laisser vide pour accepter toutes les adresses, ou mettre 'vnf.fr'.
var DOMAINE_AUTORISE = '';
// Garde-fous contre les abus : envois maximum par jour et délai entre deux codes pour une même adresse.
var MAX_PAR_JOUR = 80;
var DELAI_SECONDES = 30;

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var email = String(data.to_email || '').trim().toLowerCase();
    var code = String(data.code || '');

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reponse('adresse invalide');
    if (!/^\d{6}$/.test(code)) return reponse('code invalide');
    if (DOMAINE_AUTORISE && !email.endsWith('@' + DOMAINE_AUTORISE)) return reponse('domaine non autorisé');

    var cache = CacheService.getScriptCache();
    if (cache.get('dernier_' + email)) return reponse('trop rapproché, réessayez dans quelques secondes');
    var cle = 'jour_' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyyMMdd');
    var n = Number(cache.get(cle) || 0);
    if (n >= MAX_PAR_JOUR) return reponse('limite quotidienne atteinte');

    MailApp.sendEmail({
      to: email,
      name: 'Signaler-DPF',
      subject: 'Votre code de connexion Signaler-DPF : ' + code,
      body: 'Votre code de connexion : ' + code + '\nIl n\'est valable qu\'une fois.\n\nSi vous n\'avez pas demandé ce code, ignorez ce message.',
      htmlBody: '<div style="font-family:Arial,sans-serif;color:#13212B">'
        + '<p style="font-size:16px">Votre code de connexion <b>Signaler-DPF</b> :</p>'
        + '<p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#1A5A85">' + code + '</p>'
        + '<p>Il n\'est valable qu\'une fois.</p>'
        + '<p style="color:#56636B;font-size:13px">Si vous n\'avez pas demandé ce code, ignorez ce message.</p></div>'
    });

    cache.put('dernier_' + email, '1', DELAI_SECONDES);
    cache.put(cle, String(n + 1), 21600);
    return reponse('ok');
  } catch (err) {
    return reponse('erreur : ' + err.message);
  }
}

function reponse(texte) {
  return ContentService.createTextOutput(texte).setMimeType(ContentService.MimeType.TEXT);
}

// À lancer une fois depuis l'éditeur (bouton Exécuter) pour accorder l'autorisation Gmail
// et vérifier la réception. Remplacez l'adresse par la vôtre.
function test() {
  MailApp.sendEmail('votre.adresse@exemple.fr', 'Test Signaler-DPF', 'Le script fonctionne.');
}
