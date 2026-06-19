# Harnais de régression visuelle

Prouve qu'un refactor **rend à l'identique** : il photographie chaque état d'une
page sur `main` (baseline) et sur la branche de travail (current), puis compare
pixel à pixel et produit une image de diff par écran divergent.

Conçu pour le découpage du Carnet, **réutilisable tel quel** pour un futur split
de `Chat.tsx` (voir « Étendre » plus bas).

## Lancer

```bash
npm run visual            # baseline (main) + branche + diff   (tout)
npm run visual:current    # recapture la branche uniquement
npm run visual:compare    # re-diff les captures existantes
```

Sorties dans `visual/__output__/` (git-ignoré) :

- `baseline/` — PNG rendus depuis `main`
- `current/`  — PNG rendus depuis la branche courante
- `diff/`     — image de diff par écran non strictement identique
- `report.md` / `report.json` — tableau écran par écran

Le script sort en code ≠ 0 s'il reste un **écart réel** (au-dessus du seuil de
bruit), ce qui le rend utilisable en CI.

## Comment ça marche (et pourquoi c'est fiable)

`npm run dev` lance `tsx server.ts`, qui **exige 7 secrets** et parle au Supabase
de **prod** + un worker Cloudflare. Inadapté à une baseline déterministe. Le
harnais sert donc le SPA avec **`vite` nu** (aucun secret requis) et rend le
rendu **hors-ligne et déterministe** :

1. **Identité + données seedées dans `localStorage`** avant navigation
   (`visual/targets/carnet.ts`). Le Carnet lit son identité et ses cartes depuis
   `localStorage` ; on n'a donc **pas besoin du vrai compte de test** ni d'une
   base vivante (qui dériverait et casserait le pixel-diff).
2. **Réseau coupé** : tout `**/api/**` est `abort()`. Le `catch` de `loadCards()`
   retombe sur le `localStorage` seedé. Les analyses (lien/affect/élan/matrice)
   sont seedées avec leurs tampons de fraîcheur (`_n` = nb de cartes, `_t`
   récent), donc la chaîne d'analyses Gemini **ne se déclenche jamais** → pas de
   spinner, pas d'état d'erreur asynchrone, rendu statique.
3. **Animations gelées** : `reducedMotion`, plus une feuille de style injectée
   qui met toutes les durées d'animation/transition à 0, plus
   `animations: "disabled"` au moment du screenshot.
4. **Baseline non destructive** : `main` est rendu via un **worktree git**
   temporaire (auto-supprimé), `node_modules` symlinké. La branche de travail
   n'est jamais touchée.

Chaque écran est capturé dans un **contexte isolé** (seed neuf, UI propre) pour
qu'aucun état de modale/vue ne déborde sur la capture suivante.

### Bruit des graphiques (recharts)

Les vues à graphiques (Lien, Affect, Matrice) utilisent `ResponsiveContainer`,
qui mesure sa taille de façon asynchrone : d'un process à l'autre, le SVG du
radar bouge de quelques pixels (< 0,01 %), **même à code identique**. Le
comparateur applique donc un **seuil de bruit** (`VRT_NOISE_RATIO`, défaut
0,05 %) et compare sur la zone commune si la hauteur diffère d'un cheveu. En
dessous du seuil → `~IDENTIQUE` ; au-dessus → `DIFFÉRENT` (vrai écart).

## États capturés (cible Carnet)

5 vues (Fragments, Lien, Affect, Élan, Matrice), 5 modales (Prismes collectés,
Lueurs & Éclats, Éclat, Lecture d'une Lueur, Reprendre la réflexion) et la
barre/navigation du Shell. La modale « Reprendre » n'apparaît que sur un
fragment *verrouillé* (sans prisme) — une carte dédiée est seedée pour ça.

> La cible seede aussi `collegue_clarte_seen_carnet-*` pour neutraliser le guide
> d'accueil « Clarté » (overlay z-10000) qui, sinon, recouvre chaque écran et
> intercepte les clics. C'est du chrome partagé, hors périmètre du refactor.

## Étendre (ex. split de `Chat.tsx`)

1. Crée `visual/targets/chat.ts` exportant un `Target` (cf. type dans
   `visual/lib/harness.ts`) : `path`, `seed` localStorage, `freshKeys`, un
   `ready(page)`, et la liste des `screens` (chaque `screen` = un id + une
   `action(page)` qui amène la page dans l'état à photographier).
2. Ajoute-le à `visual/targets/index.ts`.

Le spec, l'orchestrateur et le comparateur prennent tout en charge
automatiquement. Rien d'autre à modifier.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `lib/harness.ts` | Types `Target`/`Screen` + seed localStorage + gel des animations |
| `targets/carnet.ts` | Fixtures + 11 écrans du Carnet |
| `targets/index.ts` | Registre des cibles |
| `capture.spec.ts` | Spec Playwright : 1 test isolé par écran |
| `playwright.config.ts` | Viewport/échelle/thème figés (serveur géré à l'extérieur) |
| `run.mjs` | Orchestrateur : worktree main → vite → capture → diff |
| `compare.mjs` | Diff pixelmatch + seuil de bruit + rapport |
