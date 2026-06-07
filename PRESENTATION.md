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

### Le Serpentin (Guide Visuel)
Le guide n'est pas une icône statique, c'est un flux vivant qui réagit en temps réel à l'intensité de l'échange. Il change d'amplitude, de couleur et de rythme selon l'alliance thérapeutique et la charge émotionnelle détectée par l'IA.

### Le Carnet & Les Prismes
Chaque session se clôture par une **Carte de Réflexion** (Fragment, Déplacement, Direction, Sphère). 
- **Les Prismes** : 10 signaux affectifs (Joie, Tristesse, Colère, etc.) qui servent de boussole pour cartographier le paysage intérieur.
- **Textures Relationnelles** : Génération d'images abstraites uniques illustrant l'ambiance de chaque session.

### La Matrice & La Mémoire de Résonance
L'application apprend à "connaître" les patterns du sujet au fil des sessions sans jamais lever l'anonymat (voir section technique).

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

---

## 3. Présentation Technique

### Architecture Stack
- **Frontend** : React 19, Vite, Tailwind CSS, Motion (React) pour les animations.
- **Backend** : Node.js (Express) agissant comme proxy sécurisé.
- **IA** : architecture hybride — Claude (Anthropic) pour le dialogue du collègue et l'évaluation des étapes ; Gemini 3.5 Flash (Google) pour les analyses du Carnet/Matrice, les cartes de réflexion et la génération de contenu poétique.
- **Persistance** : LocalStorage pour l'état immédiat de session, Supabase pour le Carnet (cartes extraites, analyses, prismes). Le code à 6 chiffres étant obligatoire dès l'onboarding, le Carnet est rattaché à une clé dès la première session et la continuité multi-appareils est native. Les conversations elles-mêmes ne sont jamais persistées (garantie au niveau base : la colonne `messages` de `sessions` est contrainte à rester vide) — seule la structure extraite est stockée.

### Schéma de Données : La Matrice
La Matrice est le cœur métacognitif de l'app. Elle synthétise le trajet long :
- **Angoisses** : Identification des points de tension récurrents (Intensité + Manifestations).
- **Valeurs** : Cartographie de ce qui fait "nord" pour le sujet.
- **Défenses** : Analyse des mécanismes protecteurs (Déclencheurs + Direction).
- **Schéma Central** : Synthèse profonde du pattern dominant.
- **Lueurs** : Fragments de sagesse générés mensuellement en fonction de l'évolution du trajet.

### Suivi Inter-Session (Mémoire de Résonance)
Le système est conçu pour une continuité sans intrusion :
- **Clé de Reconnaissance** : Une clé unique et mémorisable (ex: `vrai-chemin-234`) servant d'identifiant sans lien avec une identité réelle, complétée par un **code à 6 chiffres** choisi par l'utilisateur et obligatoire dès l'arrivée (aucune conversation ne démarre sans lui).
- **Réinjection de Contexte** : Lors d'une nouvelle session, l'IA "réactive" les fragments des sessions passées pour proposer des mises en lien, créant un sentiment de trajet suivi et de profondeur clinique.

### Anonymat & Confidentialité : Un Engagement Total
L'anonymat n'est pas une option, c'est le socle du projet :
- **Sans Compte** : Aucune adresse email, aucun nom, aucune donnée personnelle (PII) n'est demandée.
- **Sans Tracé Publicitaire** : Aucun tracker tiers.
- **Soumission Éphémère** : Les conversations elles-mêmes ne sont pas persistées sur nos serveurs. Seule la structure extraite (la carte de réflexion) est stockée pour nourrir le Carnet de l'utilisateur.
- **Clé d'accès** : La clé identifie le Carnet, complétée par un code à 6 chiffres choisi par l'utilisateur. Les deux sont nécessaires pour accéder aux données, et le code est vérifié côté serveur (avec verrou anti-force-brute). Les données sensibles sont en outre chiffrées au repos : une fuite de la base de données ne révélerait que du contenu illisible. (À noter : l'exploitant du service peut techniquement déchiffrer les données côté serveur — le chiffrement protège contre un accès à la base, pas contre l'opérateur lui-même.)

---

## 4. Conclusion
"Le Collègue" réinvente la relation homme-machine non pas comme une assistance à la tâche, mais comme un **miroir de structure**. C'est une technologie qui s'efface au profit de la pensée de l'utilisateur, garantissant un espace de liberté et de confidentialité pour explorer la complexité du vécu.