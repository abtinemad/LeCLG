import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { WORKER_URL, toWorkerMessages } from "./chat-helpers";

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

// Gestes intérieurs (deplacement_type) — vocabulaire fixe, ordonné par
// « pivotalité » : pour la lecture par l'absence, le geste manquant le plus
// parlant vient en premier. `hint` = formulation en mots simples de ce que
// serait l'invitation à ce geste (le bot ne reçoit jamais le mot « geste »
// brut, seulement cette tournure).
const DEPLACEMENT_GESTURES: { key: string; hint: string }[] = [
  { key: "décentrement", hint: "ce que la situation donnerait, vue depuis quelqu'un d'autre" },
  { key: "appropriation", hint: "ce qui, là-dedans, dépend encore d'elle" },
  { key: "approfondissement", hint: "descendre un cran plus bas dans ce qu'elle ressent" },
  { key: "nomination", hint: "mettre un mot sur ce qui reste flou" },
  { key: "mise à distance", hint: "prendre un pas de recul sur ce qui l'envahit" },
  { key: "reliement", hint: "relier ça à autre chose qu'elle connaît déjà" },
  { key: "relâchement", hint: "ce qu'elle pourrait lâcher, juste un peu" },
];

type Deps = {
  validatedSteps: Set<number>;
  motsCles: string[];
  activeResumeContext: string | null;
  pastReflections: ReflectionCard[];
  pastStepSets: number[][];
  projectionDetected: boolean;
  patternRecognized: boolean;
  alliance: number;
  recurringWords: string[];
  motifSurfaced: MutableRefObject<boolean>;
  stallSurfaced: MutableRefObject<boolean>;
  absenceSurfaced: MutableRefObject<boolean>;
};

// ── Streaming chat via Worker ─────────────────────────────
export function useStreamChat({
  validatedSteps,
  motsCles,
  activeResumeContext,
  pastReflections,
  pastStepSets,
  projectionDetected,
  patternRecognized,
  alliance,
  recurringWords,
  motifSurfaced,
  stallSurfaced,
  absenceSurfaced,
}: Deps) {
  return useCallback(
    async (
      payload: Message[],
      maxTokens: number,
      onChunk: (chunk: string) => void,
      noInjection = false,
    ): Promise<string> => {
      // Injection mémoire de résonance en phase Équilibre
      const inEquilibre = validatedSteps.size >= 4 && !validatedSteps.has(4);

      let contextNote = "";
      if (activeResumeContext) {
        contextNote += `${activeResumeContext} `;
      }

      if (!noInjection && inEquilibre && motsCles.length > 0) {
        contextNote += `Note interne (ne pas citer explicitement) : la personne a utilisé ces mots : ${motsCles.map((m) => `"${m}"`).join(", ")}. Réutilise l'un d'eux sobrement si l'occasion s'y prête. `;
      }

      // Au plus UN tissage longitudinal par tour (motif > stall > absence) :
      // trois signaux d'un coup surchargeraient la réponse et trahiraient le
      // « une touche ». Chacun reste par ailleurs « une fois par session ».
      let longitudinalFired = false;

      // Tissage longitudinal — GATED. Ne s'arme que si la personne a elle-même
      // reconnu un motif (reconnaissance_pattern), qu'on n'est pas en
      // désaccordage franc (alliance >= 1), et une seule fois par session. Le
      // timing délicat — accueillir d'abord, une touche, lâcher si elle ne
      // saisit pas — est porté par la règle « Le motif qui revient ». On ne
      // déverse pas les fragments : un SIGNAL d'arrière-plan bâti sur les
      // dimensions catégorielles récurrentes (sphère, émotion, prisme, climat
      // relationnel, direction_type, deplacement_type — calcul local, aucun
      // appel), dont on ne garde que les deux plus fréquentes, PLUS une couche
      // de CONTENU : ses mots/thèmes qui reviennent (recurringWords, distillés
      // par enrich_fragments, résolus à l'ouverture). direction/deplacement en
      // texte libre restent de côté (ils n'agrègent pas).
      if (
        !noInjection &&
        !longitudinalFired &&
        !motifSurfaced.current &&
        patternRecognized &&
        alliance >= 1 &&
        pastReflections.length > 0
      ) {
        const topOf = (vals: (string | undefined)[]) => {
          const m: Record<string, number> = {};
          vals.forEach((v) => {
            const k = (v || "").trim().toLowerCase().slice(0, 40);
            if (k) m[k] = (m[k] || 0) + 1;
          });
          const top = Object.entries(m).sort((a, b) => b[1] - a[1])[0];
          return top ? { val: top[0], n: top[1] } : null;
        };
        const dims = [
          { t: topOf(pastReflections.map((r) => r.sphere)), lab: (v: string) => `la sphère « ${v} »` },
          { t: topOf(pastReflections.map((r) => r.emotion)), lab: (v: string) => `une teinte « ${v} »` },
          { t: topOf(pastReflections.map((r) => r.prisme)), lab: (v: string) => `le prisme « ${v} »` },
          { t: topOf(pastReflections.map((r) => r.texture_relationnelle)), lab: (v: string) => `un climat relationnel « ${v} »` },
          { t: topOf(pastReflections.map((r) => r.direction_type)), lab: (v: string) => `une direction qui va souvent vers « ${v} »` },
          { t: topOf(pastReflections.map((r) => r.deplacement_type)), lab: (v: string) => `un geste intérieur qui revient, « ${v} »` },
        ];
        const themeBits = dims
          .filter((d) => d.t)
          .sort((a, b) => b.t!.n - a.t!.n)
          .slice(0, 2)
          .map((d) => d.lab(d.t!.val));
        // Couche CONTENU : ses mots/thèmes qui reviennent (distillés), max 2.
        const wordBit = recurringWords
          .slice(0, 2)
          .map((w) => `« ${w} »`)
          .join(", ");
        if (themeBits.length > 0 || wordBit) {
          const cat =
            themeBits.length > 0
              ? `ses passages ont souvent gravité autour de ${themeBits.join(" et ")}`
              : "";
          const mots = wordBit
            ? cat
              ? `, et font revenir ces mots à elle : ${wordBit}`
              : `ses passages font souvent revenir ces mots à elle : ${wordBit}`
            : "";
          contextNote += `Signal d'arrière-plan (ne pas citer, ne pas révéler, ne dresser aucun bilan) : la personne est en contact avec une récurrence, et ${cat}${mots}. Si ça recoupe ce qu'elle amène là, sers-t'en comme appui ; sinon, travaille simplement la récurrence telle qu'elle la vit. Dans le cadre de la règle « Le motif qui revient » et seulement si elle a déjà été accueillie : traite cette récurrence comme réelle plutôt que comme un instant isolé — une touche sobre, puis tu reviens à elle. Ne la fais pas ressasser. `;
          motifSurfaced.current = true;
          longitudinalFired = true;
        }
      }

      // Tissage longitudinal — l'endroit où ça s'arrête souvent. Gaté sur
      // l'accordage (alliance >= 1), une fois par session, et seulement quand
      // la session courante REVIENT au même seuil : elle a atteint la profondeur
      // habituelle mais bute à nouveau sur l'étape de blocage récurrente. On
      // calcule cette étape en interne (mode du premier trou parmi les sessions
      // passées qui ont validated_steps) ; on ne livre au bot qu'une description
      // EN MOTS SIMPLES, jamais l'index ni le nom d'étape.
      if (
        !noInjection &&
        !longitudinalFired &&
        !stallSurfaced.current &&
        alliance >= 1 &&
        pastStepSets.length >= 2
      ) {
        const firstGaps: number[] = [];
        pastStepSets.forEach((set) => {
          const s = new Set(set);
          for (let i = 0; i < 5; i++) {
            if (!s.has(i)) {
              firstGaps.push(i);
              break;
            }
          }
        });
        let chronicStall: number | null = null;
        if (firstGaps.length >= 2) {
          const c: Record<number, number> = {};
          firstGaps.forEach((g) => (c[g] = (c[g] || 0) + 1));
          const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
          if (top && top[1] >= 2) chronicStall = Number(top[0]);
        }
        // La session courante revient-elle à ce seuil ? (profondeur atteinte
        // mais l'étape de blocage pas encore franchie.)
        if (
          chronicStall !== null &&
          validatedSteps.size >= chronicStall &&
          !validatedSteps.has(chronicStall)
        ) {
          const STALL_HINT: Record<number, string> = {
            0: "elle s'arrête souvent avant même d'avoir posé clairement ce qui se passe",
            1: "elle s'arrête souvent avant de toucher ce que ça lui fait vraiment, à l'intérieur",
            2: "elle repart souvent sans avoir dégagé ce qu'elle cherche vraiment dans tout ça",
            3: "elle reste souvent seule avec la situation, sans aller voir ce qu'un autre regard en dirait",
            4: "le travail se fait souvent, mais ça repart sans qu'une direction se soit posée",
          };
          contextNote += `Signal d'arrière-plan (ne pas citer, ne pas révéler, ne nommer aucune « étape ») : au fil de ses passages, ${STALL_HINT[chronicStall]} — et on dirait qu'on y revient là. Dans le cadre de la règle « L'endroit où ça s'arrête souvent » et seulement si elle a déjà été accueillie : tu peux le lui rendre visible en mots simples, comme une invitation à s'interroger, jamais comme un reproche ni un échec. Une fois, puis tu la laisses en faire ce qu'elle veut. `;
          stallSurfaced.current = true;
          longitudinalFired = true;
        }
      }

      // Tissage longitudinal — le geste qu'elle ne fait presque jamais (lecture
      // par l'absence). Le plus délicat : on ne l'arme qu'avec assez de matière
      // (forward-only, chauffe lentement), quand elle bouge DÉJÀ sur plusieurs
      // gestes mais qu'un précis reste à zéro — et une seule fois À VIE par geste
      // (flag localStorage), pour ne jamais nagger d'une session à l'autre.
      // Posture : invitation, jamais un manque ni un verdict (mêmes garde-fous
      // que « Le motif qui revient »). Le bot ne reçoit que la tournure simple
      // (hint), jamais le mot « geste » brut.
      if (
        !noInjection &&
        !longitudinalFired &&
        !absenceSurfaced.current &&
        alliance >= 1 &&
        pastReflections.length > 0
      ) {
        const present: Record<string, number> = {};
        pastReflections.forEach((r) => {
          const k = (r.deplacement_type || "").trim().toLowerCase();
          if (k) present[k] = (present[k] || 0) + 1;
        });
        const populated = Object.values(present).reduce((a, b) => a + b, 0);
        const distinct = Object.keys(present).length;
        // Assez de cartes renseignées ET elle bouge déjà de plusieurs façons :
        // sinon « absent » ne veut rien dire. Seuil bas (3) assumé — la lecture
        // est plus précoce, mais le cadrage « invitation » (jamais un verdict)
        // et le dédoublonnage une-fois-par-geste la gardent sûre même tôt.
        if (populated >= 3 && distinct >= 3) {
          let invited: string[] = [];
          try {
            invited = JSON.parse(
              localStorage.getItem("collegue_absence_invited") || "[]",
            );
          } catch {}
          // Premier geste pivot absent et pas encore proposé (vocab ordonné par
          // pivotalité).
          const missing = DEPLACEMENT_GESTURES.find(
            (g) => !present[g.key] && !invited.includes(g.key),
          );
          if (missing) {
            contextNote += `Signal d'arrière-plan (ne pas citer, ne pas révéler, ne dresser aucun bilan, ne jamais nommer un « manque ») : la personne bouge souvent dans ses passages (plusieurs mouvements reviennent), mais il y en a un qu'elle tente rarement. Si elle a déjà été accueillie, et dans la même posture que « Le motif qui revient » (une invitation, jamais un verdict ni un reproche), tu peux ouvrir une fois la curiosité de ce côté : l'amener doucement vers ${missing.hint}. Une touche, puis tu laisses. Ne la fais pas ressasser. `;
            absenceSurfaced.current = true;
            longitudinalFired = true;
            try {
              localStorage.setItem(
                "collegue_absence_invited",
                JSON.stringify([...invited, missing.key]),
              );
            } catch {}
          }
        }
      }

      if (!noInjection && projectionDetected) {
        contextNote += `Note interne (ne jamais nommer, ne pas citer) : la personne s'installe dans le blâme de l'autre. Reçois l'émotion comme réelle, mais ne valide pas le "c'est sa faute" comme une direction — rouvre doucement vers ce que l'autre traverse ou vers sa propre part, sans la contredire. `;
      }

      let finalMessages = [...payload];
      if (contextNote) {
        finalMessages[finalMessages.length - 1] = {
          ...finalMessages[finalMessages.length - 1],
          content:
            finalMessages[finalMessages.length - 1].content +
            `\n\n[INSN: ${contextNote}]`,
        };
      }

      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "chat",
          messages: toWorkerMessages(finalMessages),
          max_tokens: maxTokens,
          data: {
            personal_id: localStorage.getItem("collegue_personal_id") || "",
            code: localStorage.getItem("collegue_access_code") || "",
          },
        }),
      });

      // C2 : un échec HTTP (429/500/403…) porte un corps, donc `!res.body` ne
      // l'attrape pas — sans ce contrôle, le parser SSE ne trouve aucun
      // `data:`, renvoie une chaîne vide, et la bulle reste vide en silence.
      // On lève pour que l'appelant (catch) rende l'erreur visible.
      if (!res.ok) {
        if (res.status === 429) throw new Error("RATE_LIMIT");
        throw new Error(`Worker error ${res.status}`);
      }
      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.delta?.text || "";
            if (chunk) {
              fullText += chunk;
              onChunk(chunk);
            }
          } catch {}
        }
      }
      // C3 : un dernier événement SSE sans newline final reste dans `buffer`
      // et serait perdu. On le traite avant de retourner.
      if (buffer.startsWith("data: ")) {
        const data = buffer.slice(6);
        if (data !== "[DONE]") {
          try {
            const chunk = JSON.parse(data).delta?.text || "";
            if (chunk) {
              fullText += chunk;
              onChunk(chunk);
            }
          } catch {}
        }
      }
      return fullText;
    },
    [validatedSteps, motsCles, activeResumeContext, pastReflections, pastStepSets, projectionDetected, patternRecognized, alliance, recurringWords],
  );
}
