import type { Scene } from "./ai-scenes";

/**
 * AI try-yourself scenes for the Spanish market.
 *
 * Hand-written, not generated. Each prompt names a real place and describes what
 * the camera sees there — substitution would have produced "Benagil Cave in
 * Spain", which the image model would either refuse or invent, and the visitor
 * would get a picture of somewhere that does not exist.
 *
 * `conciergeLoc` must be a slug from `locations-data-es.ts`, otherwise the
 * hand-off from a generated selfie into the concierge silently loses the city.
 */
export const SCENES_ES: Scene[] = [
  {
    id: "alhambra-granada",
    nameEn: "The Alhambra, Granada",
    subtitleEn: "Moorish palace on the ridge, Sierra Nevada behind",
    emoji: "🏰",
    gradient: "from-amber-400 via-orange-500 to-rose-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY to capture each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand together at the Mirador de San Nicolás in Granada, Spain, with the Alhambra palace complex along the opposite ridge and the snow-capped Sierra Nevada behind it. They wear casual travel-tourist clothes, smiling naturally, with relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Warm golden-hour light. NEVER drop or duplicate anyone.",
    conciergeLoc: "granada",
  },
  {
    id: "park-guell-barcelona",
    nameEn: "Park Güell, Barcelona",
    subtitleEn: "Gaudí mosaics above the whole city",
    emoji: "🦎",
    gradient: "from-lime-400 via-emerald-500 to-teal-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference sit on the curving mosaic bench at Park Güell in Barcelona, Spain, with broken-tile patterns in blue, green and ochre around them and the city and Mediterranean visible below. Casual summer travel clothes, relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Bright late-afternoon light. NEVER drop or duplicate anyone.",
    conciergeLoc: "barcelona",
  },
  {
    id: "plaza-espana-seville",
    nameEn: "Plaza de España, Seville",
    subtitleEn: "Tiled bridges over the canal",
    emoji: "🎭",
    gradient: "from-orange-300 via-amber-500 to-red-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand on one of the tiled bridges of the Plaza de España in Seville, Spain, the brick semicircle and painted azulejo alcoves curving behind them, still canal water below. Light summer clothes, relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Warm evening light. NEVER drop or duplicate anyone.",
    conciergeLoc: "seville",
  },
  {
    id: "ronda-bridge",
    nameEn: "Puente Nuevo, Ronda",
    subtitleEn: "A stone bridge over a 120-metre gorge",
    emoji: "🌉",
    gradient: "from-stone-400 via-amber-600 to-orange-700",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand at a viewpoint in Ronda, Spain, with the Puente Nuevo spanning the deep El Tajo gorge behind them and white houses balanced on the cliff edge. Casual travel clothes, relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Golden-hour light, dramatic depth. NEVER drop or duplicate anyone.",
    conciergeLoc: "ronda",
  },
  {
    id: "mallorca-cala",
    nameEn: "A Mallorca cove",
    subtitleEn: "Turquoise water between pine-backed cliffs",
    emoji: "🏖️",
    gradient: "from-cyan-400 via-teal-500 to-blue-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference are on the sand of a small turquoise cove in Mallorca, Spain, limestone cliffs and umbrella pines rising on both sides, clear shallow water at their feet. Beach or light summer outfits, relaxed natural pose and relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "mallorca",
  },
  {
    id: "madrid-debod",
    nameEn: "Templo de Debod, Madrid",
    subtitleEn: "Egyptian temple reflected at sunset",
    emoji: "🌇",
    gradient: "from-rose-400 via-orange-500 to-amber-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand beside the reflecting pool at the Templo de Debod in Madrid, Spain, the ancient Egyptian temple and its stone gateways mirrored in still water, the whole western sky burning orange behind them. Smart-casual city clothes, relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. NEVER drop or duplicate anyone.",
    conciergeLoc: "madrid",
  },
  {
    id: "teide-tenerife",
    nameEn: "Mount Teide, Tenerife",
    subtitleEn: "Volcanic desert above a sea of cloud",
    emoji: "🌋",
    gradient: "from-red-400 via-orange-600 to-stone-700",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand in the red and ochre volcanic desert of Teide National Park in Tenerife, Spain, the peak of Mount Teide behind them and a solid layer of cloud below the horizon. Hiking-casual clothes, relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Crisp high-altitude light. NEVER drop or duplicate anyone.",
    conciergeLoc: "tenerife",
  },
  {
    id: "toledo-old-town",
    nameEn: "Toledo, walled city",
    subtitleEn: "Medieval stone above a river bend",
    emoji: "⚔️",
    gradient: "from-amber-300 via-yellow-600 to-stone-600",
    prompt:
      "Generate a brand-new travel photograph featuring EVERY person from the reference image. Use the reference ONLY for each person's face, hair, skin tone, age and gender — keep every face identical to the reference. Body, pose, clothes and framing must be newly generated. Setting: all people from the reference stand at a viewpoint across the river from Toledo, Spain, the whole medieval city stacked up the hillside behind them with the cathedral and the Alcázar on top. Casual travel clothes, relaxed natural smiles (if anyone in the reference looks neutral or sad, give them a soft warm smile while keeping their identity intact), looking at the camera. Warm late-afternoon light on honey-coloured stone. NEVER drop or duplicate anyone.",
    conciergeLoc: "toledo",
  },
];
