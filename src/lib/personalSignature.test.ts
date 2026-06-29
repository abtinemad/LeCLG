import { describe, it, expect } from "vitest";
import { personalSignature } from "./personalSignature";
import { EMOTIONS, type ReflectionCard } from "../data/emotions";

const card = (over: Partial<ReflectionCard>): ReflectionCard => ({
  fragment: "",
  deplacement: "",
  direction: "",
  date: "2026-01-01",
  ...over,
});

describe("personalSignature", () => {
  it("ancre sur le défaut quand il y a peu de cartes (rien inventé)", () => {
    const sig = personalSignature([card({ emotion: "colere" }), card({ emotion: "colere" })]);
    expect(sig.dominant).toBeNull();
    expect(sig.color).toBe("#E8D5B0");
    expect(sig.intensity).toBe(0.5);
  });

  it("gère la liste vide sans planter", () => {
    const sig = personalSignature([] as ReflectionCard[]);
    expect(sig.dominant).toBeNull();
    expect(sig.intensity).toBe(0.5);
  });

  it("sort la dominante et SA couleur canonique", () => {
    const sig = personalSignature([
      card({ emotion: "colere", date: "2026-01-01" }),
      card({ emotion: "colere", date: "2026-01-02" }),
      card({ emotion: "joie", date: "2026-01-03" }),
    ]);
    expect(sig.dominant).toBe("colere");
    expect(sig.color).toBe(EMOTIONS.colere.color);
  });

  it("normalise accents + majuscules vers la clé d'émotion", () => {
    const sig = personalSignature([
      card({ emotion: "Colère" }),
      card({ emotion: "COLÈRE" }),
      card({ emotion: "colere" }),
    ]);
    expect(sig.dominant).toBe("colere");
    expect(sig.color).toBe(EMOTIONS.colere.color);
  });

  it("le prisme prime sur l'émotion brute", () => {
    const sig = personalSignature([
      card({ prisme: "tristesse", emotion: "joie" }),
      card({ prisme: "tristesse", emotion: "joie" }),
      card({ prisme: "tristesse", emotion: "joie" }),
    ]);
    expect(sig.dominant).toBe("tristesse");
  });

  it("la récence fait basculer la dominante (évolue dans le temps)", () => {
    const sig = personalSignature([
      card({ emotion: "joie", date: "2026-03-10" }),
      card({ emotion: "joie", date: "2026-03-09" }),
      card({ emotion: "joie", date: "2026-03-08" }),
      card({ emotion: "peur", date: "2026-01-03" }),
      card({ emotion: "peur", date: "2026-01-02" }),
      card({ emotion: "peur", date: "2026-01-01" }),
    ]);
    expect(sig.dominant).toBe("joie");
  });

  it("ignore les valeurs qui ne mappent aucune couleur connue", () => {
    const sig = personalSignature([
      card({ emotion: "xyz-inconnu" }),
      card({ emotion: "xyz-inconnu" }),
      card({ emotion: "amour" }),
    ]);
    expect(sig.dominant).toBe("amour");
  });

  it("la puissance monte avec le volume et reste bornée", () => {
    const few = personalSignature(Array.from({ length: 5 }, () => card({ emotion: "calme-non-mappe" })));
    const many = personalSignature(Array.from({ length: 60 }, () => card({ emotion: "calme-non-mappe" })));
    expect(many.intensity).toBeGreaterThan(few.intensity);
    expect(many.intensity).toBeLessThanOrEqual(2.0);
    expect(few.intensity).toBeGreaterThanOrEqual(0.5);
  });
});
