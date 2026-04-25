// Demo translation: Kate Belova (founder) — bio, tagline, packages translated to PT/DE/ES/FR.
// Run on server: node scripts/translate-kate-belova.mjs

import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/var/www/photoportugal/.env", "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; }),
);

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const KATE_ID = "f4f749b5-ab15-402c-82db-4375e094461d";

// Tagline & Bio translations
const TAGLINE = {
  pt: "Capturando momentos reais em família com carinho e atenção",
  de: "Echte Familienmomente einfangen — mit Wärme und Sorgfalt",
  es: "Capturando momentos familiares reales con calidez y cuidado",
  fr: "Capturer des instants de famille authentiques, avec chaleur et attention",
};

const BIO = {
  pt: "Com mais de 14 anos de experiência, especializo-me em capturar ligações familiares genuínas e o vínculo único entre pais e filhos. Como mãe de dois, sei profundamente como o tempo passa depressa e como estes momentos são preciosos. À medida que as crianças crescem, estas memórias tornam-se inestimáveis — o meu objectivo é preservá-las de forma natural e atemporal.",
  de: "Mit über 14 Jahren Erfahrung spezialisiere ich mich darauf, echte Familienverbindungen und die einzigartige Bindung zwischen Eltern und Kindern festzuhalten. Als Mutter von zwei Kindern weiß ich genau, wie schnell die Zeit vergeht und wie kostbar diese Momente sind. Wenn die Kinder wachsen, werden diese Erinnerungen unbezahlbar — mein Ziel ist es, sie auf natürliche und zeitlose Weise zu bewahren.",
  es: "Con más de 14 años de experiencia, me especializo en capturar conexiones familiares genuinas y el vínculo único entre padres e hijos. Como madre de dos, comprendo profundamente lo rápido que pasa el tiempo y lo preciosos que son estos momentos. A medida que los niños crecen, estos recuerdos se vuelven invaluables — mi objetivo es preservarlos de forma natural y atemporal.",
  fr: "Avec plus de 14 ans d'expérience, je me spécialise dans la capture des liens familiaux authentiques et du lien unique entre parents et enfants. Maman de deux enfants, je sais à quel point le temps passe vite et combien ces instants sont précieux. À mesure que les enfants grandissent, ces souvenirs deviennent inestimables — mon objectif est de les préserver de manière naturelle et intemporelle.",
};

await client.query(
  `UPDATE photographer_profiles SET
     tagline_pt = $1, tagline_de = $2, tagline_es = $3, tagline_fr = $4,
     bio_pt = $5, bio_de = $6, bio_es = $7, bio_fr = $8,
     translations_updated_at = NOW(), translations_dirty = FALSE
   WHERE id = $9`,
  [TAGLINE.pt, TAGLINE.de, TAGLINE.es, TAGLINE.fr,
   BIO.pt, BIO.de, BIO.es, BIO.fr, KATE_ID],
);
console.log("✓ Kate Belova: tagline + bio translated to PT/DE/ES/FR");

// Package translations
const PACKAGES = [
  {
    id: "68a37fe5-c8cc-427d-b8cd-723368464896",
    name: { pt: "Mini Sessão Aconchegante em Casa", de: "Gemütliche Mini-Session zu Hause", es: "Mini Sesión Acogedora en Casa", fr: "Mini Séance Chaleureuse à la Maison" },
    description: {
      pt: "Uma sessão calorosa e íntima no conforto da sua casa — perfeita para retratos de família naturais e capturar momentos do dia a dia.",
      de: "Eine warme, intime Session in der Geborgenheit Ihres Zuhauses — perfekt für natürliche Familienporträts und alltägliche Momente.",
      es: "Una sesión cálida e íntima en la comodidad de su hogar — perfecta para retratos familiares naturales y capturar momentos cotidianos.",
      fr: "Une séance chaleureuse et intime dans le confort de votre maison — parfaite pour des portraits de famille naturels et des moments du quotidien.",
    },
  },
  {
    id: "645ccaaf-f5bc-45cc-8327-c2b9347fa0be",
    name: { pt: "Mini Sessão na Praia", de: "Mini Strand-Session", es: "Mini Sesión en la Playa", fr: "Mini Séance à la Plage" },
    description: {
      pt: "Uma sessão de praia rápida e descontraída — perfeita para retratos de família, postais de férias ou uma memória espontânea da sua viagem.",
      de: "Ein schnelles, entspanntes Strand-Shooting — perfekt für Familienporträts, Urlaubskarten oder eine spontane Erinnerung an Ihre Reise.",
      es: "Una sesión rápida y relajada en la playa — perfecta para retratos familiares, postales de vacaciones o un recuerdo espontáneo de su viaje.",
      fr: "Une séance plage rapide et détendue — parfaite pour des portraits de famille, des cartes de vacances ou un souvenir spontané de votre voyage.",
    },
  },
  {
    id: "ee610206-43c7-45c8-be02-c7437533bca4",
    name: { pt: "Sessão Fotográfica em Lisboa", de: "Lissabon Stadt-Fotoshooting", es: "Sesión de Fotos por Lisboa", fr: "Séance Photo dans Lisbonne" },
    description: {
      pt: "Uma sessão descontraída a percorrer as ruas mais bonitas e os recantos escondidos de Lisboa — capturando momentos naturais e espontâneos enquanto exploramos a cidade juntos.",
      de: "Eine entspannte Spazier-Session durch Lissabons schönste Straßen und versteckte Ecken — natürliche, ungestellte Momente während wir die Stadt gemeinsam erkunden.",
      es: "Una sesión relajada paseando por las calles más bonitas y rincones ocultos de Lisboa — capturando momentos naturales y espontáneos mientras exploramos la ciudad juntos.",
      fr: "Une séance détendue en marchant dans les plus belles rues et coins cachés de Lisbonne — des moments naturels et spontanés pendant que nous explorons la ville ensemble.",
    },
  },
  {
    id: "5da7c110-6e3f-472b-9f6e-e409accfa0ea",
    name: { pt: "História Clássica em Casa", de: "Klassische Familien-Geschichte zu Hause", es: "Historia Familiar Clásica en Casa", fr: "Histoire de Famille Classique à la Maison" },
    description: {
      pt: "Uma sessão sentida e sem pressa nos seus espaços favoritos em casa — a sala, o quarto das crianças, aquele cantinho aconchegante de leitura. Centrada na ligação real e no calor de estarem juntos.",
      de: "Eine herzliche, unhurried Session in Ihren Lieblingsräumen zu Hause — Wohnzimmer, Kinderzimmer, gemütliche Leseecke. Fokussiert auf echte Verbindung und das warme Gefühl des Zusammenseins.",
      es: "Una sesión sentida y sin prisas en sus espacios favoritos del hogar — el salón, la habitación de los niños, ese rincón acogedor de lectura. Centrada en la conexión real y la calidez de estar juntos.",
      fr: "Une séance sincère et sans précipitation dans vos espaces préférés à la maison — le salon, la chambre des enfants, ce coin lecture douillet. Centrée sur la connexion réelle et la chaleur d'être ensemble.",
    },
  },
  {
    id: "27be87fa-2559-4f75-b51b-f775fcef134b",
    name: { pt: "Sessão Clássica na Praia", de: "Klassische Strand-Session", es: "Sesión Clásica en la Playa", fr: "Séance Plage Classique" },
    description: {
      pt: "A experiência completa da hora dourada — narrativa familiar descontraída pela linha de água, rochas e dunas enquanto o sol se põe.",
      de: "Das volle Goldene-Stunde-Erlebnis — entspannte Familien-Geschichten am Wasserrand, an Felsen und Dünen, während die Sonne untergeht.",
      es: "La experiencia completa de la hora dorada — narrativa familiar relajada por la línea del agua, rocas y dunas mientras se pone el sol.",
      fr: "L'expérience complète de l'heure dorée — narration familiale détendue le long de l'eau, des rochers et des dunes pendant que le soleil se couche.",
    },
  },
];

for (const p of PACKAGES) {
  await client.query(
    `UPDATE packages SET
       name_pt = $1, name_de = $2, name_es = $3, name_fr = $4,
       description_pt = $5, description_de = $6, description_es = $7, description_fr = $8,
       translations_updated_at = NOW(), translations_dirty = FALSE
     WHERE id = $9`,
    [p.name.pt, p.name.de, p.name.es, p.name.fr,
     p.description.pt, p.description.de, p.description.es, p.description.fr, p.id],
  );
  console.log(`  ✓ package ${p.name.fr}`);
}

await client.end();
console.log("\nDone — Kate's content fully translated. Visit /fr/photographes/kate-belova to verify.");
