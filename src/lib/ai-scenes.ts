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
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY to capture each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand together on a stone terrace in front of Pena Palace in Sintra, Portugal. The full colourful palace facade (yellow, red, blue domes) fills the background. They wear casual travel-tourist clothes, smiling naturally, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Warm golden-hour sunset light, soft mist in the distance. NEVER drop or duplicate anyone.",
    conciergeLoc: "sintra",
  },
  {
    id: "algarve-benagil",
    nameEn: "Benagil Cave, Algarve",
    subtitleEn: "Iconic sea-cave dome with turquoise water",
    emoji: "🌊",
    gradient: "from-cyan-400 via-teal-500 to-blue-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference are inside Benagil Cave in Algarve, Portugal, with the iconic circular skylight in the cave ceiling and a sunbeam pouring through, golden sandstone walls curving around them, turquoise water at their feet. They wear casual swimsuit / beach outfits, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "algarve",
  },
  {
    id: "porto-ribeira",
    nameEn: "Porto Ribeira waterfront",
    subtitleEn: "Pastel houses, Douro river, Dom Luís I bridge",
    emoji: "🌉",
    gradient: "from-rose-400 via-fuchsia-500 to-indigo-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on the Ribeira cobbled waterfront in Porto, Portugal. Behind them: colourful pastel-painted riverside houses on the left, the Douro river, and the iconic Dom Luís I iron bridge in the distance. They wear casual travel-tourist clothes, candid relaxed pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "porto",
  },
  {
    id: "lisbon-tram",
    nameEn: "Lisbon yellow Tram 28",
    subtitleEn: "Cobbled Alfama street, classic yellow tram",
    emoji: "🚋",
    gradient: "from-yellow-300 via-amber-400 to-orange-500",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on a cobbled street in Alfama, Lisbon, Portugal. The iconic bright yellow Tram 28 is right behind them on its tracks. Traditional blue azulejo tiled walls flank the narrow street. They wear casual travel-tourist clothes, candid pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "lisbon",
  },
  {
    id: "cabo-da-roca",
    nameEn: "Cabo da Roca cliffs",
    subtitleEn: "Continental Europe's westernmost dramatic cliffs",
    emoji: "🗻",
    gradient: "from-slate-500 via-blue-700 to-indigo-900",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on the cliff edge at Cabo da Roca, Portugal — the westernmost point of continental Europe. Behind them: dramatic cliffs plunging into the Atlantic Ocean, the historic red-and-white lighthouse in the distance. Windswept atmosphere, hair and clothes slightly blowing. They wear casual travel-tourist clothes (light jackets), confident pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "cascais",
  },
  {
    id: "lagos-beach",
    nameEn: "Lagos golden beach",
    subtitleEn: "Sandstone arches, soft Atlantic surf",
    emoji: "🏖️",
    gradient: "from-orange-300 via-amber-500 to-yellow-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference are on the golden-sand beach at Praia Dona Ana in Lagos, Algarve, Portugal. Behind them: dramatic ochre sandstone arches and rock formations rising from turquoise Atlantic surf. They wear casual beach clothes / light summer outfits, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "algarve",
  },
  {
    id: "aveiro-moliceiros",
    nameEn: "Aveiro canals",
    subtitleEn: "Hand-painted moliceiro boats on the canals",
    emoji: "🛶",
    gradient: "from-sky-400 via-cyan-500 to-emerald-500",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference are on a stone bridge or quayside along the canals of Aveiro, Portugal. Beside them: a brightly hand-painted traditional moliceiro boat (yellow, red, blue) on calm reflective water; pastel canal-side houses behind. They wear casual travel-tourist clothes, candid relaxed pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "aveiro",
  },
  {
    id: "costa-nova-stripes",
    nameEn: "Costa Nova striped houses",
    subtitleEn: "Candy-stripe palheiros on the Atlantic",
    emoji: "🏘️",
    gradient: "from-rose-400 via-pink-400 to-sky-400",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on the boardwalk at Costa Nova, Portugal in front of the iconic palheiros — wooden fishermen's houses painted in vivid vertical candy-stripes (red, blue, yellow, green on white). They wear casual travel clothes, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "aveiro",
  },
  {
    id: "douro-valley",
    nameEn: "Douro Valley vineyards",
    subtitleEn: "Terraced wine country above the river",
    emoji: "🍇",
    gradient: "from-emerald-400 via-green-600 to-amber-700",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on a stone terrace overlooking the Douro Valley, Portugal — dramatic terraced vineyards stepping down to the meandering Douro river far below, golden-green hillsides. They hold a glass of port wine, wear smart-casual travel clothes, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "douro-valley",
  },
  {
    id: "azores-sete-cidades",
    nameEn: "Azores · Sete Cidades",
    subtitleEn: "Twin lakes — blue & green — in a volcano crater",
    emoji: "💎",
    gradient: "from-blue-500 via-teal-500 to-emerald-500",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand at the Vista do Rei viewpoint above Sete Cidades on São Miguel island, Azores, Portugal. Behind them: the iconic twin crater lakes — one striking blue, one vivid green — separated by a narrow causeway, surrounded by lush volcanic mountains. They wear casual hiking-travel clothes (light jacket), confident pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "azores",
  },
  {
    id: "belem-tower",
    nameEn: "Belém Tower, Lisbon",
    subtitleEn: "Manueline tower on the Tagus",
    emoji: "🗼",
    gradient: "from-amber-300 via-orange-400 to-blue-500",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on the riverside walkway in Belém, Lisbon, Portugal with the iconic Belém Tower (Torre de Belém) — the ornate 16th-century Manueline limestone tower — clearly visible on the Tagus river behind them. They wear casual travel-tourist clothes, candid relaxed pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "lisbon",
  },
  {
    id: "evora-temple",
    nameEn: "Évora Roman Temple",
    subtitleEn: "Ancient Corinthian columns, medieval town",
    emoji: "🏛️",
    gradient: "from-stone-400 via-amber-500 to-yellow-700",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand in the cobbled square in front of the Roman Temple of Évora (Templo de Diana) in Évora, Portugal — a 1st-century Roman temple with surviving granite Corinthian columns on a stone podium, set against medieval whitewashed buildings. They wear smart-casual travel clothes, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "evora",
  },
];

export function getScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

/**
 * Each generation produces 4 photos at the SAME scene with different framings —
 * mimics a real photographer doing wide / portrait / candid / atmospheric shots
 * of the same location. Output: vertical 1024×1536 (Instagram Stories ratio).
 *
 * EVERY variant must produce a PROFESSIONAL THIRD-PERSON shot (taken by an
 * unseen photographer 2-3m away), NEVER a selfie — the reference image is a
 * selfie but the output must clearly NOT be: no arm reaching toward the camera,
 * no phone or camera held by the subject, hands free or naturally at the side
 * / in pockets / holding sunglasses, etc. This anti-selfie reinforcement is
 * critical because gpt-image-2 tends to mirror the reference's framing.
 */
const ANTI_SELFIE = "CRITICAL: this is a PROFESSIONAL PHOTOGRAPHER'S shot taken by someone else, NOT a selfie. The subject does NOT hold a phone or camera; their arm is NOT reaching toward the camera; both hands are free, naturally at their sides, in pockets, or holding non-camera props. Camera is held by an unseen photographer 2-3 metres away. The subject is fully framed in a polished editorial composition — never a selfie pose, never a forearm intruding into the frame, never the wide-angle distortion of a phone selfie.";

export const VARIANT_FRAMINGS: readonly string[] = [
  `Composition: WIDE environmental travel shot, taken by a professional photographer 2-3m away. People stand in the lower 55% of a vertical 1024×1536 frame; the landmark and sky fill the upper portion. Shot at 24mm wide-angle, deep depth of field. Photorealistic, 4K detail. ${ANTI_SELFIE}`,
  `Composition: classic 3/4-length travel portrait by a professional photographer. People framed from the waist up, centred vertically in 1024×1536, the landmark soft-focused behind them. Shot at 50mm with shallow depth of field, beautiful bokeh. Photorealistic, 4K detail. ${ANTI_SELFIE}`,
  `Composition: candid mid-step or mid-laugh moment captured by a professional photographer. People walking, laughing or looking sideways naturally — unposed, dynamic, a slice of life with the landmark behind. Shot at 35mm, slight motion feel, vertical 1024×1536. Photorealistic, 4K detail. ${ANTI_SELFIE}`,
  `Composition: atmospheric low-angle shot by a professional photographer. Camera positioned slightly below eye level so the landmark towers above the people; golden-hour rim-lighting outlines them; cinematic and moody. Shot at 28mm, vertical 1024×1536. Photorealistic, 4K detail. ${ANTI_SELFIE}`,
];

/**
 * Build the OpenAI prompt for a specific scene + framing variant index.
 * Inserts the variant's composition guidance before the "NEVER drop or
 * duplicate anyone." tail so the model treats it as the closing instruction.
 */
export function buildVariantPrompt(scene: Scene, variantIdx: number): string {
  const framing = VARIANT_FRAMINGS[variantIdx % VARIANT_FRAMINGS.length];
  // Existing prompts end with "NEVER drop or duplicate anyone." — splice the
  // variant in just before that tail.
  return scene.prompt.replace(
    /NEVER drop or duplicate anyone\.\s*$/,
    `${framing} NEVER drop or duplicate anyone.`
  );
}
