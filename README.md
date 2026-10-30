# Signaler-DPF — maquettes

Maquettes cliquables de l'application « Constat et contentieux sur le DPF » (service territorial Seine-Nord).
Les données sont des exemples : rien n'est enregistré et aucun courriel n'est envoyé.

## Lancer en local

Depuis ce dossier :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000 dans le navigateur.

(Autre option avec Node.js : `npx serve .`)

## Contenu

- `index.html` : sommaire des écrans
- `maquettes/` : les 10 écrans (accueil, code, signalement, suivi, tableau de bord, phases 2 à 6)
- `maquettes/dc-lite.js` : petit moteur d'affichage des maquettes (aucune dépendance)
