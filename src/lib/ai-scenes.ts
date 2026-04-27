// Scene presets for the /try-yourself AI feature.
// Each preset is a fixed prompt template — users only choose a scene,
// they don't write free-form prompts (avoids abuse, content moderation, etc).

export interface Scene {
  id: string;
  /** Display name in EN — translated client-side via t("scenes.<id>.name") */
  nameEn: string;
  /** Short subtitle in EN — translated client-side via t("scenes.<id>.subtitle") */
  subtitleEn: string;
  /** Cover thumbnail. Unsplash URLs — free embed, real photos. */
  cover: string;
  /** OpenAI prompt sent to gpt-image-2. Reference image (selfie) is also attached. */
  prompt: string;
  /** Slug → forwarded to /concierge as ?loc= when user converts. */
  conciergeLoc: string;
}

export const SCENES: Scene[] = [
  {
    id: "sintra-palace",
    nameEn: "Sintra Palace at sunset",
    subtitleEn: "Fairytale-coloured Pena Palace, golden-hour glow",
    cover: "https://images.unsplash.com/photo-1591200225910-93162e5b9c80?auto=format&fit=crop&w=800&q=70",
    prompt:
      "Edit the provided photo so the same person appears standing in front of Pena Palace in Sintra, Portugal during golden-hour sunset. Preserve the person's face, hairstyle and skin tone exactly. Warm orange-gold light, the colorful palace facade (yellow, red, blue) clearly visible behind, soft mist in the distance, photorealistic professional travel-photography style, shallow depth of field, natural pose, high detail, 4K. Keep the person's identity unchanged.",
    conciergeLoc: "sintra",
  },
  {
    id: "algarve-benagil",
    nameEn: "Benagil Cave, Algarve",
    subtitleEn: "Iconic sea-cave dome with turquoise water",
    cover: "https://images.unsplash.com/photo-1580237072353-751a8a5b2561?auto=format&fit=crop&w=800&q=70",
    prompt:
      "Edit the provided photo so the same person appears inside Benagil Cave in Algarve, Portugal. Preserve the person's face and identity exactly. Show the iconic circular hole in the cave ceiling with a sunbeam coming through, turquoise water at their feet, golden sandstone walls, soft warm light, photorealistic professional travel photo, natural relaxed pose, 4K detail. Keep the person's identity unchanged.",
    conciergeLoc: "algarve",
  },
  {
    id: "porto-ribeira",
    nameEn: "Porto Ribeira waterfront",
    subtitleEn: "Pastel houses, Douro river, Dom Luís I bridge",
    cover: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=800&q=70",
    prompt:
      "Edit the provided photo so the same person appears at the Ribeira waterfront in Porto, Portugal. Preserve the person's face and identity exactly. Behind them: colourful pastel-coloured riverside houses, the Douro river, and the iconic Dom Luís I iron bridge in the distance. Warm late-afternoon light, photorealistic professional travel photography, natural candid pose, shallow depth of field, 4K. Keep the person's identity unchanged.",
    conciergeLoc: "porto",
  },
  {
    id: "lisbon-tram",
    nameEn: "Lisbon yellow Tram 28",
    subtitleEn: "Cobbled Alfama street, classic yellow tram",
    cover: "https://images.unsplash.com/photo-1588535847212-a7e6f3e4cee2?auto=format&fit=crop&w=800&q=70",
    prompt:
      "Edit the provided photo so the same person appears on a cobbled street in Alfama, Lisbon, Portugal next to the iconic yellow Tram 28. Preserve the person's face and identity exactly. Traditional azulejo tiled walls, narrow street, soft afternoon light, photorealistic professional travel photo, natural candid pose, shallow depth of field, 4K. Keep the person's identity unchanged.",
    conciergeLoc: "lisbon",
  },
  {
    id: "cabo-da-roca",
    nameEn: "Cabo da Roca cliffs",
    subtitleEn: "Continental Europe's westernmost dramatic cliffs",
    cover: "https://images.unsplash.com/photo-1568145770025-1ce21fa55e0d?auto=format&fit=crop&w=800&q=70",
    prompt:
      "Edit the provided photo so the same person appears at Cabo da Roca, Portugal — the westernmost point of continental Europe. Preserve the person's face and identity exactly. Behind them: dramatic cliffs plunging into the Atlantic Ocean, the historic red-and-white lighthouse in the distance, windswept atmosphere, soft golden-hour light, photorealistic professional travel photography, natural pose, 4K detail. Keep the person's identity unchanged.",
    conciergeLoc: "cascais",
  },
  {
    id: "lagos-beach",
    nameEn: "Lagos golden beach",
    subtitleEn: "Sandstone arches, soft Atlantic surf",
    cover: "https://images.unsplash.com/photo-1593019875147-bd31a3128e25?auto=format&fit=crop&w=800&q=70",
    prompt:
      "Edit the provided photo so the same person appears on the golden-sand beach at Lagos, Algarve, Portugal. Preserve the person's face and identity exactly. Behind them: dramatic sandstone arches and rock formations, turquoise Atlantic surf, soft warm sunset light, photorealistic professional travel-photography style, relaxed natural pose, shallow depth of field, 4K. Keep the person's identity unchanged.",
    conciergeLoc: "algarve",
  },
];

export function getScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
