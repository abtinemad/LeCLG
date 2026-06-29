# Filet de sécurité visuel — page Chat (`src/pages/Chat.tsx`)

Extension du harnais de régression visuelle (`visual/`) pour couvrir la page
**Chat**, **avant tout refactor**. Aucune modification de `src/` : seuls des
fichiers de `visual/` ont été ajoutés (`visual/targets/chat.ts`) ou édités pour
enregistrement (`visual/targets/index.ts`).

Comme rien n'est refactoré, la baseline (`main`) et la branche courante servent
le **même code applicatif** : chaque écran Chat doit ressortir **IDENTIQUE**.

## Résultat — `npm run visual`

```
chat-accueil-accueil-pastilles      IDENTIQUE    0 px (0.0000%)
chat-conversation-conversation      IDENTIQUE    0 px (0.0000%)
chat-validation-validation-card     IDENTIQUE    0 px (0.0000%)
```

16 écrans au total (13 Carnet + 3 Chat) · **16 identiques · 0 écart réel**.

Déterminisme inter-run vérifié : une **seconde** capture `current` à un instant
différent rediffe encore à **0 px** sur les 3 écrans Chat (aucun scintillement).

## Compte rendu écran par écran

| Écran | Cible | État seedé | Rendu | Verdict |
|-------|-------|------------|-------|---------|
| **(a) Accueil / pastilles** | `chat-accueil` | identité seule, **sans** `collegue_chat_state` | sélecteur d'état du jour (« C'est quoi, là, maintenant ? » + pastilles), texte « Prenez le temps. » | ✅ 0 px |
| **(b) Conversation en cours** | `chat-conversation` | `collegue_chat_state` : `sessionActive:true`, `showEnded:false`, `closingPhase:"none"`, 5 messages, `validatedSteps:[0,1]`, `pendingStep:null` | fil de discussion, rail d'étapes (Situation ✓ · Ressenti ✓), bouton « Déposer », zone de saisie | ✅ 0 px |
| **(c) Carte de validation** | `chat-validation` | comme (b) mais `pendingStep:2` (« Demande »), `loading:false` | carte « Émergence identifiée » + bouton « Valider l'étape », pastille d'étape 2 en attente | ✅ 0 px |
| **(d) Écran de fin / clôture** | — | `showEnded:true` + `reflectionCard` | **non capturé** — voir ci-dessous | ⚠️ non atteignable par seed seul |

## (d) Écran de fin — non atteignable par seed seul (signalé, non contourné)

L'écran de clôture (`showEnded:true`, carte de réflexion remplie) **ne peut pas
être atteint hors-ligne par seed**, et l'app n'a pas été modifiée pour le forcer.

Deux verrous, tous deux dans `src/pages/Chat.tsx` :

1. **Garde de restauration** (`Chat.tsx:899-904`) : au montage, tout
   `collegue_chat_state` persistant dont `showEnded === true` (ou
   `closingPhase === "closed"`) est jugé « non ouvert » (`isOpen` faux), **effacé
   de localStorage**, et l'on retombe sur l'accueil. Un seed `showEnded:true` est
   donc systématiquement jeté avant tout rendu.
2. **Transition réseau uniquement** : `setShowEnded(true)` ne passe que par
   `finalizeClose` (`Chat.tsx:3088`), lui-même atteint via `triggerMirror` /
   synthèse — c'est-à-dire des appels réseau. Or le harnais coupe `**/api/**`.
   L'écran de fin est donc inaccessible aussi par enchaînement de clics.

Conclusion : conformément à la contrainte ferme, cet écran est **explicitement
laissé hors couverture** plutôt que d'être débloqué en touchant `src/`. Pour le
couvrir après le refactor, il faudrait soit assouplir la garde de restauration
(accepter un état terminé restaurable), soit exposer un point d'entrée de
clôture sans réseau — décisions applicatives, hors périmètre de ce filet.

## Notes de conception (déterminisme & seeds)

- **Plusieurs cibles, un seul fichier.** `/chat` est entièrement déterminé par
  une unique clé localStorage (`collegue_chat_state`, forme exacte =
  `applyChatState`, `Chat.tsx:833`) que le harnais **ré-applique à chaque
  navigation** (`harness.ts:77`). Deux états distincts (accueil / conversation /
  validation, `pendingStep` null vs entier) exigent donc des seeds distincts →
  une `Target` par état (`chat-accueil`, `chat-conversation`, `chat-validation`),
  toutes dans `visual/targets/chat.ts`.
- **Restauration directe.** Pour éviter l'écran intermédiaire « conversation
  laissée ouverte » (`Chat.tsx:917`, déclenché si `userMsgs>=1 && idleFor>30s`),
  `lastActivity` est seedé **dans le futur** (≈ an 2100) : `idleFor < 0` → la
  session est restaurée directement via `resumeWithCodeGuard` (100 % local,
  aucun réseau), et l'effet « silence → apaisement » ne se déclenche jamais.
  Valeur fixe → reproductible quelle que soit l'heure du run.
- **Animations non figeables masquées.** Deux éléments pilotés par JS (ni CSS, ni
  `animations:"disabled"` ne les arrêtent) sont masqués au moment de la capture,
  `visibility:hidden` (layout préservé), dans le `ready()` des cibles :
  - le **serpentin** de pied de page (`<canvas>`, `requestAnimationFrame` continu) ;
  - l'**œil** `LogoEmber` (regard / clignement / dérive pilotés par
    `Math.random()` + `setTimeout`, voir `LogoEmber.tsx`),
    `svg[aria-label="L'Œil Conscient"]`.

  L'injection est symétrique (même spec pour baseline et current), donc
  n'introduit **aucun** écart — elle ne fait que neutraliser un bruit
  intrinsèque, exactement comme `FREEZE_CSS` neutralise les transitions. Le reste
  de l'écran (messages, rail d'étapes, carte de validation, pastilles, textes,
  mise en page) reste pleinement couvert — c'est ce qu'un refactor toucherait en
  premier.

## Reproduire

```bash
npm run visual            # baseline (main) + current (branche) + diff
npm run visual:current    # recapture current uniquement
npm run visual:compare    # rediff sans recapturer
```
