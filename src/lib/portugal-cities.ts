/**
 * Portugal cities seed data for the location-zone prototype.
 *
 * This is a STARTER list focused on the cities tourists actually
 * shoot in (capitals + Algarve coast + island towns + Porto / Douro
 * + Sintra-Cascais axis + a few Alentejo gems). The full ~308
 * municipalities will be loaded from an open dataset later — for the
 * polygon-drawing prototype we only need enough density to feel real.
 *
 * Coordinates are city-centre approximations (good enough for
 * point-in-polygon checks at the country zoom level we draw at).
 */

export type CityRegion =
  | "lisboa"
  | "porto"
  | "algarve"
  | "centro"
  | "alentejo"
  | "norte"
  | "madeira"
  | "azores";

export interface PortugalCity {
  slug: string;
  name: string;
  region: CityRegion;
  lat: number;
  lng: number;
}

export const PORTUGAL_CITIES: PortugalCity[] = [
  // Lisboa region
  { slug: "lisbon", name: "Lisbon", region: "lisboa", lat: 38.7223, lng: -9.1393 },
  { slug: "sintra", name: "Sintra", region: "lisboa", lat: 38.8029, lng: -9.3817 },
  { slug: "cascais", name: "Cascais", region: "lisboa", lat: 38.6979, lng: -9.4215 },
  { slug: "estoril", name: "Estoril", region: "lisboa", lat: 38.7053, lng: -9.3973 },
  { slug: "oeiras", name: "Oeiras", region: "lisboa", lat: 38.6877, lng: -9.3093 },
  { slug: "amadora", name: "Amadora", region: "lisboa", lat: 38.7536, lng: -9.2302 },
  { slug: "almada", name: "Almada", region: "lisboa", lat: 38.6803, lng: -9.1582 },
  { slug: "setubal", name: "Setúbal", region: "lisboa", lat: 38.5244, lng: -8.8882 },
  { slug: "sesimbra", name: "Sesimbra", region: "lisboa", lat: 38.4439, lng: -9.1018 },
  { slug: "ericeira", name: "Ericeira", region: "lisboa", lat: 38.9636, lng: -9.4154 },
  { slug: "mafra", name: "Mafra", region: "lisboa", lat: 38.9377, lng: -9.3274 },
  { slug: "comporta", name: "Comporta", region: "lisboa", lat: 38.3849, lng: -8.7852 },
  { slug: "azenhas-do-mar", name: "Azenhas do Mar", region: "lisboa", lat: 38.8497, lng: -9.4583 },

  // Porto region
  { slug: "porto", name: "Porto", region: "porto", lat: 41.1579, lng: -8.6291 },
  { slug: "vila-nova-de-gaia", name: "Vila Nova de Gaia", region: "porto", lat: 41.1239, lng: -8.6118 },
  { slug: "matosinhos", name: "Matosinhos", region: "porto", lat: 41.1844, lng: -8.6915 },
  { slug: "maia", name: "Maia", region: "porto", lat: 41.2278, lng: -8.6225 },
  { slug: "povoa-de-varzim", name: "Póvoa de Varzim", region: "porto", lat: 41.3801, lng: -8.7651 },

  // Norte
  { slug: "braga", name: "Braga", region: "norte", lat: 41.5454, lng: -8.4265 },
  { slug: "guimaraes", name: "Guimarães", region: "norte", lat: 41.4419, lng: -8.2918 },
  { slug: "viana-do-castelo", name: "Viana do Castelo", region: "norte", lat: 41.6932, lng: -8.8326 },
  { slug: "barcelos", name: "Barcelos", region: "norte", lat: 41.5388, lng: -8.6151 },
  { slug: "ponte-de-lima", name: "Ponte de Lima", region: "norte", lat: 41.7669, lng: -8.5832 },
  { slug: "amarante", name: "Amarante", region: "norte", lat: 41.2700, lng: -8.0810 },
  { slug: "lamego", name: "Lamego", region: "norte", lat: 41.0989, lng: -7.8104 },
  { slug: "vila-real", name: "Vila Real", region: "norte", lat: 41.3001, lng: -7.7437 },
  { slug: "braganca", name: "Bragança", region: "norte", lat: 41.8061, lng: -6.7567 },
  { slug: "peso-da-regua", name: "Peso da Régua", region: "norte", lat: 41.1614, lng: -7.7888 },
  { slug: "pinhao", name: "Pinhão", region: "norte", lat: 41.1869, lng: -7.5468 },

  // Centro
  { slug: "coimbra", name: "Coimbra", region: "centro", lat: 40.2033, lng: -8.4103 },
  { slug: "aveiro", name: "Aveiro", region: "centro", lat: 40.6443, lng: -8.6455 },
  { slug: "viseu", name: "Viseu", region: "centro", lat: 40.6610, lng: -7.9097 },
  { slug: "leiria", name: "Leiria", region: "centro", lat: 39.7437, lng: -8.8071 },
  { slug: "obidos", name: "Óbidos", region: "centro", lat: 39.3608, lng: -9.1574 },
  { slug: "nazare", name: "Nazaré", region: "centro", lat: 39.6018, lng: -9.0703 },
  { slug: "fatima", name: "Fátima", region: "centro", lat: 39.6168, lng: -8.6532 },
  { slug: "tomar", name: "Tomar", region: "centro", lat: 39.6028, lng: -8.4099 },
  { slug: "alcobaca", name: "Alcobaça", region: "centro", lat: 39.5517, lng: -8.9779 },
  { slug: "batalha", name: "Batalha", region: "centro", lat: 39.6585, lng: -8.8252 },
  { slug: "peniche", name: "Peniche", region: "centro", lat: 39.3556, lng: -9.3811 },
  { slug: "figueira-da-foz", name: "Figueira da Foz", region: "centro", lat: 40.1502, lng: -8.8610 },
  { slug: "monsanto", name: "Monsanto", region: "centro", lat: 40.0359, lng: -7.1140 },
  { slug: "covilha", name: "Covilhã", region: "centro", lat: 40.2806, lng: -7.5036 },

  // Alentejo
  { slug: "evora", name: "Évora", region: "alentejo", lat: 38.5713, lng: -7.9135 },
  { slug: "marvao", name: "Marvão", region: "alentejo", lat: 39.3937, lng: -7.3768 },
  { slug: "monsaraz", name: "Monsaraz", region: "alentejo", lat: 38.4441, lng: -7.3818 },
  { slug: "elvas", name: "Elvas", region: "alentejo", lat: 38.8830, lng: -7.1633 },
  { slug: "beja", name: "Beja", region: "alentejo", lat: 38.0150, lng: -7.8651 },
  { slug: "portalegre", name: "Portalegre", region: "alentejo", lat: 39.2967, lng: -7.4309 },
  { slug: "sines", name: "Sines", region: "alentejo", lat: 37.9559, lng: -8.8694 },

  // Algarve
  { slug: "faro", name: "Faro", region: "algarve", lat: 37.0193, lng: -7.9304 },
  { slug: "lagos", name: "Lagos", region: "algarve", lat: 37.1028, lng: -8.6738 },
  { slug: "albufeira", name: "Albufeira", region: "algarve", lat: 37.0891, lng: -8.2475 },
  { slug: "portimao", name: "Portimão", region: "algarve", lat: 37.1366, lng: -8.5378 },
  { slug: "tavira", name: "Tavira", region: "algarve", lat: 37.1287, lng: -7.6500 },
  { slug: "loule", name: "Loulé", region: "algarve", lat: 37.1389, lng: -8.0224 },
  { slug: "silves", name: "Silves", region: "algarve", lat: 37.1893, lng: -8.4382 },
  { slug: "olhao", name: "Olhão", region: "algarve", lat: 37.0265, lng: -7.8418 },
  { slug: "vila-real-de-santo-antonio", name: "Vila Real de Santo António", region: "algarve", lat: 37.1948, lng: -7.4170 },
  { slug: "sagres", name: "Sagres", region: "algarve", lat: 37.0099, lng: -8.9388 },
  { slug: "monchique", name: "Monchique", region: "algarve", lat: 37.3185, lng: -8.5536 },
  { slug: "carvoeiro", name: "Carvoeiro", region: "algarve", lat: 37.0978, lng: -8.4719 },
  { slug: "alvor", name: "Alvor", region: "algarve", lat: 37.1278, lng: -8.5904 },

  // Madeira
  { slug: "funchal", name: "Funchal", region: "madeira", lat: 32.6669, lng: -16.9241 },
  { slug: "machico", name: "Machico", region: "madeira", lat: 32.7184, lng: -16.7720 },
  { slug: "santana", name: "Santana", region: "madeira", lat: 32.8019, lng: -16.8830 },
  { slug: "porto-moniz", name: "Porto Moniz", region: "madeira", lat: 32.8666, lng: -17.1689 },
  { slug: "ribeira-brava", name: "Ribeira Brava", region: "madeira", lat: 32.6741, lng: -17.0658 },

  // Azores
  { slug: "ponta-delgada", name: "Ponta Delgada", region: "azores", lat: 37.7394, lng: -25.6680 },
  { slug: "angra-do-heroismo", name: "Angra do Heroísmo", region: "azores", lat: 38.6553, lng: -27.2185 },
  { slug: "horta", name: "Horta", region: "azores", lat: 38.5359, lng: -28.6263 },
  { slug: "ribeira-grande", name: "Ribeira Grande", region: "azores", lat: 37.8217, lng: -25.5152 },
];
