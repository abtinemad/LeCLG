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
- **Diffraction** : Exploration des regards extérieurs.
- **Demande** : Digestion et transformation du besoin.
- **Équilibre** : Identification d'une direction ou d'un apaisement.

### Le Serpentin (Guide Visuel)
Le guide n'est pas une icône statique, c'est un flux vivant qui réagit en temps réel à l'intensité de l'échange. Il change d'amplitude, de couleur et de rythme selon l'alliance thérapeutique et la charge émotionnelle détectée par l'IA.

### Le Carnet & Les Prismes
Chaque session se clôture par une **Carte de Réflexion** (Fragment, Déplacement, Direction, Sphère). 
- **Les Prismes** : 10 signaux affectifs (Joie, Tristesse, Colère, etc.) qui servent de boussole pour cartographier le paysage intérieur.
- **Textures Relationnelles** : Génération d'images abstraites uniques illustrant l'ambiance de chaque session.

### La Matrice & La Mémoire de Résonance
L'application apprend à "connaître" les patterns du sujet au fil des sessions sans jamais lever l'anonymat (voir section technique).

---

## 3. Présentation Technique

### Architecture Stack
- **Frontend** : React 18, Vite, Tailwind CSS, Motion (React) pour les animations.
- **Backend** : Node.js (Express) agissant comme proxy sécurisé.
- **IA** : Gemini 3 Flash (Google) pour l'analyse sémantique, l'évaluation structurelle et la génération de contenu poétique.
- **Persistance** : Hybride LocalStorage (immédiat) et Supabase (optionnel, pour la continuité multi-appareils).

### Schéma de Données : La Matrice
La Matrice est le cœur métacognitif de l'app. Elle synthétise le trajet long :
- **Angoisses** : Identification des points de tension récurrents (Intensité + Manifestations).
- **Valeurs** : Cartographie de ce qui fait "nord" pour le sujet.
- **Défenses** : Analyse des mécanismes protecteurs (Déclencheurs + Direction).
- **Schéma Central** : Synthèse profonde du pattern dominant.
- **Lueurs** : Fragments de sagesse générés mensuellement en fonction de l'évolution du trajet.

### Suivi Inter-Session (Mémoire de Résonance)
Le système est conçu pour une continuité sans intrusion :
- **Clé de Reconnaissance** : Une clé unique (ex: `vrai-chemin-234`) générée à l'ouverture, servant d'identifiant unique sans lien avec une identité réelle.
- **Réinjection de Contexte** : Lors d'une nouvelle session, l'IA "réactive" les fragments des sessions passées pour proposer des mises en lien, créant un sentiment de trajet suivi et de profondeur clinique.

### Anonymat & Confidentialité : Un Engagement Total
L'anonymat n'est pas une option, c'est le socle du projet :
- **Sans Compte** : Aucune adresse email, aucun nom, aucune donnée personnelle (PII) n'est demandée.
- **Sans Tracé Publicitaire** : Aucun tracker tiers.
- **Soumission Éphémère** : Les conversations elles-mêmes ne sont pas persistées sur nos serveurs. Seule la structure extraite (la carte de réflexion) est stockée pour nourrir le Carnet de l'utilisateur.
- **Clé privative** : L'accès aux données cloud est protégé par la clé que seul l'utilisateur possède.

---

## 4. Conclusion
"Le Collègue" réinvente la relation homme-machine non pas comme une assistance à la tâche, mais comme un **miroir de structure**. C'est une technologie qui s'efface au profit de la pensée de l'utilisateur, garantissant un espace de liberté totale et de sécurité absolue pour explorer la complexité du vécu.
