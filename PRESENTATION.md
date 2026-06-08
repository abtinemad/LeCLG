# Le Collègue — Dossier de Présentation

## 1. Philosophie & Concept : "Mise en lien du vécu"

**Le Collègue** n'est pas un outil de productivité, une simple messagerie IA, ou un substitut thérapeutique. C'est un **espace de dégrisement**. 

Dans un monde saturé d'informations et d'immédiateté, l'application propose une pause réflexive pour transformer le vécu brut en une trace structurée. Elle s'appuie sur une approche clinique et phénoménologique où l'important n'est pas de "résoudre" un problème, mais de décomposer comment il s'articule dans la vie du sujet.

### Les 4 Piliers du Trajet :
1. **Dégel du vécu** : Sortir de l'urgence par la verbalisation.
2. **Diffraction** : Multiplier les angles de vue (soi, les autres, l'institution).
3. **Sédimentation** : Inscrire la réflexion dans la durée via le Carnet.
4. **Clarté** : Atteindre un équilibre stable (la "Reconnaissance").

---

## 2. Fonctionnalités Clefs

### L'Interface de Réflexion (Chat)
Un dialogue structuré en 5 étapes non-intrusives :
- **Situation** : Définition neutre du contexte.
- **Ressenti** : Contact avec la charge émotionnelle/sensorielle.
- **Demande** : Digestion et transformation du besoin.
- **Diffraction** : Exploration des regards extérieurs.
- **Équilibre** : Identification d'une direction ou d'un apaisement.

### La voix du collègue
Le collègue a une **voix** qu'on peut solliciter à tout moment : non pas pour donner des réponses, mais pour apporter des **éclairages** qui aident à rendre sa propre pensée plus claire.

Ces éclairages prennent la forme d'une **boîte de clarté** : un glossaire **contextuel** des « mots maison » de l'application. Le principe est la **divulgation progressive** — un terme n'apparaît que sur la page où il devient utile, jamais comme un mur de vocabulaire d'emblée. Chaque page a son intro (« ce qu'on fait ici », clair d'abord) et ne fait surgir que les concepts pertinents.

Chaque concept se lit à **deux niveaux** : une **formule courte** (le sens en une ligne) puis une **définition** plus complète. La boîte couvre tout le vocabulaire du produit — *Le Collègue, la conversation, le Fragment, le Déplacement, la Direction, les Prismes, les Sphères, le Carnet et ses couches (Lien, Affect, Élan, Matrice), les Songes, les Lueurs, l'Éclat, la Texture relationnelle* — chacun défini une seule fois, de façon canonique.

### Le Carnet
Le Carnet est le **miroir individuel** : ce que la personne dépose, garde et relit. Chaque session s'y clôt par une **Carte de Réflexion** qui condense le trajet — le **Fragment** déposé, la **Sphère de vie** concernée et l'**émotion dominante** (son Prisme). Chaque carte s'accompagne d'une **Texture Relationnelle** : une image abstraite unique qui rend l'ambiance de la session.

Le Carnet ne s'empile pas comme une liste : il s'explore par **plusieurs lentilles**, chacune un angle de lecture différent sur le même matériau (ces analyses sont générées par l'IA — voir la partie technique). Le Climat communautaire reprend d'ailleurs leurs couleurs.

- **Fragments** *(vert)* — les cartes elles-mêmes, déposées session après session : la matière brute du Carnet.
- **Lien** *(terracotta)* — une lecture des **relations** : ce qui se joue avec les autres au fil des dépôts.
- **Affect** *(ardoise)* — une lecture du **paysage émotionnel** : les teintes qui reviennent, celles qui s'estompent.
- **Élan** *(blanc)* — une lecture de la **trajectoire** : ce qui se met en mouvement, vers quoi cela tend.
- **Matrice** *(mauve)* — la **mémoire de résonance** : les patterns qui se répètent d'une session à l'autre. L'application apprend à « connaître » la personne au fil du temps **sans jamais lever l'anonymat** (voir la partie technique).
- **Lueurs** *(lumière)* — les **éclaircies** : les moments où quelque chose s'allège ou s'éclaire.

### Les Prismes
Un **Prisme** décompose ce qu'on vit en **nuances** lisibles — comme un prisme sépare la lumière en couleurs. On en déverrouille un en menant une conversation **jusqu'au bout de ses cinq étapes** : le signe qu'une émotion a été traversée avec lucidité. Il permet alors de **décrypter** cette émotion, en soi comme chez l'autre.

Le vocabulaire affectif couvre **16 émotions** (palette type Plutchik) réparties sur **4 sphères de vie** : familiale, sociale, amoureuse, professionnelle. Les Prismes sont aussi la clé de lecture du Climat : tant qu'on n'a pas traversé une émotion, son nom y reste chiffré.

**L'harmonie** : savoir lire les émotions, les accueillir et les rendre sans les déformer — en soi comme chez l'autre — pour que l'émotion **relie** au lieu de diviser.

### Le Climat — La résonance collective
Le **Climat** est le pendant communautaire du Carnet : un miroir **anonyme et agrégé** de la météo affective de tous les membres. Là où le Carnet rend le sujet à lui-même, le Climat lui dit qu'il n'est pas seul. Aucun contenu de conversation n'y entre — uniquement la **métadonnée** extraite des cartes de réflexion (l'émotion dominante, la sphère, l'horodatage), agrégée sans jamais pouvoir être reliée à une personne.

**Le principe : décrypter, pas surveiller.** Les couleurs sont toujours visibles, mais les **noms** des émotions restent chiffrés (grésillés) tant que l'utilisateur n'a pas débloqué le **Prisme** correspondant — à l'exception de l'émotion dominante du collectif, toujours lisible comme point d'ancrage. C'est la posture phénoménologique rendue littérale : on ne *lit* que ce qu'on a soi-même traversé en conscience. Le Climat déplace la lumière, il ne nomme pas à la place du sujet. Le Climat ne se cristallise qu'à partir de **3 sessions distinctes** ; en deçà, il affiche « Climat en formation ».

**Le pipeline (anonyme).** La route `GET /api/climate` lit la table `sessions`, déchiffre chaque carte côté serveur et ne renvoie que des comptages agrégés : tally par émotion, par sphère, le croisement **émotion × sphère**, et une **timeline hebdomadaire** (bucketée via `started_at`). Aucune donnée individuelle ne transite ; le front ne reçoit jamais qu'un nuage agrégé.

Le Climat se lit en **deux onglets**, qui reprennent le miroir de l'individu (les sections empruntent les couleurs des onglets du Carnet) :

**Onglet « Maintenant » — le climat à l'instant** (couleurs des onglets primaires) :
- **Résonance commune** — l'émotion qui prédomine et fait écho au plus de monde, affichée en grand et teintée. Le cœur du « tu n'es pas seul ».
- **Relevé des courants** *(vert / Fragments)* — les 16 émotions classées par présence, du plus dense au plus ténu.
- **Rose des vents** *(terracotta / Lien)* — un radar à 16 axes dont le remplissage radial **fond les pigments des émotions dominantes** en une seule teinte : la couleur d'ensemble du climat, fonction de l'intensité et de la diversité des émotions qui le traversent.
- **Mouvement d'ensemble** *(ardoise / Affect)* — trois souffles : **Rafales** (ce qui souffle fort), **Dépressions** (ce qui se creuse), **Brises** (ce qui effleure). Le climat ne se comprend qu'en entier : pas seulement ce qui gronde, mais aussi ce qui murmure et ce qui manque.

**Onglet « Variations » — le climat en profondeur** (couleurs des onglets profonds Élan & Matrice) :
- **Saisons** *(blanc / Élan)* — comment l'humeur de la communauté se déplace, semaine après semaine : un ruban d'une barre par semaine, la couleur donnant la dominante de la semaine, la hauteur l'activité, et le nom de la dominante inscrit dans la barre (chiffré selon les Prismes débloqués).
- **Microclimat** *(mauve / Matrice)* — comment chaque sphère de vie (familiale, sociale, amoureuse, professionnelle) est vécue par la communauté : une carte par sphère, montrant ses émotions dominantes.

**Ce que le Climat ne fait pas (par choix).** Aucune cartographie d'un individu — l'anonymat l'interdit — ni score, ni mesure clinique. La population est auto-sélectionnée, et la grille de 16 émotions reste une lentille, pas le territoire. La mesure du *déplacement* affectif d'une conversation (état d'entrée → état de sortie, c.-à-d. l'efficacité du robot) est un chantier distinct, volontairement tenu à l'écart du Climat.

### L'Épicentre — le climat d'un cercle privé
Là où le Climat est la résonance de **toute** la communauté, l'**Épicentre** en restreint la lecture à un **cercle choisi** : une famille, des proches, une équipe. Mêmes onglets, même posture (*décrypter, pas surveiller*), mais le miroir ne reflète plus que les membres de ce cercle — tout en restant **anonyme** : personne n'y voit ce que chacun dépose, seulement la météo d'ensemble.

**Rejoindre, sans code à taper.** Un cercle se partage par **QR** (ou son lien). Le créateur le **nomme** au moment de générer le QR et en devient d'office le premier membre. Pour rejoindre, on scanne — le jeton voyage dans le **fragment d'URL**, jamais envoyé au serveur. On peut appartenir à **plusieurs cercles** et basculer de l'un à l'autre ; « se délier » d'un cercle est immédiat et le nom du cercle survit au départ de son créateur.

**Une clé d'abord — et un canal d'arrivée.** On ne rejoint pas sans avoir sa propre clé : condition d'entrée vérifiée côté client **et** côté serveur. Un scan effectué sans clé n'est pas perdu — il devient un **canal d'acquisition** : la personne est conduite vers la création de sa clé, puis la jonction se fait **automatiquement** une fois la clé en main. Le QR d'un proche peut ainsi faire entrer un nouveau venu dans l'application.

**Le pipeline (étanche).** Une table d'appartenance dédiée (`epicentre_members`) relie des clés à un code de cercle ; elle n'est **pas** exposée au chemin de lecture générique. Seuls des handlers serveur gardés par la vérification clé + code peuvent créer, rejoindre, quitter, lister ou lire le climat d'un cercle — impossible donc d'énumérer les membres ou de lire un climat sans en faire partie. Le climat d'un cercle réutilise **exactement** la même agrégation anonyme que le Climat global (mêmes onglets, même rendu), appliquée au seul sous-ensemble de ses membres.

**Ce que l'Épicentre ne fait pas (par choix).** Toujours pas de cartographie d'un individu ni de score : même à petit effectif, on garde la granularité sans jamais relier une teinte à une personne. Le nom du cercle est la seule métadonnée ajoutée ; rien du contenu des conversations n'y entre.

---

## 3. Présentation Technique

### Architecture Stack
- **Frontend** : React 19, Vite 6, TypeScript, Tailwind v4, Motion (React) pour les animations, Recharts pour les visualisations du Climat. Livré en **PWA installable** (mode standalone, service worker).
- **Backend** : un **proxy Express** (`server.ts`) et un **Cloudflare Worker** (`worker.js`) qui porte le dialogue du collègue et l'évaluation des étapes ; le tout hébergé sur **Google Cloud Run**.
- **IA** : architecture hybride — **Claude (Anthropic)** pour le dialogue du collègue et l'évaluation des cinq étapes ; un modèle **Gemini (Google)** pour les analyses du Carnet/Matrice, les cartes de réflexion et la génération de contenu poétique.
- **Persistance** : LocalStorage pour l'état immédiat de session ; **Supabase** pour le Carnet (cartes extraites, analyses, prismes), avec chiffrement **AES-256-GCM** au repos. Le code à 6 chiffres étant obligatoire dès l'onboarding, le Carnet est rattaché à une clé dès la première session et la continuité multi-appareils est native (transfert par **QR code**). Les conversations elles-mêmes ne sont jamais persistées (garantie au niveau base : la colonne `messages` de `sessions` est contrainte à rester vide) — seule la structure extraite est stockée.
- **Qualité** : tests automatisés (Vitest) sur les fonctions de sécurité, intégration continue via GitHub Actions.

### Schéma de Données : La Matrice
La Matrice est le cœur métacognitif de l'app. Elle synthétise le trajet long :
- **Angoisses** : Identification des points de tension récurrents (Intensité + Manifestations).
- **Valeurs** : Cartographie de ce qui fait "nord" pour le sujet.
- **Défenses** : Analyse des mécanismes protecteurs (Déclencheurs + Direction).
- **Schéma Central** : Synthèse profonde du pattern dominant.
- **Lueurs** : Fragments de sagesse générés mensuellement en fonction de l'évolution du trajet.

### Suivi Inter-Session (Mémoire de Résonance)
Le système est conçu pour une continuité sans intrusion :
- **Clé de Reconnaissance** : une clé unique et mémorisable — une **phrase de passe de cinq mots** (diceware français, ~57 bits d'entropie ; ex. `vrai-chemin-clair-doux-sable`) — servant d'identifiant sans lien avec une identité réelle, complétée par un **code à 6 chiffres** choisi par l'utilisateur et obligatoire dès l'arrivée (aucune conversation ne démarre sans lui).
- **Réinjection de Contexte** : Lors d'une nouvelle session, l'IA "réactive" les fragments des sessions passées pour proposer des mises en lien, créant un sentiment de trajet suivi et de profondeur clinique.

### Anonymat & Confidentialité : Un Engagement Total
L'anonymat n'est pas une option, c'est le socle du projet :
- **Sans Compte** : Aucune adresse email, aucun nom, aucune donnée personnelle (PII) n'est demandée.
- **Sans Tracé Publicitaire** : Aucun tracker tiers.
- **Soumission Éphémère** : Les conversations elles-mêmes ne sont pas persistées sur nos serveurs. Seule la structure extraite (la carte de réflexion) est stockée pour nourrir le Carnet de l'utilisateur.
- **Clé d'accès** : La clé identifie le Carnet, complétée par un code à 6 chiffres choisi par l'utilisateur. Les deux sont nécessaires pour accéder aux données, et le code est vérifié côté serveur (comparaison à **temps constant**, verrou **anti-force-brute**, et **liste blanche** stricte des paramètres de lecture). Les données sensibles sont en outre chiffrées au repos : une fuite de la base de données ne révélerait que du contenu illisible. (À noter : l'exploitant du service peut techniquement déchiffrer les données côté serveur — le chiffrement protège contre un accès à la base, pas contre l'opérateur lui-même.)

---

## 4. Conclusion
"Le Collègue" réinvente la relation homme-machine non pas comme une assistance à la tâche, mais comme un **miroir de structure**. C'est une technologie qui s'efface au profit de la pensée de l'utilisateur, garantissant un espace de liberté et de confidentialité pour explorer la complexité du vécu.