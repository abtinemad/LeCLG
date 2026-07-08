# Le collègue 
Application d'aide à la décomposition de situations difficiles, accompagnant la
personne vers un équilibre stable. Pensée comme un partenaire de réflexion
collégial — **pas** un outil de diagnostic ni un substitut thérapeutique.

https://le-coll-gue-145046526085.europe-west2.run.app/

## Architecture

Front React/Vite (SPA) servi par un serveur Express (`server.ts`), qui fait
office de **proxy unique**. Le frontend ne parle jamais directement à Supabase
ni à un modèle de langage — tout transite par le proxy.

```
                    ┌─ POST /api/worker  — un seul endpoint, dispatché par `type` :
                    │    • chat, eval ─────────────────► Worker Cloudflare ──► API Claude
                    │    • sb_read / sb_insert / sb_update ─┐
Client ──► Express ─┤    • account_create, verify           ├──► Supabase (Service Key)
 (dev 3000          │    • epicentre_*, eclat_reply         ┘
  prod 8080)        │    • enrich_*, eval_* ────────────► API Gemini (analyses du Carnet)
                    │
                    ├─ POST /api/reflection ──────────────► API Gemini   (carte de réflexion)
                    ├─ POST /api/metacognition ───────────► API Gemini   (Matrice)
                    ├─ POST /api/transcribe ──────────────► API Gemini   (dictée vocale → texte)
                    ├─ POST /api/generate-texture ────────► picsum.photos (image déterministe, sans IA)
                    ├─ GET  /api/climate ─────────────────► Supabase      (agrégation anonyme)
                    └─ GET  /api/health ──────────────────► (liveness)
```

- **Chat** : la conversation passe par le worker Cloudflare externe, qui héberge
  les instructions cliniques (les prompts ne sont **pas** dans ce dépôt,
  volontairement).
- **Analyses du Carnet** (Lien, Affect, Élan, Matrice, Lueurs) : appels Gemini
  directs depuis `server.ts`.
- **Dictée vocale** : dans le Chat, un enregistrement audio (`MediaRecorder`) est
  envoyé à `/api/transcribe`, transcrit par Gemini, et le texte remplit le champ
  de saisie. L'audio n'est jamais persisté ; en cas d'échec le client le garde
  pour réessayer. La **texture relationnelle** de chaque carte est, elle, une
  image déterministe (`/api/generate-texture` → picsum, seedée par le fragment) —
  pas une génération IA.
- **Persistance** : Supabase, écritures routées par le proxy avec la Service Key.
- **Climat de la communauté & Épicentre** : agrégation **anonyme** de la météo affective — soit
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

## Déploiement

L'image de production est construite depuis le `Dockerfile` du dépôt
(`node:20-slim` → `npm install` → `npm run build` → `dist/server.cjs`), puis
servie par **Google Cloud Run**. En production, `NODE_ENV=production` fait que
`server.ts` sert les fichiers construits (`dist/`) au lieu du serveur Vite de
développement, et écoute sur le port **8080** (`EXPOSE 8080`).

Le déploiement est **déclenché automatiquement à chaque push sur `main`** par un
trigger **Cloud Build** configuré côté console GCP : il n'y a **pas** de
`cloudbuild.yaml` versionné dans le dépôt (choix assumé). Le trigger reconstruit
l'image et redéploie la révision Cloud Run.

> Conséquence à connaître : le pipeline de déploiement **ne lance pas les
> tests**. `npm run lint`, `npm test` et `npm run visual:compare` sont à passer
> **manuellement avant** de pousser sur `main` — le push vaut mise en production.

Les variables d'environnement (voir tableau ci-dessus) sont posées sur le
**service Cloud Run**, pas dans le dépôt. Région, nom du service et URL de
production vivent dans la console GCP.

## Qualité

```bash
npm run lint     # tsc --noEmit — vérification de types (juge de paix avant déploiement)
npm test         # vitest run — tests unitaires
```

Des tests **Vitest** couvrent la logique pure du produit — agrégation du climat
(`src/lib/climate.ts`), constellation personnelle, signature relationnelle et
simulation de la galaxie (34 cas au total) — lancés par `npm test`. Deux harnais
**Playwright** complètent la couverture : une régression visuelle
(`npm run visual:compare`, écrans Carnet et Chat) et un harnais comportemental du
moteur (`tests/engine`).

Les mécanismes de sécurité (comparaison à **temps constant**, verrou
**anti-force-brute**, **liste blanche** stricte des paramètres de lecture,
HMAC-SHA256 + pepper, chiffrement AES-256-GCM au repos) sont appliqués et
**vérifiables** dans `server.ts`, mais ne sont **pas encore isolés en tests
unitaires** : ces fonctions vivent dans le monolithe serveur, non importable en
test sans le démarrer. Leur extraction dans un module dédié — condition d'une
couverture automatisée — est un chantier ouvert.

## Notes

- `AGENTS.md` : règles de contribution — ne pas modifier les prompts IA sans
  demande explicite.
- Les prompts cliniques de la conversation vivent sur le worker Cloudflare,
  hors de ce dépôt, volontairement.
