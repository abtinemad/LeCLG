# Le collègue

Application d'aide à la décomposition de situations difficiles, accompagnant la
personne vers un équilibre stable. Pensée comme un partenaire de réflexion
collégial — **pas** un outil de diagnostic ni un substitut thérapeutique.

## Architecture

Front React/Vite (SPA) servi par un serveur Express (`server.ts`), qui fait
office de **proxy unique**. Le frontend ne parle jamais directement à Supabase
ni à un modèle de langage — tout transite par le proxy.

```
                         ┌── /api/worker (chat, eval) ──► Worker Cloudflare ──► API Claude
Client ──► Express (3000) ┼── /api/worker (sb_*) ────────► Supabase (Service Key)
                         ├── /api/metacognition, enrich_*, eval_* ──► API Gemini (SDK)
                         └── /api/climate ─────────────────────────► Supabase
```

- **Chat** : la conversation passe par le worker Cloudflare externe, qui héberge
  les instructions cliniques (les prompts ne sont **pas** dans ce dépôt,
  volontairement).
- **Analyses du Carnet** (Lien, Affect, Élan, Matrice, Lueurs) : appels Gemini
  directs depuis `server.ts`.
- **Persistance** : Supabase, écritures routées par le proxy avec la Service Key.
- **Climat & Épicentre** : agrégation **anonyme** de la météo affective — soit
  globale (`GET /api/climate`), soit restreinte à un **cercle privé** rejoint par
  QR (handlers `epicentre_*` via `/api/worker`, table `epicentre_members` non
  exposée au chemin de lecture générique). La logique d'agrégation est isolée et
  testée dans `src/lib/climate.ts`.
- **Climat** : `/api/climate` agrège anonymement les cartes — comptage par émotion, par sphère, croisement **émotion × sphère**, et une **timeline hebdomadaire** (via `started_at`) — pour la page Climat communautaire.

## Accès & confidentialité

Pas de compte, pas d'email, aucune donnée personnelle. L'accès à un Carnet
repose sur deux éléments :

- une **clé de reconnaissance** mémorisable — une phrase de passe de cinq mots
  (diceware, ex. `vrai-chemin-clair-doux-sable`) — qui sert d'identifiant : elle
  peut être affichée et n'est pas le secret ;
- un **code à 6 chiffres**, choisi par la personne et **obligatoire dès
  l'onboarding** (aucune conversation ne démarre sans lui).

Côté serveur, le code est vérifié pour **toute lecture comme toute écriture**
sur une clé déjà réclamée (verrou anti-force-brute : 5 essais, blocage 15 min).
Le code n'est jamais stocké en clair (HMAC-SHA256 mêlé au secret serveur
`ACCESS_PEPPER`), et les données sensibles sont chiffrées au repos. Une fuite de
la base seule ne révèle donc rien d'exploitable.

> Limite assumée : l'exploitant du service peut techniquement déchiffrer les
> données côté serveur. Le chiffrement protège contre un accès à la base, pas
> contre l'opérateur. Le code étant irrécupérable, le perdre = perdre l'accès
> au Carnet.

Endpoints d'auth côté proxy : `account_create` (associe code ↔ clé),
`verify` (reconnexion clé + code sur un nouvel appareil).

## Prérequis

- Node.js
- Un projet Supabase (schéma dans `supabase_schema.sql`)
- Une clé API Gemini et un worker Cloudflare configuré pour le chat

## Variables d'environnement

Copier `.env.example` vers `.env` et renseigner. Le serveur **refuse de
démarrer** si l'une des variables obligatoires manque.

| Variable               | Obligatoire | Rôle                                                                 |
| ---------------------- | :---------: | -------------------------------------------------------------------- |
| `SUPABASE_URL`         |     oui     | URL du projet Supabase                                               |
| `SUPABASE_SERVICE_KEY` |     oui     | Accès Supabase côté serveur (Service Key — ne jamais exposer au front)|
| `GEMINI_API_KEY`       |     oui     | Appels Gemini (analyses du Carnet)                                  |
| `CF_WORKER_URL`        |     oui     | URL du worker Cloudflare (chat/eval)                                |
| `INTERNAL_SECRET`      |     oui     | Secret partagé Express ↔ worker (en-tête `X-Internal-Secret`)        |
| `ADMIN_PASSWORD`       |     oui     | Accès au panneau d'administration                                   |
| `ACCESS_PEPPER`        |     oui     | Secret serveur mêlé au hachage des codes à 6 chiffres¹              |
| `NODE_ENV`             |   non       | `production` en prod ; sinon Vite sert le front en mode dev         |
| `DISABLE_HMR`          |   non       | `1` pour désactiver le hot-reload Vite en développement             |

¹ Doit être une longue valeur aléatoire, secrète et **stable** : la changer
invalide tous les codes existants. Générer avec `openssl rand -hex 32`.

Les coordonnées de paiement (`VITE_WERO_NUMBER`, `VITE_BTC_ADDRESS`,
`VITE_ETH_ADDRESS`, `VITE_SOL_ADDRESS`) sont des variables **de build** Vite,
optionnelles : une méthode non renseignée n'apparaît pas dans la modale de don.

## Lancer en local

```bash
npm install
npm run dev      # tsx server.ts — Express + Vite en middleware
```

## Build / production

```bash
npm run build    # vite build + bundle du serveur (esbuild)
npm start        # node dist/server.cjs
```

## Qualité

```bash
npm run lint     # tsc --noEmit — vérification de types (juge de paix avant déploiement)
npm test         # vitest run — tests unitaires
```

Des tests **Vitest** couvrent les fonctions de sécurité ainsi que l'agrégation
du climat (`src/lib/climate.ts`), exécutés en intégration continue
(**GitHub Actions**).

## Notes

- `AGENTS.md` : règles de contribution — ne pas modifier les prompts IA sans
  demande explicite.
- Les prompts cliniques de la conversation vivent sur le worker Cloudflare,
  hors de ce dépôt, volontairement.