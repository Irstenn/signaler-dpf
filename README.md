# Signaler-DPF

Application « Constat et contentieux sur le DPF » (service territorial Seine-Nord).

- `app/` : **le prototype fonctionnel** (connexion par code reçu par courriel, signalement, tableau de bord, phases 2 à 6, journal, régularisation, gestion des profils).
- `maquettes/` : les maquettes de conception (données d'exemple).
- `supabase/schema.sql` : la base de données à installer une fois dans Supabase.

L'interface est statique (hébergée sur GitHub Pages). La connexion, la base de données et les fichiers sont gérés par [Supabase](https://supabase.com) (offre gratuite).

## Mode démonstration (par défaut)

`app/config.js` contient `DEMO: true` : l'application fonctionne **sans aucun serveur**, avec des dossiers fictifs enregistrés dans le navigateur.

- Connexion avec n'importe quelle adresse ; le code s'affiche à l'écran (courriel simulé).
- Le profil (agent, gestionnaire du domaine, BAJC) se choisit à la connexion ou dans le bandeau orange.
- La page **Courriels** montre les courriels automatiques que l'application enverrait.
- **Réinitialiser les données** remet les dossiers fictifs d'origine.

Pour passer à la vraie application : `DEMO: false` et suivre la mise en place ci-dessous.

---

## Mise en place de la vraie application (une seule fois, ~15 minutes)

### 1. Créer le projet Supabase
1. Créez un compte sur https://supabase.com puis **New project**.
2. Nom : `signaler-dpf`, région : **Paris (eu-west-3)** ou Francfort, choisissez un mot de passe de base (à conserver), puis **Create new project**.

### 2. Installer la base
1. Ouvrez `supabase/schema.sql`, remplacez `VOTRE@ADRESSE.fr` (tout en bas) par **votre** adresse : vous serez administrateur.
2. Dans Supabase : **SQL Editor** → **New query** → collez tout le fichier → **Run**. Le message « Success » doit apparaître.

### 3. Recevoir un code (et non un lien) par courriel
Dans Supabase : **Authentication** → **Emails** (ou *Email Templates*).
Dans les deux modèles **Magic Link** et **Confirm signup**, remplacez le contenu par :

```html
<h2>Votre code Signaler-DPF</h2>
<p>Saisissez ce code dans l'application : <strong style="font-size:24px">{{ .Token }}</strong></p>
<p>Il n'est valable qu'une fois.</p>
```
Enregistrez chaque modèle.

### 4. Relier l'application au projet
Dans Supabase : **Project Settings** → **API** (ou bouton **Connect**). Copiez :
- *Project URL* → dans `app/config.js`, valeur `SUPABASE_URL`
- *anon public key* → valeur `SUPABASE_ANON_KEY` (clé publique, prévue pour être dans le navigateur)

Puis publiez :
```bash
git add .
git commit -m "Configuration Supabase"
git push
```

### 5. Tester
Ouvrez https://irstenn.github.io/signaler-dpf/app/ (ou en local : `python3 -m http.server 8000` puis http://localhost:8000/app/).

---

## Bon à savoir

- **Envoi des courriels.** Le service d'envoi intégré à Supabase est limité (quelques courriels par heure, et seulement vers les adresses des membres du projet Supabase). Pour que vos collègues reçoivent leur code, branchez un service d'envoi : Supabase → **Authentication** → **Emails** → **SMTP Settings** (par exemple Brevo, gratuit jusqu'à 300 courriels/jour). Pour un usage réel avec des adresses @vnf.fr, voir avec la DSI.
- **Profils.** Toute personne qui se connecte est « agent ». L'administrateur attribue les profils *gestionnaire du domaine* et *agent du BAJC* dans le menu **Utilisateurs**.
- **Adresses VNF uniquement.** Dans `app/config.js`, mettez `ALLOWED_DOMAIN: 'vnf.fr'`.
- **Alertes.** Les échéances (J+14 après affichage de l'avertissement, J+30 après notification du COSTU, relances J+10/20/30 du BAJC) sont calculées et affichées dans le tableau de bord. L'envoi automatique de courriels (accusés de réception, alertes à la BALU) est la prochaine étape.
- **Sécurité.** Les droits sont appliqués par la base (Row Level Security) : un agent ne voit que ses constats, le BAJC voit les dossiers à partir de la phase 5. Les fichiers sont privés (liens temporaires).
