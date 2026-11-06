// =====================================================================
// Signaler-DPF — configuration
// Remplacez les deux premières valeurs par celles de votre projet Supabase :
// Supabase > Project Settings > API (ou « Connect »)
//   - Project URL           -> SUPABASE_URL
//   - anon / public key     -> SUPABASE_ANON_KEY  (clé publique, sans danger ici)
// =====================================================================
window.DPF_CONFIG = {
  // true  = démonstration : données fictives dans le navigateur, code affiché à l'écran.
  // false = vraie application reliée à Supabase (voir README).
  DEMO: true,

  SUPABASE_URL: 'https://VOTRE-PROJET.supabase.co',
  SUPABASE_ANON_KEY: 'VOTRE-CLE-ANON-PUBLIQUE',

  // Laisser vide pour accepter toutes les adresses (tests).
  // Mettre 'vnf.fr' pour n'accepter que les adresses VNF.
  ALLOWED_DOMAIN: 'vnf.fr',

  // Envoi du code de connexion par courriel (version POC) via Google Apps Script.
  // Coller ici l'URL de l'application web (se termine par /exec), voir outils/envoi-code.gs.
  // Laisser vide = code affiché à l'écran.
  GOOGLE_SCRIPT_URL: '',

  // Boîtes aux lettres unitaires (BALU) destinataires des alertes
  BALU_DOMAINE: 'balu-domaine@vnf.fr',
  BALU_BAJC: 'balu-bajc@vnf.fr',

  VOIES: [
    'Rivière Oise canalisée',
    'Canal latéral à l’Oise',
    'Vieille Oise',
    'Rivière Aisne canalisée',
    'Canal du Nord',
    'Canal de la Somme'
  ]
};
