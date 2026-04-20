/**
 * Curated hero collage — 5 hand-picked portfolio photos.
 * Replace by swapping the url + alt. Slot shape hints:
 *  - main: big square-ish (horizontal works)
 *  - topRight & bottomRight: TALL (vertical)
 *  - bottomLeft & bottomCenter: medium square (horizontal/square)
 * On mobile: first 4 used.
 */
export interface HeroImage {
  url: string;
  alt: string;
  photographerSlug: string;
  photographerName: string;
}

export const heroImages: HeroImage[] = [
  // Main — horizontal, wedding/couple moment
  {
    url: "/uploads/portfolio/20323be2-b395-49d9-9a2f-9a2f66c0c18a/8d4a6dda-f4b7-4a41-bfd3-2a554cdc058b.jpg",
    alt: "Wedding photography in Portugal by Denis Erroyaux",
    photographerSlug: "p-e4e0620a76",
    photographerName: "Denis Erroyaux",
  },
  // Top right — vertical portrait
  {
    url: "/uploads/portfolio/a89042f8-9ec9-489c-a304-d1f71f5821d8/70855125-58d8-4af5-9700-dfeed95ed199.jpg",
    alt: "Solo portrait photography in Lisbon by Sophie Bellmann",
    photographerSlug: "p-b030276",
    photographerName: "Sophie Bellmann",
  },
  // Bottom left — horizontal family / group
  {
    url: "/uploads/portfolio/7589812c-c9f9-43e3-a509-64fd6d10f1f1/64d1e741-640d-41b1-aed3-01b05a70c09a.jpg",
    alt: "Lisbon photoshoot by Tatiana Ostrower",
    photographerSlug: "tati-ostrower",
    photographerName: "Tatiana Ostrower",
  },
  // Bottom center — horizontal couple
  {
    url: "/uploads/portfolio/33becad3-d2b3-4641-a62b-147e354e9a40/22f6704a-e0db-48fe-8d2a-8644ca4e6714.jpeg",
    alt: "Couples photography in Portugal by Pedro Moreira",
    photographerSlug: "moreirafotografia",
    photographerName: "Pedro Moreira",
  },
  // Bottom right — vertical portrait
  {
    url: "/uploads/portfolio/f4f749b5-ab15-402c-82db-4375e094461d/76049ac8-cc4c-465b-ae67-1ea896c315da.jpg",
    alt: "Lisbon portrait photography by Kate Belova",
    photographerSlug: "kate-belova",
    photographerName: "Kate Belova",
  },
];
