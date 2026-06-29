// Constantes partagées du sélecteur d'état du jour (day-picker) de l'accueil
// Chat. Déplacées VERBATIM depuis src/pages/Chat.tsx (refactor pur — extraction
// du day-picker). Chat.tsx ré-importe DAY_STATES pour startSessionFlow.

// Regroupement des pastilles par registre, pour aérer le sélecteur (chunking).
// « rien » reste à part, en bas.
export const DAY_GROUPS: string[][] = [
  ["penser", "flou", "pastrop", "autre"], // ouvert / à tâtons
  ["marre", "coince", "boucle", "comptes"], // à chaud / ça pousse
  ["emballe", "eclaire"], // élan / éclaircie
];
export const DAY_STATES: { key: string; label: string; opener: string }[] = [
  {
    key: "penser",
    label: "juste un truc banal",
    opener:
      "Bonjour. Un truc banal, alors — et c'est souvent là que ça se loge. Pas besoin que ce soit grave pour qu'on le pose. Dites-le comme il vient ; on regardera, sans en faire trop.",
  },
  {
    key: "marre",
    label: "y'en a marre",
    opener:
      "Bonjour. Il y a un ras-le-bol, quelque chose qui a assez duré. On ne cherchera pas à le faire taire — il dit souvent quelque chose de juste. Posez-le ici, et regardons ce qui, au fond, n'en peut plus.",
  },
  {
    key: "eclaire",
    label: "ça s'éclaire",
    opener:
      "Bonjour. Quelque chose s'éclaire — le bruit est retombé, il y a de la place. C'est souvent là qu'on voit le mieux. Dites ce qui apparaît dans cette éclaircie ; on peut aussi penser le clair, pas seulement le trouble.",
  },
  {
    key: "coince",
    label: "ça coince",
    opener:
      "Bonjour. Quelque chose coince — un endroit où ça n'avance plus. On n'est pas obligés de le débloquer tout de suite ; parfois il suffit de regarder où, exactement, ça résiste. Posez-le ici, et on verra ce qui s'y joue.",
  },
  {
    key: "emballe",
    label: "ça m'emballe",
    opener:
      "Bonjour. Quelque chose vous emballe — il y a de l'élan, ça pousse en avant. On n'est pas là pour le refroidir, plutôt pour voir vers quoi ça vous tire. Posez ce qui vous anime, et regardons-le de plus près.",
  },
  {
    key: "boucle",
    label: "ça tourne en boucle",
    opener:
      "Bonjour. Quelque chose tourne, et ça ne s'arrête pas. Une pensée qui repasse a souvent un nœud à montrer, pas seulement à fatiguer. On n'est pas obligés d'en sortir tout de suite — posez-la ici, telle qu'elle tourne, et on regardera autour de quoi elle gravite.",
  },
  {
    key: "comptes",
    label: "régler mes comptes",
    opener:
      "Allez-y — videz votre sac, sans le filtrer. Je ne vais pas vous faire la leçon, et je ne m'effondre pas. Dites ce que vous avez à dire ; on verra après.",
  },
  {
    key: "flou",
    label: "c'est flou",
    opener:
      "Bonjour. Quelque chose est là sans être net. C'est un très bon point de départ. Dites-le flou ; le flou se laisse penser, lui aussi.",
  },
  {
    key: "pastrop",
    label: "ça va pas trop",
    opener:
      "Bonjour. Ça ne va pas trop, et c'est déjà bien de le poser là sans avoir à l'expliquer. Pas besoin de mettre un mot juste tout de suite. Dites ce qui se présente en premier, même petit — on avancera doucement à partir de là.",
  },
  {
    key: "autre",
    label: "…c'est autre chose",
    opener:
      "Bonjour. Pas besoin de savoir d'où vous arrivez. Posez-vous un instant, et dites ce qui vient en premier — on cheminera à partir de là.",
  },
  {
    key: "rien",
    label: "non rien",
    opener:
      "Bonjour. Rien, alors — et c'est peut-être ce qui en dit le plus. Le silence n'est pas un vide, c'est une profondeur qui attend qu'on l'écoute. On ne va rien forcer. Restez là un instant ; et s'il vient quelque chose, même un mot, même de travers, posez-le — on n'est pas pressés.",
  },
];
// Effet visuel par pastille — éteint au repos, révélé au survol/focus (desktop)
// ou par rotation lente une-à-la-fois (tactile). « autre » n'a pas de classe
// bouton : son égrènement est géré par le rendu enfant.
export const FX_CLASS: Record<string, string> = {
  comptes: "braise-comptes",
  rien: "non-rien-neon",
  boucle: "boucle-run",
  flou: "flou-vacille",
  eclaire: "eclaire-fx",
  emballe: "emballe-fx",
  pastrop: "pastrop-fx",
  coince: "coince-fx",
  marre: "marre-vibre",
  penser: "penser-fx",
};
// Durée pendant laquelle la pastille choisie continue son animation (les autres
// figées) avant l'ouverture du chat.
export const FOCUS_MS = 2200;
