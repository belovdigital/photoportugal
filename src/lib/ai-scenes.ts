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
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY to capture each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand together on a stone terrace in front of Pena Palace in Sintra, Portugal. The full colourful palace facade (yellow, red, blue domes) fills the background. They wear casual travel-tourist clothes, smiling naturally, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Warm golden-hour sunset light, soft mist in the distance. Composition: prefer a full-body or 3/4-length wide-angle group shot at ~28mm; if the reference is a tight head-shot or selfie, a confident portrait crop is also acceptable as long as the palace is clearly behind them. Photorealistic, depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "sintra",
  },
  {
    id: "algarve-benagil",
    nameEn: "Benagil Cave, Algarve",
    subtitleEn: "Iconic sea-cave dome with turquoise water",
    emoji: "🌊",
    gradient: "from-cyan-400 via-teal-500 to-blue-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference are inside Benagil Cave in Algarve, Portugal, with the iconic circular skylight in the cave ceiling and a sunbeam pouring through, golden sandstone walls curving around them, turquoise water at their feet. They wear casual swimsuit / beach outfits, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 24-28mm; a tighter portrait crop is acceptable for selfie-style references as long as the cave skylight is clearly visible. Photorealistic, soft warm light, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "algarve",
  },
  {
    id: "porto-ribeira",
    nameEn: "Porto Ribeira waterfront",
    subtitleEn: "Pastel houses, Douro river, Dom Luís I bridge",
    emoji: "🌉",
    gradient: "from-rose-400 via-fuchsia-500 to-indigo-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on the Ribeira cobbled waterfront in Porto, Portugal. Behind them: colourful pastel-painted riverside houses on the left, the Douro river, and the iconic Dom Luís I iron bridge in the distance. They wear casual travel-tourist clothes, candid relaxed pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 28mm; a tighter portrait crop is acceptable for selfie-style references as long as the Dom Luís I bridge is clearly visible behind. Warm late-afternoon light, photorealistic, shallow depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "porto",
  },
  {
    id: "lisbon-tram",
    nameEn: "Lisbon yellow Tram 28",
    subtitleEn: "Cobbled Alfama street, classic yellow tram",
    emoji: "🚋",
    gradient: "from-yellow-300 via-amber-400 to-orange-500",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on a cobbled street in Alfama, Lisbon, Portugal. The iconic bright yellow Tram 28 is right behind them on its tracks. Traditional blue azulejo tiled walls flank the narrow street. They wear casual travel-tourist clothes, candid pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 28mm; a tighter portrait crop is acceptable for selfie-style references as long as the yellow Tram 28 is clearly visible behind them. Soft afternoon light, photorealistic, shallow depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "lisbon",
  },
  {
    id: "cabo-da-roca",
    nameEn: "Cabo da Roca cliffs",
    subtitleEn: "Continental Europe's westernmost dramatic cliffs",
    emoji: "🗻",
    gradient: "from-slate-500 via-blue-700 to-indigo-900",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on the cliff edge at Cabo da Roca, Portugal — the westernmost point of continental Europe. Behind them: dramatic cliffs plunging into the Atlantic Ocean, the historic red-and-white lighthouse in the distance. Windswept atmosphere, hair and clothes slightly blowing. They wear casual travel-tourist clothes (light jackets), confident pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 24-28mm; a tighter portrait crop is acceptable for selfie-style references as long as the cliff and Atlantic horizon are clearly visible behind. Soft golden-hour light, photorealistic, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "cascais",
  },
  {
    id: "lagos-beach",
    nameEn: "Lagos golden beach",
    subtitleEn: "Sandstone arches, soft Atlantic surf",
    emoji: "🏖️",
    gradient: "from-orange-300 via-amber-500 to-yellow-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference are on the golden-sand beach at Praia Dona Ana in Lagos, Algarve, Portugal. Behind them: dramatic ochre sandstone arches and rock formations rising from turquoise Atlantic surf. They wear casual beach clothes / light summer outfits, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 28mm; a tighter portrait crop is acceptable for selfie-style references as long as the sandstone arches are clearly visible behind. Soft warm sunset light, photorealistic, shallow depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "algarve",
  },
  {
    id: "aveiro-moliceiros",
    nameEn: "Aveiro canals",
    subtitleEn: "Hand-painted moliceiro boats on the canals",
    emoji: "🛶",
    gradient: "from-sky-400 via-cyan-500 to-emerald-500",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference are on a stone bridge or quayside along the canals of Aveiro, Portugal. Beside them: a brightly hand-painted traditional moliceiro boat (yellow, red, blue) on calm reflective water; pastel canal-side houses behind. They wear casual travel-tourist clothes, candid relaxed pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 28mm; a tighter portrait crop is acceptable for selfie-style references as long as the painted moliceiro boat is clearly visible. Soft afternoon light, photorealistic, shallow depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "aveiro",
  },
  {
    id: "costa-nova-stripes",
    nameEn: "Costa Nova striped houses",
    subtitleEn: "Candy-stripe palheiros on the Atlantic",
    emoji: "🏘️",
    gradient: "from-rose-400 via-pink-400 to-sky-400",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on the boardwalk at Costa Nova, Portugal in front of the iconic palheiros — wooden fishermen's houses painted in vivid vertical candy-stripes (red, blue, yellow, green on white). They wear casual travel clothes, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 28mm; a tighter portrait crop is acceptable for selfie-style references as long as several striped palheiros are clearly visible behind them. Soft warm afternoon light, photorealistic, shallow depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "aveiro",
  },
  {
    id: "douro-valley",
    nameEn: "Douro Valley vineyards",
    subtitleEn: "Terraced wine country above the river",
    emoji: "🍇",
    gradient: "from-emerald-400 via-green-600 to-amber-700",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on a stone terrace overlooking the Douro Valley, Portugal — dramatic terraced vineyards stepping down to the meandering Douro river far below, golden-green hillsides. They hold a glass of port wine, wear smart-casual travel clothes, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 28-35mm; a tighter portrait crop is acceptable for selfie-style references as long as the terraced vineyards and river bend are clearly visible behind. Warm golden-hour light, photorealistic, shallow depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "douro-valley",
  },
  {
    id: "azores-sete-cidades",
    nameEn: "Azores · Sete Cidades",
    subtitleEn: "Twin lakes — blue & green — in a volcano crater",
    emoji: "💎",
    gradient: "from-blue-500 via-teal-500 to-emerald-500",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand at the Vista do Rei viewpoint above Sete Cidades on São Miguel island, Azores, Portugal. Behind them: the iconic twin crater lakes — one striking blue, one vivid green — separated by a narrow causeway, surrounded by lush volcanic mountains. They wear casual hiking-travel clothes (light jacket), confident pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 24-28mm to capture both lakes; a tighter portrait crop is acceptable for selfie-style references as long as the twin-coloured lakes are clearly visible behind. Soft cloudy light with sun breaking through, photorealistic, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "azores",
  },
  {
    id: "belem-tower",
    nameEn: "Belém Tower, Lisbon",
    subtitleEn: "Manueline tower on the Tagus",
    emoji: "🗼",
    gradient: "from-amber-300 via-orange-400 to-blue-500",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on the riverside walkway in Belém, Lisbon, Portugal with the iconic Belém Tower (Torre de Belém) — the ornate 16th-century Manueline limestone tower — clearly visible on the Tagus river behind them. They wear casual travel-tourist clothes, candid relaxed pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 28mm; a tighter portrait crop is acceptable for selfie-style references as long as Belém Tower is clearly visible behind. Soft warm afternoon light, photorealistic, shallow depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "lisbon",
  },
  {
    id: "evora-temple",
    nameEn: "Évora Roman Temple",
    subtitleEn: "Ancient Corinthian columns, medieval town",
    emoji: "🏛️",
    gradient: "from-stone-400 via-amber-500 to-yellow-700",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand in the cobbled square in front of the Roman Temple of Évora (Templo de Diana) in Évora, Portugal — a 1st-century Roman temple with surviving granite Corinthian columns on a stone podium, set against medieval whitewashed buildings. They wear smart-casual travel clothes, relaxed natural pose, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Composition: prefer a full-body or 3/4-length wide-angle group shot at 28-35mm; a tighter portrait crop is acceptable for selfie-style references as long as the Corinthian columns of the Roman temple are clearly visible behind. Warm late-afternoon golden light, photorealistic, shallow depth of field, 4K detail, landscape 1536×1024. NEVER drop or duplicate anyone.",
    conciergeLoc: "evora",
  },
];

export function getScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}
