# Audit design — Le Collègue

**Périmètre.** Frontend React/TypeScript/Vite du Carnet, ses cinq vues et ses six modales, plus le panneau Admin. Corpus visuel : les 11 PNG de référence du harness Playwright (`visual/__output__/baseline/`). Lecture croisée avec le code source (`src/`) pour vérifier les libellés, tokens et conditions d'affichage que les captures ne révèlent pas.

**Version auditée.** Repo `abtinemad/LeCLG`, `HEAD = ab8830f` (« chore(carnet): remove dead recharts imports »).

**Date.** 28 juin 2026.

**Méthode.** Pour chaque écran, passage des dix critères du barème. L'état est noté `✓` (conforme), `⚠︎` (tension / arbitrage à expliciter) ou `✗` (dérive avérée au regard du §1). Conformément au §5, aucun correctif ne pousse vers l'esthétique soin/bien-être, ne nomme/légende/code-couleur un prisme comme une émotion, ni ne transforme l'interlocuteur en conseiller ; les « améliorations » qui violeraient ces points sont reformulées en **constats de risque de dérive**. Les tableaux ne listent que les critères matériellement engagés sur l'écran ; les critères non sollicités sont regroupés en fin de section (« RAS notable »).

**Limite assumée.** L'audit s'appuie sur les baselines commités et le code, non sur une session vivante du site de référence. Les contenus dynamiques (textes d'analyse produits à l'exécution) sont jugés sur leur *gabarit* et leur *cadre de présentation*, pas sur des occurrences précises. Les points où l'intention produit reste ambiguë sont renvoyés à l'annexe.

**Convention de criticité.** Les critères : **C1** Non-soin · **C2** Retenue de l'interlocuteur · **C3** Refus de nommer (prismes ≠ émotions) · **C4** Lisibilité du parcours en cinq temps · **C5** Cohérence du design system · **C6** Hiérarchie & charge cognitive · **C7** Voix UX / micro-copy · **C8** Honnêteté de l'Éclat · **C9** Accessibilité · **C10** Admin / posture.

---

## Constat-cadre (à lire avant les écrans)

Trois dérives ne sont pas des défauts d'un écran mais de l'architecture ; elles se rejouent partout et sont traitées une fois ici, puis simplement *pointées* écran par écran.

**A. Le prisme **est** une émotion, dans le code comme à l'écran.** La source unique `src/data/emotions.ts` s'appelle `EMOTIONS` et chaque entrée porte un `label` du type `"Joie (Prisme)"`, `"Colère (Prisme)"`, `"Peur (Prisme)"`, assorti d'une couleur fixe (`color: "#C6AF53"`…). `src/data/prismes.ts` décrit ensuite chaque prisme *comme* l'émotion (« La joie est un signal d'adéquation entre l'être et son acte »). Le commentaire interne de `Admin.tsx` l'énonce sans détour : « *Un prisme est une émotion débloquée […] quand l'équilibre est atteint.* » Le §1 pose l'inverse : *l'utilisateur découvre ce lien lui-même ; aucun label, couleur, légende ou micro-copy ne doit nommer l'émotion à sa place.* L'identité du prisme-comme-glyphe-coloré-étiqueté-d'un-nom-d'émotion est donc une **violation structurelle de C3**, pas un accident de copie. Elle se manifeste dans la modale Prismes (label sous chaque icône), dans Lien (« Teinte dominante : Confiance »), dans la Constellation (libellé au survol) et dans l'Admin (« Prisme débloqué »). *Le correctif n'est jamais « mieux nommer » — ce serait aggraver la dérive. Voir la remédiation R1.*

**B. La réflexion est emballée dans une mécanique de collection et de complétion.** « Prismes Collectés **8/16** », l'icône prisme qui devient *rainbow* dès qu'on en « possède », « Allez au bout des cinq étapes pour **déverrouiller** le prisme », les blocs `LockedBlock`/`LockedSection` avec « Condition : … » / « Requis : … », et côté Admin « **Complètes** », « Complétion 64 % », « `step/5` », « Prisme débloqué ». Le §3-C4 proscrit précisément la barre de progression / récompense de complétion qui *transforme la réflexion en tâche à finir*. C'est ici un **système**, pas une étourderie : déverrouillage, score, badge, taux de complétion. *Voir R2.*

**C. Un lexique para-clinique et hermétique tient lieu de voix.** « métabolisée / métabolisation », « sédimentation », « Angoisses de structure », « Système de Défense », « déclencheur », « Luminescence Émotionnelle ». Le registre soutenu est tenu (bon point C7), mais il bascule par endroits dans le vocabulaire psychodynamique (« Angoisses », « Défense », « déclencheur ») — donc dans le **modèle du soin** que C1 récuse — et ailleurs dans un jargon maison opaque qui alourdit la charge cognitive (C6). *Voir R5.*

Ces trois axes structurent toute la suite.

---

## Écran 1 — `carnet-view-matrice`

Vue de synthèse : radar « Angoisses de structure » (intensités %), « Valeurs d'ancrage », « Schéma Central » (« Un schéma central de don conditionnel… »), « Système de Défense », bouton « Invoquer un Éclat », « Lueurs accumulées ».

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C1 | ✗ | « **Angoisses de structure** » et « **Système de Défense** » (avec « Déclencheur ») importent le vocabulaire psychodynamique : c'est le modèle du soin/diagnostic, pas la réflexion structurée. Le radar de l'angoisse en `%` ajoute une métrique quasi-symptomatique. | Renommer vers un registre descriptif non clinique (p. ex. « Tensions de fond », « Appuis » / « Ce sur quoi ça tient », « Manières de se protéger ») et retirer la quantification `%` du registre des angoisses — une intensité chiffrée d'angoisse est un geste de mesure clinique. |
| C2 | ✓ | « Schéma Central » et « Observation : … » tiennent l'espace sans conseiller ; pas d'impératif « tu devrais ». | RAS — préserver ce phrasé d'observation. |
| C3 | ✗ | Sous-jacent : les prismes nourrissent cette vue ; « Lueurs accumulées » et le PDF « Prête pour l'Eclat ». Pas de nommage d'émotion *ici*, mais la vue agrège des données prisme=émotion. | Hérite de **R1** ; aucun correctif local. |
| C4 | ⚠︎ | La Matrice est présentée comme un aboutissement (« Structure cristallisée · Prête pour l'Eclat ») — fin de parcours, donc complétion implicite. | Décharger la formule de sa téléologie : « Structure telle qu'elle se dessine aujourd'hui », sans « Prête pour… » qui fait de l'Éclat la récompense terminale. |
| C5 | ⚠︎ | Coexistence de tokens propres (`text-matrice`, `var(--color-red)`) et de valeurs codées en dur (`#3a3420`, `#a8a29e`, `rgba(245,158,11,…)`). Coquille « l'**Eclat** » (sans accent) vs « Éclat » ailleurs. | Router les couleurs résiduelles vers les alias ; corriger « Eclat » → « Éclat ». Voir R3. |
| C6 | ⚠︎ | Densité élevée : radar + barres + manifestations en `text-[7px]` + deux colonnes d'analyse. Le blanc est présent mais la moitié basse est saturée de micro-texte. | Hiérarchiser : une seule métrique forte par bloc, reléguer les manifestations en révélation au survol/dépli plutôt qu'en nuage permanent de puces 7px. |
| C9 | ✗ | `text-[7px]`/`text-[8px]` en `text-beige/20` pour libellés et dates : sous le plancher WCAG (taille + contraste). | Voir R4 (arbitrage sobriété/contraste). |

RAS notable : C7 (registre tenu), C8 (l'Éclat est correctement signalé « Métabolisation humaine ponctuelle » sous le bouton — bon point), C10 (hors périmètre écran).

---

## Écran 2 — `carnet-view-elan`

« Mouvement » (« Un mouvement de consolidation… »), « Direction » (« Vers une affirmation plus tranquille de vos limites… »), « La question qui travaille », bloc « Clusters récurrents & signaux » / « Convergence des directions » / « Polarité dominante ».

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C2 | ✓ | « La question qui travaille » + « Observation : … » : l'interlocuteur ouvre, ne conclut pas. Modèle à généraliser. | Préserver. C'est la meilleure incarnation de la retenue dans le corpus. |
| C4 | ✓ | Élan lisible comme *temps* du mouvement, sans gamification visible sur cet écran. | RAS. |
| C6 | ✓ | Écran le plus aéré : blanc délibéré, une idée par palier. **Référence interne de hiérarchie.** | En faire le gabarit de référence pour réaligner les écrans saturés (Lien, Affect). |
| C7 | ⚠︎ | « Polarité dominante : Réarticulation des liens » — « Polarité » est un emprunt clinique léger ; « décantation » / « clusters » mêlent poésie et jargon data. | Lisser « Polarité » → « Tendance » ; conserver le ton mais surveiller l'anglicisme « clusters ». |
| C9 | ⚠︎ | Capitales mono très espacées en faible opacité (« LA QUESTION QUI TRAVAILLE ») : lisibilité limite mais taille correcte. | Acceptable si le contraste du texte courant est relevé (R4). |

RAS notable : C1 (pas de marqueur de soin), C3 (pas de nommage d'émotion), C5 (cohérent), C8/C10 (hors écran).

---

## Écran 3 — `carnet-view-affect`

« Gradients de Profondeur (moteurs / inhibiteurs / émergents) » avec chips colorés (`élan`, `curiosité`, `tendresse` / `fatigue`, `retrait` / `apaisement`, `clarté`), « Texture affective de la semaine », « **Lecture croisée Affects / Prismes** », « Rythme de sédimentation » (heatmap), « **Luminescence Émotionnelle** ».

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C3 | ✗ | « **Lecture croisée Affects / Prismes** » (`lecture_croisee_affect_prismes`) **fait le lien à la place de l'utilisateur** : elle met explicitement en regard l'affect nommé et le prisme. C'est précisément la découverte que le §1 réserve à l'utilisateur. Le graphe « Luminescence Émotionnelle » classe en outre les prismes en moteurs/inhibiteurs/émergents (valence) — un modèle émotionnel imposé. | **Constat de dérive (pas de « clarification » à ajouter).** Retirer la *mise en correspondance explicite* affect→prisme de la surface utilisateur, ou la réduire à une observation qui n'épelle pas l'équivalence. La corrélation peut exister en interne sans être affichée comme légende. Voir R1. |
| C1 | ⚠︎ | Les chips d'affect sont nommés (`fatigue`, `retrait`, `apaisement`) — légitime, l'affect *est* la couche émotionnelle assumée. Mais le code-couleur par valence (orange/ardoise/vert) frôle la grille d'humeur d'app de bien-être. | Garder les noms d'affect (eux sont permis), mais neutraliser la **lecture morale** de la couleur : éviter que « moteurs » soit chaud-positif et « inhibiteurs » froid-négatif, ce qui sur-signifie une valence. |
| C4 | ✓ | Affect lisible comme temps ; pas de score de complétion ici. | RAS. |
| C5 | ⚠︎ | Heatmap en `rgba(123,167,215,α)` codé en dur (= `--color-affect` non aliasé) ; lignes recharts en `#ffffff20`. | Aliaser ; voir R3. |
| C6 | ⚠︎ | Trois systèmes de visualisation (chips + heatmap + courbe) sur un écran : charge forte pour un outil de contemplation. | Séparer en paliers révélés, ou n'afficher qu'une visualisation primaire ; ce n'est pas un dashboard. |
| C9 | ✗ | Libellés d'axes `7px`, légende `text-affect/50` : sous le seuil. | R4. |

RAS notable : C2 (« Observation », pas de conseil), C8/C10 (hors écran).

---

## Écran 4 — `carnet-view-lien`

Radar des 4 sphères, cartes « Familiale 72 % / Confiance », « Sociale 54 % / Joie », « Amoureuse 81 % / Amour », « Professionnelle 65 % / Anticipation », « Structure invisible », « Constellation des Prismes », « Climat de sphère ».

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C3 | ✗ | Chaque carte de sphère affiche « **Teinte dominante** » dont la valeur est un **nom d'émotion** (`{data.teinte}` = « Confiance », « Amour »…), coloré par `theme.hex` (couleur de l'émotion). La **Constellation** étiquette chaque point au survol par le nom du prisme (`p.label`) dans sa couleur d'émotion + « ×n ». Double nommage (texte + couleur). | **Dérive C3 à corriger, pas à raffiner.** Remplacer la valeur nommée par une restitution non-émotionnelle (le glyphe-prisme et/ou le ou les fragments qui la portent), et délier la couleur de l'identité émotionnelle. La constellation peut montrer une géométrie de densité sans épeler l'émotion. Voir R1. |
| C4 | ✗ | « `{intensite}%` » + **barre de progression animée** par sphère : la relation est notée comme une jauge. Quantifier l'« intensité » d'un lien (81 %) installe un score là où le §1 veut de la réflexion non gamifiée/non réductrice. | Retirer le pourcentage et la barre. Exprimer la prégnance par un moyen non métrique (taille/poids typographique du nom de sphère, nombre de fragments rattachés) sans chiffre ni jauge. |
| C2 | ✓ | « Structure invisible » + « Avant le mouvement, avant la pensée » : posture d'ouverture tenue. | Préserver. |
| C5 | ⚠︎ | `#1a1814`, `rgba(245,158,11,0.1)`, `#3a3420` codés en dur ; couleurs de sphère dupliquées hors tokens. | R3. |
| C6 | ✗ | Écran le plus chargé du corpus : radar + 4 cartes (chacune : %, barre, fragments, teinte, champ « Songe ») + structure + texture/dissociation + constellation + topographie + climat. Le « vide » n'est pas un instrument ici, il a disparu. | Fragmenter en paliers ; remonter une seule lecture forte (la « Structure invisible ») et reléguer les sous-analyses en révélation. S'inspirer d'Élan (C6 ✓). |
| C9 | ✗ | Mêmes `6–8px`/faible opacité ; le texte des songes en `text-[9px]`. | R4. |

RAS notable : C1 (« Climat de sphère » ok), C7 (« Songe » : joli, sur-registre mais cohérent), C8/C10 (hors écran).

---

## Écran 5 — `carnet-view-fragments` (+ `carnet-shell-toolbar`)

Liste hebdomadaire de cartes (fonds dégradés colorés par semaine), « Progression dans les étapes », nuage de mots (« fragment moment / bascule quelque / déplacement regard »), barre d'outils (nav 5 temps + icônes Prismes/Lueurs/Retour).

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C4 | ✗ | La **toolbar** présente les cinq temps comme un commutateur plat **dans le désordre** du §1 : `Fragments · Lien · Affect` puis `Élan · Matrice`. La séquence canonique *Matrice → Élan → Affect → Lien → Prisme/équilibre* n'est lisible nulle part, et « Prisme » n'y figure pas comme temps (relégué en modale-collection). Un bandeau « **Progression dans les étapes** » apparaît par ailleurs sur Fragments. | Rendre l'ordre des cinq temps lisible (séquence, pas onglets égaux et permutés) **sans** le transformer en barre de complétion : un fil ordonné, non coché, sans pourcentage. Clarifier le statut de « Fragments » (journal) vs les cinq temps. Décision produit — annexe A1. |
| C3 | ⚠︎ | Les cartes-semaine sont teintées par dégradés liés à l'affect/prisme dominant : la couleur re-signifie l'émotion. | Délier la teinte de carte de l'émotion (neutraliser ou indexer sur la sphère/temps, pas sur l'émotion). R1. |
| C2 | ✓ | Icône Chat infobulle « **Penser** » (pas « Assistant »/« Chat ») : excellent marqueur de posture. | Préserver — modèle pour le reste. |
| C6 | ⚠︎ | Empilement de cartes très colorées : le mur chromatique contredit la sobriété contemplative. | Abaisser la saturation des fonds ; réserver la couleur à un accent, pas au fond plein. |
| C9 | ⚠︎ | Le badge « Mode Reconnaissance » et les méta `8px` passent juste ; contraste des fonds colorés sur texte à vérifier. | R4. |

RAS notable : C1, C5 (toolbar propre, tokens utilisés), C7 (« faire un retour » sobre), C8/C10.

---

## Écran 6 — `carnet-modal-prismes`

« Prismes Collectés **8/16** — Une lentille qui décompose ce que tu traverses pour le rendre lisible. » Grille d'icônes-trapèzes colorées étiquetées **JOIE, TRISTESSE, COLÈRE, PEUR…**, badge de compte par prisme, « Cliquez sur un prisme pour en comprendre la clarté ».

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C3 | ✗✗ | **Épicentre de la dérive C3.** Sous chaque glyphe, le nom de l'émotion (`em.label.split(" ")[0]`) ; couleur = couleur d'émotion ; survol = `em.label` complet ; clic → description qui *est* la définition de l'émotion (`prismes.ts`). L'UI nomme, colore, légende et explique l'émotion à la place de l'utilisateur — les quatre gestes interdits par le §1, réunis. | **Ne pas « améliorer le libellé ». Le retirer.** Le prisme doit pouvoir être contemplé comme glyphe/teinte sans nom d'émotion accolé ni définition livrée. La « lentille qui décompose » peut rester muette sur le *nom* et ne donner qu'une *texture* phénoménologique que l'utilisateur relie seul. Refonte = R1 (décision produit, annexe A2). |
| C4 | ✗ | « **Collectés 8/16** », icône *rainbow* au premier prisme, badge numérique de récurrence : collection + score. « 8/16 » fait de la réflexion une grille à compléter. | Supprimer le ratio `n/16` et la logique de collection ; l'icône ne doit pas « s'allumer » comme une récompense. Présenter les prismes rencontrés sans totaliseur ni complétude visée. |
| C5 | ✗ | Total incohérent : **/16** ici (`EMOTIONS` = 16) vs **/10** dans l'Admin (`prismeCount … /10`). | Aligner la source du total (et idéalement supprimer le total, cf. C4). R3. |
| C7 | ✗ | **Rupture tu/vous** : « ce que **tu** traverses » ici, alors que « Cliquez », « votre Matrice », « vos sphères » (vouvoiement) partout ailleurs. | Trancher le vouvoiement (dominant et plus accordé au registre soutenu) et l'appliquer partout. R6. |
| C9 | ✗ | Étiquettes `text-[6px]` (les plus petites du corpus) en `text-beige/20`. | R4 — ou suppression (cf. C3). |

RAS notable : C1, C2, C8/C10.

---

## Écran 7 — `carnet-modal-eclat`

Formulaire d'invocation : marque du Collègue (rouge), « L'Éclat », « Votre Matrice et votre demande seront métabolisées par l'expérience humaine. Un acte ponctuel, rare et structurant. », champ libre, bouton « Envoyer la demande », lien discret « Soutenir » (PayPal).

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C8 | ⚠︎ | La provenance humaine est **affirmée** (« métabolisées par l'expérience humaine », « métabolisation humaine ») — bon. Mais la marque rouge en tête est **la même** que celle de l'interlocuteur guidant ailleurs : à la lecture des réponses, l'Éclat (humain) et le Collègue (système) partagent la signature visuelle → provenance brouillée à l'arrivée. | Conserver l'affirmation de provenance. **Distinguer visuellement** l'Éclat humain de l'interlocuteur : signature/typographie propre à l'Éclat, pour que « rédigé par un humain » soit lisible *à la réception*, pas seulement promis à l'envoi. |
| C1 | ⚠︎ | « métabolisées », « structurant » : registre fort, non clinique — ok. Le bouton « Soutenir » (don) introduit une couche transactionnelle dans un moment intime. | Acceptable, mais maintenir le don *visuellement secondaire* (c'est le cas). Ne pas laisser la sollicitation financière coloniser le geste. |
| C2 | ✓ | L'Éclat est posé comme « acte ponctuel, rare », pas comme une réponse à la demande : la retenue est tenue. | Préserver. |
| C7 | ✓ | Vouvoiement, sobriété. | Étendre ce standard (cf. R6). |

RAS notable : C3 (—), C4 (—), C5 (token `evolution` propre), C6 (modale épurée, bon point), C9 (à vérifier sur le `8px` du bouton « Fermer »).

---

## Écran 8 — `carnet-modal-resume`

« Reprendre cette réflexion ? — Allez au bout des cinq étapes pour **déverrouiller le prisme** : il décompose un faisceau complexe en rayons distincts… un signe de **clairvoyance**. » Boutons « Reprendre » / « Plus tard ».

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C4 | ✗✗ | Formulation gamifiée explicite : « **Allez au bout des cinq étapes pour déverrouiller le prisme** ». Les cinq temps deviennent une quête à finir pour décrocher une récompense. Contradiction frontale avec C4. | Reformuler sans verbe d'objectif ni déverrouillage : « Le prisme se dégage à mesure que la réflexion va à son terme » — fin de la réflexion comme *aboutissement naturel*, non comme palier débloqué. Retirer « Allez au bout ». |
| C3 | ⚠︎ | « déverrouiller **le prisme** » associe encore le prisme à un objet à gagner ; « clairvoyance » valorise. | Couplé à R1/R2. |
| C2 | ✓ | « Reprendre cette réflexion ? » respecte le choix. | Préserver. |
| C7 | ✓ | Vouvoiement implicite, registre tenu. | RAS. |

RAS notable : C1, C5, C6 (modale sobre), C8/C10. C9 : titre serif lisible, bon contraste.

---

## Écran 9 — `carnet-modal-lueurs-eclats`

Pile « Lueurs & Éclats — Pour éclairer les vides de votre Matrice ». Liste de Lueurs (« Dernière lueur · Juin 2026 · *La limite comme soin* »), liste d'Éclats (citation + marque rouge du Collègue), sinon « Invoquer un Éclat » + « Métabolisation d'une demande par l'expérience humaine » (en `6px`).

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C8 | ✗ | La mention de provenance humaine existe mais en **`text-[6px]`, opacité 20 %** — quasi invisible. Et chaque Éclat est listé sous la **marque rouge du Collègue** (`CollegueMark text-red/70`), identique à l'interlocuteur-système : l'utilisateur ne peut pas distinguer le texte humain du reste. | Relever la mention de provenance à une taille lisible ; surtout, **donner à l'Éclat une signature distincte** de l'interlocuteur. La provenance humaine est une promesse-clé du §1 : elle ne peut pas vivre en 6px sous l'icône du système. |
| C1 | ⚠︎ | Titre de Lueur « **La limite comme soin** » : le mot *soin* apparaît à l'écran. Contenu éditorial humain, sens philosophique (« prendre soin de soi »), non clinique — mais sur un produit « pas de soin », le mot est sensible. | **Ne pas censurer unilatéralement** : c'est de l'Éclat humain, assumé. À arbitrer par l'auteur (annexe A3) — soit c'est un usage revendiqué, soit le titre évite « soin ». |
| C4 | ⚠︎ | « éclairer les vides de votre Matrice » : le « vide » comme manque à combler réintroduit une logique de complétion douce. | Reformuler vers la lecture, pas le comblement (« éclairer ce que la Matrice laisse dans l'ombre »). |
| C9 | ✗ | `6px`/`7px`/opacité 20–30 % pour mentions et dates. | R4. |

RAS notable : C2, C3, C5, C6, C7, C10.

---

## Écran 10 — `carnet-modal-lueur-reader`

Lecture plein-texte d'une Lueur : visuel génératif en tête, « *La limite comme soin* », « Poser une limite n'est pas rompre le lien : c'est le rendre… ».

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C8 | ⚠︎ | Même enjeu que l'écran 9 : rien dans le lecteur ne **réaffirme** que ce texte est de provenance humaine (la Lueur est-elle générée ou écrite ? l'UI ne le dit pas ici). | Marquer la provenance dans le lecteur lui-même (mention discrète mais lisible), surtout si Lueur et Éclat n'ont pas le même statut d'auctorialité — point à clarifier (annexe A2/A3). |
| C1 | ✓ | « Poser une limite n'est pas rompre le lien… » : pensée structurée, registre juste, aucune chaleur thérapeutique. | Préserver — c'est la voix éditoriale au mieux. |
| C6 | ✓ | Le lecteur isole le texte : blanc maîtrisé, attention dirigée. Bon usage du vide. | Référence de contemplation. |
| C9 | ⚠︎ | Le visuel sombre en tête + texte clair : contraste du corps à vérifier mais a priori correct (serif clair sur fond noir). | Vérifier les méta `JUIN 2026` en faible opacité. |

RAS notable : C2, C3, C4, C5, C7, C10.

---

## Écran 11 — `pages/Admin.tsx` (Admin / posture)

Auth par mot de passe ; en-tête « Sessions / **Complètes** » ; navigation « Analyse globale / Éclats / Retours » ; détail session avec « ID Client », « Étapes `n/5` », « Prismes `n/10` », badge « **Prisme débloqué** », « Carte de réflexion **générée** » ; éditeur « Réponse — métabolisation humaine ». Couleurs `yellow-400/blue-500/emerald-500`.

| Critère | État | Constat | Correctif (conforme §1) |
|---|---|---|---|
| C10 | ✗ | L'Admin **réimporte un cadre de surveillance et de funnel** : « Complètes », « Complétion 64 % », « Étapes n/5 », « Prismes n/10 » par personne, « **ID Client** ». La revue de l'auteur devient mesure de conversion + suivi nominatif des « prismes » d'un individu — exactement le cadre clinique/surveillance que C10 veut tenir hors de la relation. | Recentrer l'Admin sur sa fonction utile (lire une session, écrire un Éclat) et **retirer les métriques de complétion/conversion** et le décompte de prismes par personne. Remplacer « ID Client » par un identifiant non commercial (« Clé » / « personne »). La revue n'a pas besoin d'un tableau de bord d'engagement. |
| C8 | ✓ | Point fort : l'éditeur « Réponse — métabolisation humaine » confirme que **l'Éclat est écrit à la main** au niveau de l'auteur. La provenance humaine est réelle à la source. | Préserver — et la rendre visible côté utilisateur (cf. R7). |
| C3 | ✗ | Commentaire et UI : « Prisme **débloqué** », « Un prisme est une **émotion** débloquée ». La confusion prisme=émotion est inscrite jusque dans l'outil interne, ce qui la pérennise dans tout ce qui en dérive. | Aligner le modèle interne sur l'identité produit (R1) ; au minimum, cesser de matérialiser « prisme = émotion » dans les libellés Admin. |
| C5 | ✗ | Palette hors-charte : `yellow-400`, `blue-500`, `emerald-500`, `#EA580C` codés en dur — aucun rapport avec les tokens « pigment fané ». L'Admin vit dans un autre design system. | Reskinner sur les tokens produit. R3. |
| C7 | ⚠︎ | « Carte de réflexion **générée** », « En attente de réponse » : registre outil, acceptable en interne, mais « générée » contredit l'artisanat revendiqué côté Éclat. | Cohérence lexicale interne ; distinguer ce qui est *analysé par le système* de ce qui est *écrit par l'humain*. |

RAS notable : C1 (interne), C2/C4/C6/C9 (surface admin, hors expérience utilisateur — mais lisibilité `7–8px` également perfectible).

---

## Synthèse transversale

**Motifs récurrents (du plus structurant au plus local).**

1. **C3 — Le prisme nommé/coloré/défini comme émotion** traverse 6 des 11 écrans (Affect, Lien, Fragments, modale Prismes, Lueurs, Admin) et est inscrit dans les deux fichiers de données (`emotions.ts`, `prismes.ts`) et dans le modèle mental de l'Admin. C'est **la** dette d'identité : tant que la source s'appelle `EMOTIONS` et que les labels portent « (Prisme) », chaque vue re-violera C3 « gratuitement ». Priorité absolue, mais c'est une **décision produit**, pas un patch CSS (annexe A2).

2. **C4 — Mécanique de complétion/collection** : « 8/16 », « déverrouiller », `LockedBlock`/« Condition »/« Requis », « Complètes/Complétion », icône *rainbow*-récompense, jauges `%`. Le parcours-de-pensée est habillé en jeu de progression. Transversal (modale Prismes, Résumé, toutes les vues via le gating, Admin).

3. **C9 — Plancher de lisibilité** : `6–8px` en mono capitales à `opacity 0.2–0.4` est généralisé. C'est l'esthétique du murmure, mais sous WCAG AA sur la taille *et* le contraste. À traiter comme **arbitrage explicite** (cf. R4), pas comme correctif imposé.

4. **C1/C7 — Glissements para-cliniques** ponctuels (« Angoisses de structure », « Système de Défense », « déclencheur », « Polarité ») et **rupture tu/vous** (modale Prismes vs reste). Le registre soutenu est globalement une réussite ; ce sont des fuites, pas une tendance de fond.

5. **C5 — Dette de tokens** : architecture à deux étages (primitives + alias sémantiques) **excellente en intention**, mais contournée par des hex codés en dur (`#1a1814`, `#3a3420`, `#EA580C`, `rgba(245,158,11,…)`), un total de prismes incohérent (16 vs 10), une coquille « Eclat/Éclat », et un Admin entièrement hors-charte (`yellow/blue/emerald`).

**Points de dérive systémique (à formuler comme risques, §5).** Le design *dérive spontanément vers deux modèles que le §1 récuse* : (a) le **modèle data/dashboard** (scores, %, heatmaps, funnel admin) qui réifie et mesure ce qui devrait rester réflexif ; (b) le **modèle ludique de complétion** (collection, déverrouillage, badges) qui transforme la pensée en tâche. La tentation « UX générique » d'ajouter clarté/réassurance se manifesterait ici en *nommant mieux les prismes* ou en *félicitant la complétion* — ce seraient des aggravations, à refuser.

**Ce qui est juste et doit être protégé.** L'écran Élan (hiérarchie, retenue) ; l'infobulle « Penser » ; le phrasé « Observation : … » / « La question qui travaille » ; l'Éclat réellement écrit à la main ; l'architecture de tokens ; l'absence totale de dégradés « ligne d'écoute », de puces-suggestions de chatbot et de chaleur « tu vas y arriver ». **Le produit ne dérive pas vers le soin par son atmosphère** (sobre, nocturne, soutenue) — il dérive par sa *mécanique* (mesure + complétion) et son *modèle de données* (émotion nommée).

---

## Remédiation priorisée (impact identité × coût)

Impact = atteinte à l'**identité produit** (§1), pas à l'esthétique. Coût = effort d'implémentation estimé.

| # | Action | Critères | Impact identité | Coût | Priorité |
|---|---|---|---|---|---|
| **R1** | **Délier le prisme de l'émotion à la surface** : retirer le nom d'émotion sous les glyphes (modale Prismes), la valeur « Teinte dominante = nom d'émotion » (Lien), le libellé au survol (Constellation), la teinte de carte indexée sur l'émotion (Fragments), et la « Lecture croisée Affects/Prismes » explicite (Affect). Laisser le glyphe/texture parler ; l'utilisateur relie seul. | C3 | **Critique** | Élevé (touche données + 6 écrans) | **P0** |
| **R2** | **Désarmer la mécanique de complétion** : supprimer « n/16 », l'icône-récompense *rainbow*, « déverrouiller le prisme », « Allez au bout des cinq étapes » ; reformuler `LockedBlock`/`LockedSection` (« Condition/Requis ») en *disponibilité par la profondeur* (« se précise à mesure que la réflexion sédimente »), sans score ni coche. | C4 | **Critique** | Moyen (copie + quelques composants) | **P0** |
| **R3** | **Solder la dette de tokens** : router tous les hex codés en dur vers les alias ; réconcilier le total de prismes (16 vs 10) ; corriger « Eclat »→« Éclat » ; reskinner l'Admin sur la charte (sortir `yellow/blue/emerald`). | C5 | Moyen | Moyen | **P1** |
| **R4** | **Arbitrer sobriété ↔ contraste (C9)** : relever taille minimale (proscrire `<11px` pour le texte porteur) et opacité des libellés essentiels, **sans** trahir la palette contemplative. *À décider, pas à trancher seul* — proposer 2 paliers (AA strict vs « AA sur l'essentiel, murmure préservé sur le décoratif »). | C9 | Élevé (inclusion) | Moyen | **P1** |
| **R5** | **Dé-cliniciser le lexique** : « Angoisses de structure »→« Tensions de fond » ; « Système de Défense »→« Manières de se protéger » ; « Polarité »→« Tendance » ; surveiller « clusters ». Garder « métabolisation/sédimentation » si revendiqués (annexe A4). | C1, C7 | Élevé | Faible (copie) | **P1** |
| **R6** | **Trancher tu/vous** (vouvoiement recommandé, dominant + accordé au registre) et l'appliquer partout ; relire toute la micro-copy contre la voix « tient l'espace ». | C7 | Moyen | Faible | **P1** |
| **R7** | **Rendre la provenance de l'Éclat lisible à la réception** : signature/typographie distincte de l'interlocuteur, mention de provenance hors `6px`. | C8 | Élevé | Faible | **P1** |
| **R8** | **Retirer le cadre funnel/surveillance de l'Admin** : ôter « Complètes/Complétion », « Prismes n/10 » par personne, « ID Client ». | C10 | Moyen | Faible | **P2** |
| **R9** | **Déquantifier le relationnel (Lien)** : retirer `%` + barres de sphère ; prégnance par moyen non métrique. | C4, C1 | Moyen | Moyen | **P2** |
| **R10** | **Alléger les écrans saturés** (Lien, Affect, Matrice) en paliers révélés, sur le modèle d'Élan. | C6 | Moyen | Élevé | **P2** |

Ordre de bataille : **R1 + R2** d'abord (elles seules referment l'essentiel de l'écart au §1) ; R3–R7 sont du resserrement à faible coût et fort rendement ; R8–R10 suivent.

---

## Annexe — Hypothèses sur l'intention produit (validation humaine requise)

**A1. Ordre des cinq temps vs onglets du Carnet.** J'ai supposé que la séquence *Matrice→Élan→Affect→Lien→Prisme* (§1) est le **parcours vivant** (le Chat, `step/5`), tandis que les onglets du Carnet (`Fragments·Lien·Affect / Élan·Matrice`) sont des **lentilles rétrospectives** à entrée libre. Si c'est juste, l'ordre permuté des onglets n'est pas une faute — mais alors « Prisme » comme *temps* n'a aucune surface dédiée (seulement la modale-collection). **À valider :** le Carnet doit-il rendre lisible la séquence, ou est-il assumé comme espace non séquentiel ?

**A2. Statut ontologique du prisme.** Le §1 dit « prismes ≠ émotions, lien découvert par l'utilisateur ». Le code dit « prisme = émotion débloquée ». **Deux lectures possibles** : (i) le prisme est une *forme* (le trapèze-lentille) qui *révèle* une émotion sans s'y réduire — auquel cause R1 consiste à cacher le nom ; (ii) le prisme *est* l'émotion et le §1 décrit seulement la *pédagogie* (ne pas la dire trop tôt). Selon la lecture, R1 va d'un simple masquage de label à une refonte du modèle de données. **Décision d'auteur indispensable avant d'implémenter R1.**

**A3. Le mot « soin » dans l'Éclat « La limite comme soin ».** Contenu humain assumé. Je n'ai **pas** proposé de le retirer (ce serait outrepasser §5 et censurer l'auteur). À trancher : usage revendiqué (la « limite comme soin de soi », pied de nez au cadre clinique) ou angle mort à éviter sur un produit « pas de soin » ?

**A4. Lexique « métabolisation / sédimentation ».** Traité comme *signature de voix* volontaire, donc conservé (hors « Angoisses/Défense » qui, eux, basculent dans le clinique). **À confirmer :** est-ce une identité lexicale à tenir, ou un jargon à alléger pour C6 ?

**A5. Lueur — générée ou écrite ?** L'UI ne dit pas si les Lueurs ont le même statut humain que les Éclats. J'ai supposé qu'au moins l'Éclat est humain (confirmé par l'Admin) ; le statut des Lueurs reste indéterminé et conditionne R7.

**A6. Couche commerciale** (« Mode Reconnaissance », « Soutenir »/PayPal, « ID Client »). Hors barème explicite ; signalée pour C1/C10 au titre du cadre transactionnel introduit dans un espace intime. À arbitrer indépendamment.
