// Scene presets for the /try-yourself AI feature.
// Each preset is a fixed prompt template — users only choose a scene,
// they don't write free-form prompts (avoids abuse, content moderation, etc).

export interface Scene {
  id: string;
  /** Display name in EN — translated client-side via t("scenes.<id>.name") */
  nameEn: string;
  /** Short subtitle in EN — translated client-side via t("scenes.<id>.subtitle") */
  subtitleEn: string;
  /** Big emoji shown on the picker card (no external image dependency). */
  emoji: string;
  /** Tailwind gradient classes for the card background. */
  gradient: string;
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
    emoji: "🏰",
    gradient: "from-amber-400 via-orange-500 to-rose-600",
    prompt:
      "Generate a brand-new full-body wide-angle travel photograph of the person from the reference image. Use the reference ONLY to capture their face, hair, skin tone, age and gender — the body, pose, clothes and framing must be newly generated. Composition: the person is centred and visible from head to toe (full figure), standing on a stone terrace in front of Pena Palace in Sintra, Portugal. The full colourful palace facade (yellow, red, blue domes) fills the background. They wear casual travel-tourist clothes, smiling naturally, looking at the camera. Warm golden-hour sunset light, soft mist in the distance, photorealistic, shot at ~28-35mm focal length, depth of field, 4K detail. Aspect ratio square 1024×1024. The result MUST NOT be a head-and-shoulders crop — it must show the full body.",
    conciergeLoc: "sintra",
  },
  {
    id: "algarve-benagil",
    nameEn: "Benagil Cave, Algarve",
    subtitleEn: "Iconic sea-cave dome with turquoise water",
    emoji: "🌊",
    gradient: "from-cyan-400 via-teal-500 to-blue-600",
    prompt:
      "Generate a brand-new full-body wide-angle travel photograph of the person from the reference image. Use the reference ONLY for their face, hair, skin tone, age and gender — body, pose, clothes and framing must be newly generated. Composition: the person stands ankle-deep in turquoise water inside Benagil Cave in Algarve, Portugal, fully visible from head to toe. Above them is the iconic circular skylight in the cave ceiling with a sunbeam pouring through. Golden sandstone walls curve around them. They wear a casual swimsuit / beach outfit, relaxed natural pose, looking at the camera. Photorealistic professional travel photography, shot at 28mm, soft warm light, 4K detail, square 1024×1024. The result MUST be a full-body shot, not a crop.",
    conciergeLoc: "algarve",
  },
  {
    id: "porto-ribeira",
    nameEn: "Porto Ribeira waterfront",
    subtitleEn: "Pastel houses, Douro river, Dom Luís I bridge",
    emoji: "🌉",
    gradient: "from-rose-400 via-fuchsia-500 to-indigo-600",
    prompt:
      "Generate a brand-new full-body wide-angle travel photograph of the person from the reference image. Use the reference ONLY for their face, hair, skin tone, age and gender — body, pose, clothes and framing must be newly generated. Composition: the person stands on the Ribeira cobbled waterfront in Porto, Portugal, fully visible from head to toe. Behind them: colourful pastel-painted riverside houses on the left, the Douro river behind, and the iconic Dom Luís I iron bridge in the distance. They wear casual travel-tourist clothes, candid relaxed pose, looking at the camera. Warm late-afternoon light, photorealistic, 28-35mm focal length, shallow depth of field, 4K detail, square 1024×1024. The result MUST be a full-body shot — head to toe — not a head-and-shoulders crop.",
    conciergeLoc: "porto",
  },
  {
    id: "lisbon-tram",
    nameEn: "Lisbon yellow Tram 28",
    subtitleEn: "Cobbled Alfama street, classic yellow tram",
    emoji: "🚋",
    gradient: "from-yellow-300 via-amber-400 to-orange-500",
    prompt:
      "Generate a brand-new full-body wide-angle travel photograph of the person from the reference image. Use the reference ONLY for their face, hair, skin tone, age and gender — body, pose, clothes and framing must be newly generated. Composition: the person stands on a cobbled street in Alfama, Lisbon, Portugal, fully visible from head to toe. The iconic bright yellow Tram 28 is right behind them on its tracks. Traditional blue azulejo tiled walls flank the narrow street. They wear casual travel-tourist clothes, candid pose, looking at the camera. Soft afternoon light, photorealistic professional travel photo, shot at 28-35mm, shallow depth of field, 4K detail, square 1024×1024. The result MUST be a full-body shot — head to toe — not a crop.",
    conciergeLoc: "lisbon",
  },
  {
    id: "cabo-da-roca",
    nameEn: "Cabo da Roca cliffs",
    subtitleEn: "Continental Europe's westernmost dramatic cliffs",
    emoji: "🗻",
    gradient: "from-slate-500 via-blue-700 to-indigo-900",
    prompt:
      "Generate a brand-new full-body wide-angle travel photograph of the person from the reference image. Use the reference ONLY for their face, hair, skin tone, age and gender — body, pose, clothes and framing must be newly generated. Composition: the person stands on the cliff edge at Cabo da Roca, Portugal — the westernmost point of continental Europe — fully visible from head to toe. Behind them: dramatic cliffs plunging into the Atlantic Ocean, the historic red-and-white lighthouse in the distance. Windswept atmosphere, hair and clothes slightly blowing. They wear casual travel-tourist clothes (light jacket), confident pose, looking at the camera. Soft golden-hour light, photorealistic, 28mm, 4K detail, square 1024×1024. The result MUST be a full-body shot — head to toe — not a head-and-shoulders crop.",
    conciergeLoc: "cascais",
  },
  {
    id: "lagos-beach",
    nameEn: "Lagos golden beach",
    subtitleEn: "Sandstone arches, soft Atlantic surf",
    emoji: "🏖️",
    gradient: "from-orange-300 via-amber-500 to-yellow-600",
    prompt:
      "Generate a brand-new full-body wide-angle travel photograph of the person from the reference image. Use the reference ONLY for their face, hair, skin tone, age and gender — body, pose, clothes and framing must be newly generated. Composition: the person stands barefoot on the golden-sand beach at Praia Dona Ana in Lagos, Algarve, Portugal, fully visible from head to toe. Behind them: dramatic ochre sandstone arches and rock formations rising from turquoise Atlantic surf. They wear casual beach clothes / light summer outfit, relaxed natural pose, looking at the camera. Soft warm sunset light, photorealistic professional travel photography, shot at 28-35mm, shallow depth of field, 4K detail, square 1024×1024. The result MUST be a full-body shot — head to toe — not a crop.",
    conciergeLoc: "algarve",
  },
];

export function getScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
