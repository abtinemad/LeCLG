Le collègue
Application d'aide à la décomposition de situations difficiles, accompagnant la
personne vers un équilibre stable. Pensée comme un partenaire de réflexion
collégial — pas un outil de diagnostic.
Architecture
Front React/Vite (SPA) servi par un serveur Express (server.ts), qui fait
office de proxy unique. Le frontend ne parle jamais directement à Supabase ni à
un modèle de langage.
                         ┌── /api/worker (chat, eval) ──► Worker Cloudflare ──► API Claude
Client ──► Express (3000) ┼── /api/worker (sb_*) ────────► Supabase (Service Key)
                         ├── /api/metacognition, enrich_*, eval_* ──► API Gemini (SDK)
                         └── /api/climate ─────────────────────────► Supabase

Chat : la conversation passe par le worker Cloudflare externe, qui héberge
les instructions cliniques (les prompts ne sont pas dans ce dépôt).
Analyses du Carnet (Lien, Affect, Élan, Matrice, Lueurs) : appels Gemini
directs depuis server.ts.
Persistance : Supabase, écritures routées par le proxy avec la Service Key.

Prérequis

Node.js
Un projet Supabase (schéma dans supabase_schema.sql)
Une clé API Gemini et un worker Cloudflare configuré pour le chat

Variables d'environnement
Copier .env.example vers .env et renseigner :
VariableRôleGEMINI_API_KEYAppels Gemini (analyses du Carnet)SUPABASE_SERVICE_KEYAccès Supabase côté serveurSUPABASE_URLURL du projet SupabaseADMIN_PASSWORDAccès au panneau d'administrationCF_WORKER_URLURL du worker Cloudflare (chat/eval)INTERNAL_SECRETSecret partagé Express ↔ worker Cloudflare
Lancer en local
bashnpm install
npm run dev      # tsx server.ts — Express + Vite en middleware
Build / production
bashnpm run build    # vite build + bundle du serveur (esbuild)
npm start        # node dist/server.cjs
Notes

AGENTS.md : règles de contribution — ne pas modifier les prompts IA sans
demande explicite.
Les prompts cliniques de la conversation vivent sur le worker Cloudflare,
hors de ce dépôt, volontairement.
