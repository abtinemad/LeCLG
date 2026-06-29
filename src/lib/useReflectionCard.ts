import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import { API_BASE } from "./chat-helpers";
import { sbInsert, sbUpdate } from "./worker";

// Types repris VERBATIM du composant Chat (Role/Message/ReflectionCard locaux).
type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
  ts?: string;
}

interface ReflectionCard {
  id?: string;
  fragment: string;
  deplacement: string;
  deplacement_type?: string;
  direction: string;
  direction_type?: string;
  texture_relationnelle?: string;
  sphere?: string;
  emotion?: string;
  prisme?: string;
  date?: string;
  image_url?: string;
  miroir?: string;
}

type Deps = {
  streamChat: (
    payload: Message[],
    maxTokens: number,
    onChunk: (c: string) => void,
    noInjection?: boolean,
  ) => Promise<string>;
  messages: Message[];
  motsCles: string[];
  validatedSteps: Set<number>;
  personalId: string;
  currentSessionId: MutableRefObject<string | null>;
  setReflectionCard: Dispatch<SetStateAction<ReflectionCard | null>>;
  setCardStatus: Dispatch<
    SetStateAction<"idle" | "generating" | "done" | "failed">
  >;
};

// ── Carte de réflexion via Worker ─────────────────────────
export function useReflectionCard({
  streamChat,
  messages,
  motsCles,
  validatedSteps,
  personalId,
  currentSessionId,
  setReflectionCard,
  setCardStatus,
}: Deps) {
  const generateTexture = async (
    card: ReflectionCard,
    cardId: string,
    personalId: string | null,
  ) => {
    try {
      const res = await fetch(`${API_BASE}/generate-texture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prisme: card.emotion || card.prisme || "Neutre",
          sphere: card.sphere || "Sociale",
          texture: card.texture_relationnelle,
        }),
      });
      const data = await res.json();
      if (!data.imageUrl) return;

      // Persiste l'image dans la table `cartes` (ligne déjà insérée plus haut).
      if (personalId) {
        try {
          await sbUpdate("cartes", cardId, {
            image_url: data.imageUrl,
            personal_id: personalId,
          });
        } catch (e) {
          console.error("cartes image update failed", e);
        }
      }

      // Fait apparaître l'image sur la carte affichée, si c'est encore elle.
      setReflectionCard((prev) =>
        prev && prev.id === cardId
          ? { ...prev, image_url: data.imageUrl }
          : prev,
      );

      // Met à jour le stockage local.
      const local = JSON.parse(localStorage.getItem("collegue_cards") || "[]");
      const idx = local.findIndex((c: any) => c.id === cardId);
      if (idx !== -1) {
        local[idx] = { ...local[idx], image_url: data.imageUrl };
        localStorage.setItem("collegue_cards", JSON.stringify(local));
      }
    } catch (e) {
      console.error("Texture generation failed", e);
    }
  };

  const generateReflectionCard = async (convo?: Message[]) => {
    setCardStatus("generating");
    const realMessages = (convo ?? messages).filter((m, i) => {
      if (m.content === "Bonjour, j'ai une situation à vous soumettre.")
        return false;
      if (m.role === "assistant" && i <= 1) return false;
      return true;
    });
    // Une vraie conversation, même courte, mérite son fragment.
    // Un seul message de la personne suffit ; en deçà, c'est une
    // conversation ouverte puis refermée sans rien déposer.
    if (realMessages.filter((m) => m.role === "user").length < 1) {
      // Rien à déposer (conversation vide) : ce n'est pas un échec — on évite
      // le spinner éternel en marquant l'opération comme terminée.
      setCardStatus("done");
      return;
    }

    const summary = realMessages
      .slice(-30)
      .map(
        (m) => `${m.role === "user" ? "Personne" : "Collègue"} : ${m.content}`,
      )
      .join("\n")
      .slice(0, 5000);

    const motsSection =
      motsCles.length > 0
        ? `\n\nMots utilisés par la personne : ${motsCles.map((m) => `"${m}"`).join(", ")}. Le fragment doit résonner avec l'un d'eux si possible.`
        : "";

    const isEquilibreReached = validatedSteps.has(4);
    const prismeInstruction = isEquilibreReached
      ? `6. Une emotion : Le signal affectif dominant détecté. Choisis UNIQUEMENT parmi : "joie", "tristesse", "colere", "peur", "degout", "surprise", "confiance", "anticipation", "honte", "melancolie", "envie", "soulagement", "gratitude", "jalousie", "amour", "culpabilite".
7. Un prisme : Répète la même valeur que l'emotion ici, car l'état d'équilibre est atteint.`
      : `6. Une emotion : Le signal affectif dominant détecté. Choisis UNIQUEMENT parmi : "joie", "tristesse", "colere", "peur", "degout", "surprise", "confiance", "anticipation", "honte", "melancolie", "envie", "soulagement", "gratitude", "jalousie", "amour", "culpabilite".
7. Un prisme : Laisse ce champ vide ("") car l'état d'équilibre n'a pas été pleinement stabilisé.`;

    const prompt = `Voici la conversation qui vient de s'achever :
${summary}${motsSection}

Génère une "carte de réflexion" selon la philosophie de "Mise en lien du vécu".

Cette approche vise à ne pas expliquer ("pourquoi"), mais à déplier comment le vécu s'articule, se déplace et s'inscrit dans une dimension de vie.

Cinq éléments courts et denses :
1. Un fragment : un mot, une image ou une expression brute tirée directement des propos de la personne. Pas de reformulation propre. Doit être le point de pivot sensoriel de l'échange.
2. Un déplacement : ce qui a bougé ou ce qui a été décentré pendant l'échange. Une phrase sobre, sans jargon théorique.
3. Une direction : une petite fenêtre ouverte, une question ou une vigilance courte à emmener avec soi.
4. Une texture_relationnelle : Qualité de la rencontre (climat, rythme, engagement). 3-4 mots évocateurs.
5. Une sphere : La dimension de vie majoritairement porteuse de la réflexion. Choisis UNIQUEMENT parmi : "Familiale", "Sociale", "Amoureuse", "Professionnelle".
${prismeInstruction}
8. Un direction_type : la nature de la direction (élément 3), en un seul mot-clé. Choisis UNIQUEMENT parmi : "décision" (un choix d'agir s'est posé), "mise en pause" (attendre, ne pas trancher maintenant, de façon choisie), "acceptation" (accueillir quelque chose tel quel), "clarification" (y voir plus clair, une compréhension), "ouverture relationnelle" (aller vers l'autre, partager, demander), "vigilance" (un point d'attention à garder), "question ouverte" (une question à porter, sans réponse encore).
9. Un deplacement_type : la nature du GESTE intérieur survenu PENDANT l'échange (distinct de la direction — c'est ce qui a bougé en elle, pas ce qu'elle emporte). Choisis UNIQUEMENT parmi : "décentrement" (sortir de son seul point de vue), "nomination" (mettre un mot sur ce qui était flou), "mise à distance" (prendre du recul sur ce qui envahissait), "approfondissement" (descendre sous la surface d'un ressenti), "appropriation" (reconnaître sa propre part, sa marge d'action), "relâchement" (lâcher une tension, une exigence), "reliement" (relier ce qui semblait séparé). Si aucun ne s'applique clairement, laisse "" (vide).

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown :
{"fragment": "...", "deplacement": "...", "deplacement_type": "...", "direction": "...", "direction_type": "...", "texture_relationnelle": "...", "sphere": "...", "emotion": "...", "prisme": "..."}`;

    try {
      const res = await fetch(`${API_BASE}/reflection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const raw = (data.text || "{}").replace(/```json|```/g, "").trim();
      const card: ReflectionCard = JSON.parse(raw);

      // Ensure emotion is set from prisme if AI returned old format, and handle unlocking
      if (!card.emotion && card.prisme) card.emotion = card.prisme;
      if (!isEquilibreReached) {
        card.prisme = "";
      }

      if (card.fragment) {
        // Eval Emotion/Prisme - refine the emotion detected even if not unlocked
        try {
          const prismeRes = await fetch(`${API_BASE}/worker`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "eval_prisme", data: { card } }),
          });
          const prismeData = await prismeRes.json();
          if (prismeData.prisme) {
            card.emotion = prismeData.prisme;
            if (isEquilibreReached) {
              card.prisme = prismeData.prisme;
            }
          }
        } catch (e) {
          console.error("Prisme eval failed", e);
        }

        // Normalise prisme et émotion vers la forme canonique (clé de EMOTIONS :
        // minuscule, sans accent). La base stocke "colere", jamais "Colère".
        const canon = (v?: string) =>
          (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        card.emotion = canon(card.emotion);
        card.prisme = canon(card.prisme);

        // Identité et date de la carte
        const existingLocal = JSON.parse(
          localStorage.getItem("collegue_cards") || "[]",
        );
        const cardId = crypto.randomUUID();
        // Miroir RÉGÉNÉRÉ à partir des seuls champs distillés de la carte
        // (jamais la conversation) → respecte la règle « rien de ce qui se dit
        // n'est enregistré ». C'est une pensée du Collègue SUR le fragment,
        // relisible plus tard dans le Carnet. /!\ Texte = premier jet, à ta voix.
        let miroir = "";
        try {
          const miroirPrompt = `Voici un fragment déposé dans le Carnet d'une personne :
- Fragment : ${card.fragment}
- Déplacement : ${card.deplacement}
- Direction : ${card.direction}${card.texture_relationnelle ? `\n- Texture : ${card.texture_relationnelle}` : ""}

Écris un court miroir : une pensée que tu poses sur ce fragment, à relire plus tard. Fais surgir une image juste à partir de ces éléments, accueille ce qui s'est déplacé, et termine sur une ouverture — une phrase qui continue de travailler. Ne résume pas, ne donne aucun conseil, ne pose aucune question. Deux à quatre phrases.`;
          miroir = (
            (await streamChat(
              [{ role: "user", content: miroirPrompt }],
              400,
              () => {},
              true, // noInjection : aucune mémoire/contexte injecté
            )) || ""
          ).trim();
        } catch (e) {
          console.error("miroir gen failed", e);
        }

        const newCard = {
          ...card,
          id: cardId,
          date: new Date().toISOString(),
          ...(miroir ? { miroir } : {}),
        };

        setReflectionCard(newCard);
        setCardStatus("done");

        // Sauvegarde locale systématique
        localStorage.setItem(
          "collegue_cards",
          JSON.stringify([newCard, ...existingLocal]),
        );

        // Sauvegarder la carte en base (table dédiée 'cartes' comme demandé)
        if (personalId) {
          try {
            await sbInsert("cartes", { ...newCard, personal_id: personalId });
          } catch (e) {
            console.error("cartes insert failed", e);
          }
        }

        // Sauvegarder dans sessions pour compatibilité admin.
        // NB : `ended_at` n'est PAS posé ici. C'est `saveSession` (appelé juste
        // avant via startCardGeneration) qui en est l'unique source — sous la
        // règle d'engagement. Une carte ne s'obtient qu'au bout des 5 étapes,
        // donc la session a forcément dépassé le seuil : saveSession pose bien
        // `ended_at`. On évite ainsi deux sources de vérité contradictoires
        // pour le décompte du plafond quotidien.
        if (personalId && currentSessionId.current) {
          try {
            await sbUpdate("sessions", currentSessionId.current, {
              reflection_card: newCard,
              personal_id: personalId,
              step_reached: validatedSteps.size,
            });
          } catch (e) {
            console.error("session save failed", e);
          }
        }

        // IA générative d'images de "Texture" (Piste 6) — en arrière-plan.
        // La génération prend plusieurs secondes : on ne bloque pas la
        // création de la carte. L'image arrive ensuite et est enregistrée
        // dans `cartes`, puis affichée.
        generateTexture(newCard, cardId, personalId);
      }
    } catch (e) {
      console.error("carte failed", e);
      setCardStatus("failed");
    }
  };

  return generateReflectionCard;
}
