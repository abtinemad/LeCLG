/**
 * Socle de Clarté — source de vérité unique du vocabulaire de l'application.
 *
 * Ce fichier ne contient AUCUNE logique et ne fait AUCUN appel d'API.
 * Ce sont des faits fixes : ce qu'est un fragment, à quoi sert le Carnet, etc.
 * Ces choses ne changent jamais → elles n'ont pas à être générées par un modèle.
 *
 * Conséquences voulues :
 *  - fiable    : la même explication, juste, à chaque fois (fini le « n'importe quoi »)
 *  - gratuit   : zéro token consommé
 *  - instantané: aucun aller-retour réseau
 *  - tien      : tu écris la voix du Serpentin toi-même, tu la contrôles
 *
 * Voix : le Serpentin de Clarté. Sobre, claire d'abord, poétique ensuite.
 * La poésie ne doit jamais coûter la compréhension d'un nouveau venu.
 *
 * Ce module sert deux usages :
 *  1. l'affichage statique des aides (guide par page + glossaire contextuel) ;
 *  2. si un jour tu veux un vrai « pose ta question à Clarté », CONCEPTS est
 *     la base de connaissance à injecter telle quelle dans le prompt — pour
 *     que le modèle cite la vérité au lieu de l'inventer.
 */

export interface Concept {
  /** Le terme tel qu'il s'affiche. */
  terme: string;
  /** Une seule ligne : la définition minimale (idéale pour une infobulle). */
  gloss: string;
  /** 2 à 4 phrases : l'explication complète. */
  definition: string;
}

/**
 * Glossaire canonique. Chaque mot maison de l'application, défini une fois.
 * Clé = identifiant stable (à ne pas traduire) ; `terme` = libellé affiché.
 */
export const CONCEPTS: Record<string, Concept> = {
  collegue: {
    terme: "Le Collègue",
    gloss: "L'application elle-même : un espace pour mettre en lien ce que tu vis.",
    definition:
      "Le Collègue n'est ni un outil de productivité, ni un journal intime. C'est un espace pour y voir plus clair : il aide à transformer un vécu brut, encore confus, en une trace réfléchie. On n'y vient pas pour faire — on y vient pour voir.",
  },

  serpentin: {
    terme: "Le Serpentin",
    gloss: "La présence qui t'accompagne — moi. Un guide, pas un assistant.",
    definition:
      "Je suis le Serpentin : une forme fluide qui suit ta pensée sans la brusquer ni la presser. Je ne te donne pas de réponses ; je t'aide à rendre les tiennes plus claires. Quand une aide signée « Clarté » s'adresse à toi, c'est moi qui parle.",
  },

  session: {
    terme: "La conversation",
    gloss: "Un échange avec le Collègue, en cinq étapes, qui se referme sur un fragment.",
    definition:
      "Une conversation se déroule en cinq étapes : on part de ce que tu amènes, et on avance jusqu'à ce qu'une forme se dégage. Elle se referme alors d'elle-même — par un dernier reflet — et dépose un fragment dans ton Carnet. Trois conversations par jour au plus : ce qui a émergé a besoin de temps pour travailler en toi.",
  },

  fragment: {
    terme: "Le Fragment",
    gloss: "La trace laissée par une conversation : une carte déposée dans le Carnet.",
    definition:
      "Chaque conversation laisse un fragment : une carte qui retient l'essentiel de ce qui s'est dit et déplacé. Ce n'est pas un résumé, c'est un éclat de vécu réfléchi. Les fragments s'accumulent et, ensemble, finissent par dessiner quelque chose.",
  },

  deplacement: {
    terme: "Le Déplacement",
    gloss: "Ce qui a bougé en toi pendant la conversation.",
    definition:
      "Sur un fragment, le déplacement nomme ce qui s'est mis en mouvement : un point de vue qui a glissé, une tension qui s'est desserrée, une chose vue autrement. C'est la trace du trajet — pas du point de départ.",
  },

  direction: {
    terme: "La Direction",
    gloss: "Ce vers quoi un fragment tend, une fois la conversation refermée.",
    definition:
      "La direction n'est ni une consigne, ni un objectif à atteindre. C'est l'orientation que ta réflexion a prise : vers quoi elle penche, ce qu'elle laisse entrevoir. Une boussole, pas une carte.",
  },

  prisme: {
    terme: "Les Prismes",
    gloss: "Dix émotions primitives qui servent de signaux pour s'orienter.",
    definition:
      "Les Prismes sont dix émotions primitives : Joie, Tristesse, Colère, Peur, Confiance, Dégoût, Anticipation, Surprise, Honte, Mélancolie. Ce ne sont pas des émotions à corriger — ce sont des signaux : une émotion qui indique dans quelle direction regarder. Tu les découvres peu à peu, au fil de tes conversations.",
  },

  sphere: {
    terme: "Les Sphères",
    gloss: "Les quatre domaines de vie où une émotion prend racine.",
    definition:
      "Quatre sphères situent l'origine de ce que tu ressens : Familiale, Sociale, Amoureuse, Professionnelle. Elles permettent de voir d'où vient un affect — et comment un même fil traverse parfois plusieurs domaines à la fois.",
  },

  carnet: {
    terme: "Le Carnet",
    gloss: "Le lieu où tes fragments se déposent et se relisent à plusieurs niveaux.",
    definition:
      "Le Carnet est le lieu de sédimentation : tes fragments s'y déposent, et le temps les fait parler. Il se lit par couches — Fragments, Lien, Affect, Élan, Matrice — chacune extrayant un niveau de sens différent. Le Carnet reste ouvert même les jours où tu ne converses pas.",
  },

  lien: {
    terme: "Le Lien",
    gloss: "La couche du Carnet qui range tes fragments par sphère de vie.",
    definition:
      "Le Lien sédimente tes fragments par sphère — Familiale, Sociale, Amoureuse, Professionnelle. Pour chacune, il dégage une teinte dominante et une intensité, puis un relief d'ensemble : la structure, d'abord invisible, de la façon dont ton vécu circule en ce moment.",
  },

  affect: {
    terme: "L'Affect",
    gloss: "La couche du Carnet qui lit ce qui te porte, ce qui te freine, ce qui émerge.",
    definition:
      "L'Affect lit le courant sous tes émotions : ce qui te met en mouvement, ce qui te retient, ce qui commence à poindre. Là où un Prisme est un signal ponctuel, l'Affect en lit la dynamique sur la durée.",
  },

  elan: {
    terme: "L'Élan",
    gloss: "La couche du Carnet qui lit la trajectoire : d'où ça vient, vers quoi ça va.",
    definition:
      "L'Élan lit le mouvement d'ensemble de ta pratique : sa dynamique, la direction qu'elle prend, et la question encore en suspens qui te travaille. C'est la couche du temps long.",
  },

  matrice: {
    terme: "La Matrice",
    gloss: "La couche la plus profonde : la structure d'où vient tout le reste.",
    definition:
      "La Matrice est ce dont on vient — la structure de fond qui revient sous le reste. Elle nomme ce qui te travaille de façon récurrente, ce qui compte pour toi, ce qui te protège, et le fil qui les relie. C'est la couche la plus lente à se former : elle a besoin de matière avant de dire quelque chose de juste.",
  },

  songe: {
    terme: "Les Songes",
    gloss: "Une note que tu écris toi-même à côté d'un fragment.",
    definition:
      "Un songe est ta propre annotation : ce que tu ajoutes, après coup, à côté d'un fragment. Il peut le confirmer, le prolonger, ou partir ailleurs. Les Songes sont ta voix dans le Carnet, à côté de celle du Collègue.",
  },

  lueur: {
    terme: "Les Lueurs",
    gloss: "Une reconnaissance, après un mois de pratique : une chose qui s'est solidifiée en toi.",
    definition:
      "Une Lueur n'est ni un résumé, ni un conseil, ni une analyse. C'est une reconnaissance : après un mois de pratique, je nomme une chose qui s'est solidifiée en toi sans que tu t'en aperçoives — une capacité, une façon d'être que ton matériau révèle.",
  },

  eclat: {
    terme: "L'Éclat",
    gloss: "Une lecture rare et profonde qui synthétise tout ton matériau accumulé.",
    definition:
      "L'Éclat est un acte ponctuel et rare : une lecture dense qui rassemble tout — fragments, Lien, Affect, Élan, Matrice, Lueurs — en une vision de structure. Ce n'est pas un conseil ; c'est un miroir tendu à l'ensemble du chemin parcouru.",
  },

  texture: {
    terme: "La Texture relationnelle",
    gloss: "La matière, la qualité du moment relationnel qu'un fragment retient.",
    definition:
      "Chaque fragment porte une texture : la matière de l'instant qu'il garde — rugueuse, fluide, tendue, légère. C'est moins ce qui s'est dit que la façon dont cela s'est vécu.",
  },
};

export interface SectionGuide {
  /** Titre court de l'aide affichée sur cette page. */
  titre: string;
  /** Ce qu'est cette page et ce qu'on y fait. Clair d'abord. */
  intro: string;
  /**
   * Clés de CONCEPTS pertinentes ici : permet d'afficher un glossaire
   * contextuel — n'introduire un mot que là où il devient utile
   * (divulgation progressive plutôt qu'un mur de vocabulaire d'emblée).
   */
  concepts: string[];
}

/**
 * Guide par page. Les clés correspondent aux valeurs de `section`
 * passées au composant ClarteSection (front-end).
 */
export const SECTION_GUIDE: Record<string, SectionGuide> = {
  landing: {
    titre: "Bienvenue",
    intro:
      "Le Collègue est un espace pour mettre en lien ce que tu vis. On ne vient pas y être performant : on vient regarder. Une conversation se déroule en cinq étapes courtes et se referme d'elle-même, en laissant une trace — un fragment — dans ton Carnet. Tu peux commencer maintenant : tout le reste se découvre en marchant.",
    concepts: ["collegue", "session", "fragment", "carnet"],
  },

  chat: {
    titre: "La conversation",
    intro:
      "Ici, on avance ensemble, en cinq étapes. Tu n'as rien à préparer : pars de ce qui est là, même flou. Je ne te donnerai pas de réponses — je t'aiderai à rendre les tiennes plus claires. Quand une forme se dégage, la conversation se referme d'elle-même et dépose un fragment dans ton Carnet. Trois conversations par jour : le reste du travail se fait en toi, entre deux.",
    concepts: ["session", "serpentin", "fragment", "deplacement", "direction", "prisme"],
  },

  "carnet-fragments": {
    titre: "Les Fragments",
    intro:
      "Chaque conversation a laissé ici une carte : un fragment. C'est la mémoire de tes traversées. Tu peux les relire et ajouter, à côté de chacun, un songe — ta propre note, écrite après coup. Cette page est la matière brute ; les autres couches du Carnet la font parler.",
    concepts: ["fragment", "deplacement", "direction", "texture", "songe", "prisme"],
  },

  "carnet-lien": {
    titre: "Le Lien",
    intro:
      "Cette couche range tes fragments par sphère de vie — Familiale, Sociale, Amoureuse, Professionnelle. Pour chacune, elle dégage une teinte et une intensité, puis un relief d'ensemble : la structure, d'abord invisible, de la façon dont ton vécu circule en ce moment. Le Lien a besoin de plusieurs fragments avant d'avoir quelque chose à dire.",
    concepts: ["lien", "sphere", "fragment"],
  },

  "carnet-affect": {
    titre: "L'Affect",
    intro:
      "Cette couche lit le courant sous tes émotions : ce qui te porte, ce qui te freine, ce qui commence à émerger. Là où un Prisme est un signal ponctuel, l'Affect en lit la dynamique sur la durée.",
    concepts: ["affect", "prisme", "fragment"],
  },

  "carnet-elan": {
    titre: "L'Élan",
    intro:
      "Cette couche lit la trajectoire d'ensemble : la dynamique de ta pratique, la direction qu'elle prend, et la question encore en suspens qui te travaille. C'est la couche du temps long — elle se précise à mesure que les fragments s'accumulent.",
    concepts: ["elan", "fragment", "direction"],
  },

  "carnet-matrice": {
    titre: "La Matrice",
    intro:
      "C'est la couche la plus profonde : la structure d'où vient le reste. Elle nomme ce qui te travaille de façon récurrente, ce qui compte pour toi, ce qui te protège, et le fil qui les relie. La Matrice est lente à se former — elle a besoin de beaucoup de matière avant de dire quelque chose de juste.",
    concepts: ["matrice", "lueur", "eclat"],
  },
};