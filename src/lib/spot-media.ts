// Coordinates and curated photos for every spot we publish at
// /spots/[city]/[spot]. Centralised here so getSpot() can merge this
// data into the spot record without forcing 75 in-place edits to
// photo-spots-data.ts (which still owns the descriptive copy).
//
// Keys are `${citySlug}/${spotSlug}` — same shape as the URL path.
// `getSpot(city, slug)` looks up by `spotSlug(spot.name)`, so the keys
// here must match that derivation exactly.

import type { SpotImage } from "./photo-spots-data";

export interface SpotMedia {
  coordinates?: { lat: number; lng: number };
  images?: SpotImage[];
}

/** Build a SpotImage entry from the Wikimedia Commons API thumb URL +
 *  attribution we fetched. Centralised so we can swap source/attribution
 *  formatting in one place if Commons URL patterns change. */
function wm(url: string, attribution: string, alt: string, dims: { w: number; h: number }, fileSlug: string): SpotImage {
  return {
    url,
    attribution,
    source: "wikimedia",
    source_url: `https://commons.wikimedia.org/wiki/File:${fileSlug}`,
    alt,
    width: dims.w,
    height: dims.h,
  };
}

export const SPOT_MEDIA: Record<string, SpotMedia> = {
  // === Lisbon ===
  "lisbon/miradouro-da-graca": {
    coordinates: { lat: 38.7178, lng: -9.1305 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Vistas_de_Lisboa_desde_Miradouro_da_Gra%C3%A7a%2C_Portugal%2C_2012-05-12%2C_DD_02.JPG/1920px-Vistas_de_Lisboa_desde_Miradouro_da_Gra%C3%A7a%2C_Portugal%2C_2012-05-12%2C_DD_02.JPG", "Diego Delso", "Lisbon panorama from Miradouro da Graça", { w: 1920, h: 1201 }, "Vistas_de_Lisboa_desde_Miradouro_da_Gra%C3%A7a,_Portugal,_2012-05-12,_DD_02.JPG"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Vistas_de_Lisboa_desde_Miradouro_da_Gra%C3%A7a%2C_Portugal%2C_2012-05-12%2C_DD_14.JPG/1920px-Vistas_de_Lisboa_desde_Miradouro_da_Gra%C3%A7a%2C_Portugal%2C_2012-05-12%2C_DD_14.JPG", "Diego Delso", "Wide panorama from Miradouro da Graça", { w: 1920, h: 906 }, "Vistas_de_Lisboa_desde_Miradouro_da_Gra%C3%A7a,_Portugal,_2012-05-12,_DD_14.JPG"),
    ],
  },
  "lisbon/praca-do-comercio": {
    coordinates: { lat: 38.7077, lng: -9.1366 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Arco_Triunfal_da_Rua_Augusta%2C_Plaza_del_Comercio%2C_Lisboa%2C_Portugal%2C_2012-05-12%2C_DD_02.JPG/1920px-Arco_Triunfal_da_Rua_Augusta%2C_Plaza_del_Comercio%2C_Lisboa%2C_Portugal%2C_2012-05-12%2C_DD_02.JPG", "Diego Delso", "Triumphal Arch on Praça do Comércio", { w: 1920, h: 1303 }, "Arco_Triunfal_da_Rua_Augusta,_Plaza_del_Comercio,_Lisboa,_Portugal,_2012-05-12,_DD_02.JPG"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Lissabon_-_Praca_do_Comercio_-_Arcades.jpg/1920px-Lissabon_-_Praca_do_Comercio_-_Arcades.jpg", "Ingo Mehling", "Praça do Comércio yellow arcades", { w: 1329, h: 1920 }, "Lissabon_-_Praca_do_Comercio_-_Arcades.jpg"),
    ],
  },

  // === Porto ===
  "porto/dom-luis-i-bridge": {
    coordinates: { lat: 41.1399, lng: -8.6093 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Puente_Don_Luis_I%2C_Oporto%2C_Portugal%2C_2012-05-09%2C_DD_13.JPG/1920px-Puente_Don_Luis_I%2C_Oporto%2C_Portugal%2C_2012-05-09%2C_DD_13.JPG", "Diego Delso", "Dom Luís I bridge wide view", { w: 1920, h: 1185 }, "Puente_Don_Luis_I,_Oporto,_Portugal,_2012-05-09,_DD_13.JPG"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Puente_de_Don_Luis_I%2C_Oporto%2C_Portugal%2C_2019-06-02%2C_DD_29-31_HDR.jpg/1920px-Puente_de_Don_Luis_I%2C_Oporto%2C_Portugal%2C_2019-06-02%2C_DD_29-31_HDR.jpg", "Diego Delso", "Dom Luís I bridge HDR pano", { w: 1920, h: 957 }, "Puente_de_Don_Luis_I,_Oporto,_Portugal,_2019-06-02,_DD_29-31_HDR.jpg"),
    ],
  },
  "porto/sao-bento-station": {
    coordinates: { lat: 41.1456, lng: -8.6105 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Sao_Bento_train_station_in_Porto_%281%29.jpg/1920px-Sao_Bento_train_station_in_Porto_%281%29.jpg", "Krzysztof Golik", "São Bento station — azulejo hall", { w: 1585, h: 1920 }, "Sao_Bento_train_station_in_Porto_(1).jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Sao_Bento_train_station_in_Porto_%282%29.jpg/1920px-Sao_Bento_train_station_in_Porto_%282%29.jpg", "Krzysztof Golik", "São Bento station — wide tile mural", { w: 1920, h: 1920 }, "Sao_Bento_train_station_in_Porto_(2).jpg"),
    ],
  },
  "porto/serra-do-pilar": {
    coordinates: { lat: 41.1380, lng: -8.6109 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Iglesia_Serra_do_Pilar%2C_Oporto%2C_Portugal%2C_2012-05-09%2C_DD_03.JPG/1920px-Iglesia_Serra_do_Pilar%2C_Oporto%2C_Portugal%2C_2012-05-09%2C_DD_03.JPG", "Diego Delso", "Serra do Pilar monastery", { w: 1920, h: 1349 }, "Iglesia_Serra_do_Pilar,_Oporto,_Portugal,_2012-05-09,_DD_03.JPG"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Mosteiro_da_Serra_do_Pilar_%281%29.jpg/1920px-Mosteiro_da_Serra_do_Pilar_%281%29.jpg", "Krzysztof Golik", "Serra do Pilar — view to Porto", { w: 1920, h: 1138 }, "Mosteiro_da_Serra_do_Pilar_(1).jpg"),
    ],
  },

  // === Sintra ===
  "sintra/national-palace": {
    coordinates: { lat: 38.7975, lng: -9.3905 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Palacio_Nacional%2C_Sintra%2C_Portugal%2C_2019-05-25%2C_DD_15.jpg/1920px-Palacio_Nacional%2C_Sintra%2C_Portugal%2C_2019-05-25%2C_DD_15.jpg", "Diego Delso", "Palácio Nacional twin chimneys", { w: 1920, h: 1773 }, "Palacio_Nacional,_Sintra,_Portugal,_2019-05-25,_DD_15.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Palacio_Nacional%2C_Sintra%2C_Portugal%2C_2019-05-25%2C_DD_89.jpg/1920px-Palacio_Nacional%2C_Sintra%2C_Portugal%2C_2019-05-25%2C_DD_89.jpg", "Diego Delso", "Palácio Nacional view through trees", { w: 1920, h: 1280 }, "Palacio_Nacional,_Sintra,_Portugal,_2019-05-25,_DD_89.jpg"),
    ],
  },
  "sintra/monserrate-palace": {
    coordinates: { lat: 38.8012, lng: -9.4234 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/e/ed/Long_Shot_of_Pal%C3%A1cio_de_Monserrate%2C_Sintra%2C_Portugal.jpg", "Cláudia Almeida", "Monserrate Palace — exterior", { w: 960, h: 643 }, "Long_Shot_of_Pal%C3%A1cio_de_Monserrate,_Sintra,_Portugal.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Pal%C3%A1cio_de_Monserrate_-_Sintra_-_Portugal_%289777878001%29.jpg/1920px-Pal%C3%A1cio_de_Monserrate_-_Sintra_-_Portugal_%289777878001%29.jpg", "Vitor Oliveira", "Monserrate Palace — vertical detail", { w: 1466, h: 1920 }, "Pal%C3%A1cio_de_Monserrate_-_Sintra_-_Portugal_(9777878001).jpg"),
    ],
  },

  // === Cascais ===
  "cascais/boca-do-inferno": {
    coordinates: { lat: 38.6915, lng: -9.4283 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Boca_do_Inferno%2C_Cascais.jpg/1920px-Boca_do_Inferno%2C_Cascais.jpg", "Carlos SGP", "Boca do Inferno — sea cliffs", { w: 1920, h: 887 }, "Boca_do_Inferno,_Cascais.jpg"),
    ],
  },
  "cascais/cascais-marina": {
    coordinates: { lat: 38.6965, lng: -9.4220 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Marina_de_Cascais_%28Portugal%29.jpg/1920px-Marina_de_Cascais_%28Portugal%29.jpg", "Vitor Oliveira", "Cascais Marina", { w: 1920, h: 1440 }, "Marina_de_Cascais_(Portugal).jpg"),
    ],
  },
  "cascais/casa-de-santa-maria": { coordinates: { lat: 38.6926, lng: -9.4235 } },

  // === Madeira ===
  "madeira/cabo-girao": {
    coordinates: { lat: 32.6541, lng: -17.0040 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Steilklippe_Cabo_Girao_-_Madeira.jpg/1920px-Steilklippe_Cabo_Girao_-_Madeira.jpg", "Otto Domes", "Cabo Girão sea cliffs", { w: 1920, h: 1080 }, "Steilklippe_Cabo_Girao_-_Madeira.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/View_from_Miradouro_do_Cabo_Gir%C3%A3o_02.jpg/1920px-View_from_Miradouro_do_Cabo_Gir%C3%A3o_02.jpg", "H. Zell", "View from Cabo Girão skywalk", { w: 1920, h: 1262 }, "View_from_Miradouro_do_Cabo_Gir%C3%A3o_02.jpg"),
    ],
  },
  "madeira/funchal-old-town": {
    coordinates: { lat: 32.6480, lng: -16.9088 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Zona_Velha_do_Funchal%2C_Funchal%2C_Madeira_-_IMG_1151.jpg/1920px-Zona_Velha_do_Funchal%2C_Funchal%2C_Madeira_-_IMG_1151.jpg", "PESP / Wikimedia", "Funchal Old Town painted doors", { w: 1920, h: 1440 }, "Zona_Velha_do_Funchal,_Funchal,_Madeira_-_IMG_1151.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Zona_Velha_do_Funchal%2C_Funchal%2C_Madeira_-_IMG_1152.jpg/1920px-Zona_Velha_do_Funchal%2C_Funchal%2C_Madeira_-_IMG_1152.jpg", "PESP / Wikimedia", "Funchal Old Town alley", { w: 1440, h: 1920 }, "Zona_Velha_do_Funchal,_Funchal,_Madeira_-_IMG_1152.jpg"),
    ],
  },
  "madeira/levada-walks": {
    coordinates: { lat: 32.7484, lng: -16.9579 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Levada%2C_Madeira_%2848807052981%29.jpg/1920px-Levada%2C_Madeira_%2848807052981%29.jpg", "Sebastian from the EU", "Levada walk through laurel forest", { w: 1920, h: 1280 }, "Levada,_Madeira_(48807052981).jpg"),
    ],
  },

  // === Azores (São Miguel) ===
  "azores/sete-cidades": {
    coordinates: { lat: 37.8589, lng: -25.7898 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Lagoa_Rasa_%28Sete_Cidades%29_2.jpg/1920px-Lagoa_Rasa_%28Sete_Cidades%29_2.jpg", "Walmaul", "Lagoa Rasa, Sete Cidades", { w: 1920, h: 1440 }, "Lagoa_Rasa_(Sete_Cidades)_2.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Town_of_Sete_Cidades%2C_S%C3%A3o_Miguel_island%2C_Azores_%28Portugal%29.jpg/1920px-Town_of_Sete_Cidades%2C_S%C3%A3o_Miguel_island%2C_Azores_%28Portugal%29.jpg", "Gonçalo Torres", "Sete Cidades town and lake", { w: 1920, h: 1281 }, "Town_of_Sete_Cidades,_S%C3%A3o_Miguel_island,_Azores_(Portugal).jpg"),
    ],
  },
  "azores/furnas": {
    coordinates: { lat: 37.7716, lng: -25.3185 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Iglesia_de_Nuestra_Se%C3%B1ora_de_la_Alegr%C3%ADa%2C_Furnas%2C_isla_de_San_Miguel%2C_Azores%2C_Portugal%2C_2020-07-29%2C_DD_81.jpg/1920px-Iglesia_de_Nuestra_Se%C3%B1ora_de_la_Alegr%C3%ADa%2C_Furnas%2C_isla_de_San_Miguel%2C_Azores%2C_Portugal%2C_2020-07-29%2C_DD_81.jpg", "Diego Delso", "Furnas village church", { w: 1920, h: 1450 }, "Iglesia_de_Nuestra_Se%C3%B1ora_de_la_Alegr%C3%ADa,_Furnas,_isla_de_San_Miguel,_Azores,_Portugal,_2020-07-29,_DD_81.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Lago_de_Furnas%2C_isla_de_San_Miguel%2C_Azores%2C_Portugal%2C_2020-07-29%2C_DD_52-58_PAN.jpg/1920px-Lago_de_Furnas%2C_isla_de_San_Miguel%2C_Azores%2C_Portugal%2C_2020-07-29%2C_DD_52-58_PAN.jpg", "Diego Delso", "Lago de Furnas panorama", { w: 1920, h: 483 }, "Lago_de_Furnas,_isla_de_San_Miguel,_Azores,_Portugal,_2020-07-29,_DD_52-58_PAN.jpg"),
    ],
  },
  "azores/lagoa-do-fogo": {
    coordinates: { lat: 37.7637, lng: -25.4767 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Lagoa_do_Fogo_2023-02-26-2.jpg/1920px-Lagoa_do_Fogo_2023-02-26-2.jpg", "The Cosmonaut", "Lagoa do Fogo crater lake — vertical", { w: 1280, h: 1920 }, "Lagoa_do_Fogo_2023-02-26-2.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Lagoa_do_Fogo_2023-02-26.jpg/1920px-Lagoa_do_Fogo_2023-02-26.jpg", "The Cosmonaut", "Lagoa do Fogo from rim", { w: 1920, h: 1205 }, "Lagoa_do_Fogo_2023-02-26.jpg"),
    ],
  },

  // === Algarve / Lagos / Tavira ===
  "algarve/ponta-da-piedade": {
    coordinates: { lat: 37.0795, lng: -8.6680 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Farol_Ponta_da_Piedade_02.jpg/1920px-Farol_Ponta_da_Piedade_02.jpg", "Tony Bowden", "Ponta da Piedade lighthouse", { w: 1920, h: 1280 }, "Farol_Ponta_da_Piedade_02.jpg"),
    ],
  },
  "algarve/praia-da-marinha": {
    coordinates: { lat: 37.0902, lng: -8.4108 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Praia_da_Marinha-Algarve-Portugal.jpg/1920px-Praia_da_Marinha-Algarve-Portugal.jpg", "Tobi 87", "Praia da Marinha aerial", { w: 1920, h: 1281 }, "Praia_da_Marinha-Algarve-Portugal.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Praia_da_Marinha_2017.jpg/1920px-Praia_da_Marinha_2017.jpg", "Mimihitam", "Praia da Marinha cliffs", { w: 1920, h: 1280 }, "Praia_da_Marinha_2017.jpg"),
    ],
  },
  "algarve/tavira-island": {
    coordinates: { lat: 37.1175, lng: -7.6473 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Praia_da_Ilha_de_Tavira_-_Portugal_%2816098860429%29.jpg/1920px-Praia_da_Ilha_de_Tavira_-_Portugal_%2816098860429%29.jpg", "Vitor Oliveira", "Praia da Ilha de Tavira", { w: 1920, h: 1252 }, "Praia_da_Ilha_de_Tavira_-_Portugal_(16098860429).jpg"),
    ],
  },
  "lagos/ponta-da-piedade": {
    coordinates: { lat: 37.0795, lng: -8.6680 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Farol_Ponta_da_Piedade_02.jpg/1920px-Farol_Ponta_da_Piedade_02.jpg", "Tony Bowden", "Ponta da Piedade lighthouse", { w: 1920, h: 1280 }, "Farol_Ponta_da_Piedade_02.jpg"),
    ],
  },
  "lagos/praia-do-camilo": {
    coordinates: { lat: 37.0832, lng: -8.6700 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Praia_do_Camilo_-_Lagos_%2848431314177%29.jpg/1920px-Praia_do_Camilo_-_Lagos_%2848431314177%29.jpg", "Theo Crazzolara", "Praia do Camilo wooden stairs", { w: 1920, h: 1280 }, "Praia_do_Camilo_-_Lagos_(48431314177).jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Strand_Praia_do_camilo_Lagos_%2827711818845%29.jpg/1920px-Strand_Praia_do_camilo_Lagos_%2827711818845%29.jpg", "dronepicr", "Praia do Camilo from above", { w: 1920, h: 1280 }, "Strand_Praia_do_camilo_Lagos_(27711818845).jpg"),
    ],
  },
  "lagos/lagos-old-town": {
    coordinates: { lat: 37.1028, lng: -8.6720 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Pra%C3%A7a_Infante_Dom_Henrique%2C_Lagos_MG_9230_%2815251320866%29.jpg/1920px-Pra%C3%A7a_Infante_Dom_Henrique%2C_Lagos_MG_9230_%2815251320866%29.jpg", "Tibor Kovacs", "Praça Infante Dom Henrique, Lagos", { w: 1920, h: 1280 }, "Pra%C3%A7a_Infante_Dom_Henrique,_Lagos_MG_9230_(15251320866).jpg"),
    ],
  },
  // (Tavira entries live further down with their images attached.)

  // === Caparica ===
  "caparica/praia-da-fonte-da-telha": {
    coordinates: { lat: 38.5601, lng: -9.1850 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Caparica_December_2011-1a.jpg/1920px-Caparica_December_2011-1a.jpg", "Alvesgaspar", "Caparica beach panorama", { w: 1920, h: 1224 }, "Caparica_December_2011-1a.jpg"),
    ],
  },
  "caparica/costa-da-caparica-beach": {
    coordinates: { lat: 38.6431, lng: -9.2358 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Caparica_December_2011-1a.jpg/1920px-Caparica_December_2011-1a.jpg", "Alvesgaspar", "Costa da Caparica beach", { w: 1920, h: 1224 }, "Caparica_December_2011-1a.jpg"),
    ],
  },
  "caparica/arriba-fossil": {
    coordinates: { lat: 38.5822, lng: -9.1916 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Caparica_January_2013-1a.jpg/1920px-Caparica_January_2013-1a.jpg", "Alvesgaspar", "Arriba Fóssil Caparica cliffs", { w: 1920, h: 848 }, "Caparica_January_2013-1a.jpg"),
    ],
  },

  // === Setúbal ===
  "setubal/arrabida-natural-park": {
    coordinates: { lat: 38.4937, lng: -8.9836 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Serra_da_Arr%C3%A1bida_vista_do_Creiro._06-18.jpg/1920px-Serra_da_Arr%C3%A1bida_vista_do_Creiro._06-18.jpg", "Rúdisicyon", "Serra da Arrábida from Creiro", { w: 1920, h: 983 }, "Serra_da_Arr%C3%A1bida_vista_do_Creiro._06-18.jpg"),
    ],
  },
  "setubal/troia-peninsula": {
    coordinates: { lat: 38.4811, lng: -8.8943 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Playa_Troia_Mar%2C_Troia%2C_Portugal%2C_2021-09-12%2C_DD_05.jpg/1920px-Playa_Troia_Mar%2C_Troia%2C_Portugal%2C_2021-09-12%2C_DD_05.jpg", "Diego Delso", "Praia de Tróia panorama", { w: 1920, h: 895 }, "Playa_Troia_Mar,_Troia,_Portugal,_2021-09-12,_DD_05.jpg"),
    ],
  },
  "setubal/setubal-harbor": { coordinates: { lat: 38.5244, lng: -8.8882 } },

  // === Comporta ===
  "comporta/comporta-beach": {
    coordinates: { lat: 38.3827, lng: -8.7841 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Playa_de_Comporta%2C_Portugal%2C_2021-09-12%2C_DD_15-26_PAN.jpg/1920px-Playa_de_Comporta%2C_Portugal%2C_2021-09-12%2C_DD_15-26_PAN.jpg", "Diego Delso", "Comporta beach panorama", { w: 1920, h: 387 }, "Playa_de_Comporta,_Portugal,_2021-09-12,_DD_15-26_PAN.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/3/31/Comporta_Beach_in_May_-_panoramio.jpg", "augustoptm", "Comporta beach", { w: 1280, h: 960 }, "Comporta_Beach_in_May_-_panoramio.jpg"),
    ],
  },
  "comporta/rice-paddies": { coordinates: { lat: 38.3937, lng: -8.7634 } },
  "comporta/carvalhal-beach": { coordinates: { lat: 38.2920, lng: -8.7861 } },

  // === Guimarães ===
  "guimaraes/guimaraes-castle": {
    coordinates: { lat: 41.4467, lng: -8.2935 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Castelo_de_Guimaraes_%2816%29.jpg/1920px-Castelo_de_Guimaraes_%2816%29.jpg", "Krzysztof Golik", "Castelo de Guimarães vertical", { w: 1308, h: 1920 }, "Castelo_de_Guimaraes_(16).jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Castelo_de_Guimaraes_%282%29.jpg/1920px-Castelo_de_Guimaraes_%282%29.jpg", "Krzysztof Golik", "Castelo de Guimarães wide view", { w: 1920, h: 1410 }, "Castelo_de_Guimaraes_(2).jpg"),
    ],
  },
  "guimaraes/largo-da-oliveira": {
    coordinates: { lat: 41.4423, lng: -8.2929 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Guimaraes-Largo_da_Oliveira-08-2011-gje.jpg/1920px-Guimaraes-Largo_da_Oliveira-08-2011-gje.jpg", "Gerd Eichmann", "Largo da Oliveira square", { w: 1920, h: 1280 }, "Guimaraes-Largo_da_Oliveira-08-2011-gje.jpg"),
    ],
  },
  "guimaraes/palace-of-the-dukes-of-braganza": {
    coordinates: { lat: 41.4474, lng: -8.2938 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Guimaraes_Portugal_Pa%C3%A7o-dos-Duques-de-Bragan%C3%A7a-02.jpg/1920px-Guimaraes_Portugal_Pa%C3%A7o-dos-Duques-de-Bragan%C3%A7a-02.jpg", "CEphoto, Uwe Aranas", "Paço dos Duques de Bragança", { w: 1920, h: 1280 }, "Guimaraes_Portugal_Pa%C3%A7o-dos-Duques-de-Bragan%C3%A7a-02.jpg"),
    ],
  },

  // === Braga ===
  "braga/bom-jesus-do-monte": {
    coordinates: { lat: 41.5546, lng: -8.3777 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Bom_Jesus_Braga_2022_%2886%29.jpg/1920px-Bom_Jesus_Braga_2022_%2886%29.jpg", "Joseolgon", "Bom Jesus do Monte staircase", { w: 1280, h: 1920 }, "Bom_Jesus_Braga_2022_(86).jpg"),
    ],
  },
  "braga/braga-cathedral": {
    coordinates: { lat: 41.5500, lng: -8.4258 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Braga_Cathedral_%281%29.jpg/1920px-Braga_Cathedral_%281%29.jpg", "Krzysztof Golik", "Sé de Braga exterior", { w: 1392, h: 1920 }, "Braga_Cathedral_(1).jpg"),
    ],
  },
  "braga/jardim-de-santa-barbara": {
    coordinates: { lat: 41.5515, lng: -8.4254 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Braga%2C_Jardim_de_Santa_Barbara_%281%29.jpg/1920px-Braga%2C_Jardim_de_Santa_Barbara_%281%29.jpg", "Palickap", "Jardim de Santa Bárbara, Braga", { w: 1920, h: 1440 }, "Braga,_Jardim_de_Santa_Barbara_(1).jpg"),
    ],
  },

  // === Douro Valley ===
  "douro-valley/pinhao": {
    coordinates: { lat: 41.1909, lng: -7.5470 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Cycling_tour%2C_Pinh%C3%A3o%2C_Douro_Valley%2C_Portugal_01.jpg/1920px-Cycling_tour%2C_Pinh%C3%A3o%2C_Douro_Valley%2C_Portugal_01.jpg", "sanjorgepinho", "Pinhão riverbank", { w: 1920, h: 1440 }, "Cycling_tour,_Pinh%C3%A3o,_Douro_Valley,_Portugal_01.jpg"),
    ],
  },
  "douro-valley/miradouro-de-sao-leonardo-de-galafura": { coordinates: { lat: 41.1722, lng: -7.5944 } },
  "douro-valley/quinta-da-roeda": { coordinates: { lat: 41.1849, lng: -7.5512 } },

  // === Aveiro ===
  "aveiro/central-canal": {
    coordinates: { lat: 40.6406, lng: -8.6537 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Canal_in_Aveiro_05.jpg/1920px-Canal_in_Aveiro_05.jpg", "John Samuel", "Aveiro central canal with moliceiros", { w: 1920, h: 1280 }, "Canal_in_Aveiro_05.jpg"),
    ],
  },
  "aveiro/costa-nova": {
    coordinates: { lat: 40.6147, lng: -8.7470 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Jules_at_Costa_Nova_Beach%2C_Aveiro%2C_Portugal_julesvernex2.jpg/1920px-Jules_at_Costa_Nova_Beach%2C_Aveiro%2C_Portugal_julesvernex2.jpg", "Jules Verne Times Two", "Costa Nova striped houses", { w: 1276, h: 1920 }, "Jules_at_Costa_Nova_Beach,_Aveiro,_Portugal_julesvernex2.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Molhe_da_Meia_Laranja_-_Costa_Nova_-_Portugal.jpg/1920px-Molhe_da_Meia_Laranja_-_Costa_Nova_-_Portugal.jpg", "Otto Domes", "Costa Nova breakwater", { w: 1920, h: 1281 }, "Molhe_da_Meia_Laranja_-_Costa_Nova_-_Portugal.jpg"),
    ],
  },
  "aveiro/ria-de-aveiro-lagoon": { coordinates: { lat: 40.6406, lng: -8.7000 } },

  // === Tomar ===
  "tomar/convent-of-christ": {
    coordinates: { lat: 39.6035, lng: -8.4178 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Convento_Cristo_December_2008-2a.jpg/1920px-Convento_Cristo_December_2008-2a.jpg", "Alvesgaspar", "Convent of Christ exterior", { w: 1335, h: 1920 }, "Convento_Cristo_December_2008-2a.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Convento_Cristo_December_2008-8.jpg/1920px-Convento_Cristo_December_2008-8.jpg", "Alvesgaspar", "Convent of Christ Manueline window", { w: 1920, h: 1257 }, "Convento_Cristo_December_2008-8.jpg"),
    ],
  },
  "tomar/nabao-river-gardens": { coordinates: { lat: 39.6024, lng: -8.4097 } },
  "tomar/mata-nacional-dos-sete-montes": { coordinates: { lat: 39.5993, lng: -8.4205 } },

  // === Peniche ===
  "peniche/cabo-carvoeiro": {
    coordinates: { lat: 39.3604, lng: -9.4080 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/2025-12-19_Cabo_Carvoeiro_Lighthouse_1.jpg/1920px-2025-12-19_Cabo_Carvoeiro_Lighthouse_1.jpg", "Alexkom000", "Cabo Carvoeiro lighthouse at dusk", { w: 1920, h: 1280 }, "2025-12-19_Cabo_Carvoeiro_Lighthouse_1.jpg"),
    ],
  },
  "peniche/supertubos-beach": { coordinates: { lat: 39.3398, lng: -9.3573 } },
  "peniche/berlengas-islands": {
    coordinates: { lat: 39.4117, lng: -9.5117 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Peniche_September_2023-4.jpg/1920px-Peniche_September_2023-4.jpg", "Alvesgaspar", "Peniche coast — Berlengas direction", { w: 1920, h: 1257 }, "Peniche_September_2023-4.jpg"),
    ],
  },

  // === Coimbra ===
  "coimbra/joanina-library": {
    coordinates: { lat: 40.2078, lng: -8.4259 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Portal_of_Biblioteca_Joanina_01.jpg/1920px-Portal_of_Biblioteca_Joanina_01.jpg", "Bernard Gagnon", "Biblioteca Joanina portal", { w: 1372, h: 1920 }, "Portal_of_Biblioteca_Joanina_01.jpg"),
    ],
  },
  "coimbra/university-tower": {
    coordinates: { lat: 40.2074, lng: -8.4262 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Coimbra_University_Tower_2.jpg/1920px-Coimbra_University_Tower_2.jpg", "Elapsed", "Coimbra University Tower", { w: 1920, h: 1430 }, "Coimbra_University_Tower_2.jpg"),
    ],
  },
  "coimbra/quinta-das-lagrimas": { coordinates: { lat: 40.2008, lng: -8.4348 } },

  // === Óbidos ===
  "obidos/castle-walls": {
    coordinates: { lat: 39.3614, lng: -9.1577 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/The_%C3%93bidos%27_Castle_%284017081137%29.jpg/1920px-The_%C3%93bidos%27_Castle_%284017081137%29.jpg", "Pedro Ribeiro Simões", "Óbidos castle walls", { w: 1920, h: 1178 }, "The_%C3%93bidos'_Castle_(4017081137).jpg"),
    ],
  },
  "obidos/rua-direita": {
    coordinates: { lat: 39.3614, lng: -9.1572 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Portugal_%28Obidos%29_Picturesque_town_with_cobbled_streets_and_traditional_painted_houses_%2836049221615%29.jpg/1920px-Portugal_%28Obidos%29_Picturesque_town_with_cobbled_streets_and_traditional_painted_houses_%2836049221615%29.jpg", "Güldem Üstün", "Óbidos cobbled streets", { w: 1920, h: 1609 }, "Portugal_(Obidos)_Picturesque_town_with_cobbled_streets_and_traditional_painted_houses_(36049221615).jpg"),
    ],
  },
  "obidos/porta-da-vila": { coordinates: { lat: 39.3604, lng: -9.1568 } },

  // === Nazaré ===
  "nazare/sitio": {
    coordinates: { lat: 39.6082, lng: -9.0735 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/7/7f/Miradouro_do_Suberco_Nazar%C3%A9_04.jpg", "GualdimG", "Miradouro do Suberco, Sítio (Nazaré)", { w: 1848, h: 1386 }, "Miradouro_do_Suberco_Nazar%C3%A9_04.jpg"),
    ],
  },
  "nazare/farol-da-nazare": {
    coordinates: { lat: 39.6045, lng: -9.0846 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Nazaré_Lighthouse.jpg/1920px-Nazaré_Lighthouse.jpg", "Luís Filipe Alves Gaspar", "Farol da Nazaré", { w: 1920, h: 1440 }, "Nazaré_Lighthouse.jpg"),
    ],
  },
  "nazare/praia-da-nazare": { coordinates: { lat: 39.6022, lng: -9.0735 } },

  // === Évora ===
  "evora/temple-of-diana": {
    coordinates: { lat: 38.5727, lng: -7.9069 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/8/8e/Templo-diana-evora-portugal.jpg", "FDV", "Templo de Diana, Évora", { w: 1920, h: 1280 }, "Templo-diana-evora-portugal.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Templo_de_Diana_%28%C3%89vora%29.jpg/1920px-Templo_de_Diana_%28%C3%89vora%29.jpg", "Eugenio Hansen", "Templo de Diana — vertical view", { w: 1080, h: 1920 }, "Templo_de_Diana_(%C3%89vora).jpg"),
    ],
  },
  "evora/chapel-of-bones": {
    coordinates: { lat: 38.5701, lng: -7.9078 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Evora_-_Chapel_of_Bones_-_Column_-_2.jpg/1920px-Evora_-_Chapel_of_Bones_-_Column_-_2.jpg", "Ingo Mehling", "Capela dos Ossos column", { w: 1280, h: 1920 }, "Evora_-_Chapel_of_Bones_-_Column_-_2.jpg"),
    ],
  },
  "evora/evora-cathedral-rooftop": { coordinates: { lat: 38.5717, lng: -7.9075 } },
  "evora/roman-bridge": { coordinates: { lat: 38.5640, lng: -7.9050 } },

  // === Tavira ===
  "tavira/tavira-castle": {
    coordinates: { lat: 37.1267, lng: -7.6499 },
    images: [
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Vista_de_Tavira%2C_Algarve_-_26.12.2018.jpg/1920px-Vista_de_Tavira%2C_Algarve_-_26.12.2018.jpg", "Bextrel", "Vista de Tavira", { w: 1920, h: 1071 }, "Vista_de_Tavira,_Algarve_-_26.12.2018.jpg"),
      wm("https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Castle_gardens%2C_Tavira%2CPortugal._%2814419985419%29.jpg/1920px-Castle_gardens%2C_Tavira%2CPortugal._%2814419985419%29.jpg", "GanMed64", "Tavira castle gardens", { w: 1440, h: 1920 }, "Castle_gardens,_Tavira,Portugal._(14419985419).jpg"),
    ],
  },
  "tavira/ria-formosa-lagoon": { coordinates: { lat: 37.0900, lng: -7.6900 } },

  // === Gerês ===
  "geres/cascata-do-tahiti": { coordinates: { lat: 41.7340, lng: -8.1980 } },
  "geres/canicada-reservoir": { coordinates: { lat: 41.6960, lng: -8.1830 } },
  "geres/lindoso-village": { coordinates: { lat: 41.8678, lng: -8.1956 } },
};
