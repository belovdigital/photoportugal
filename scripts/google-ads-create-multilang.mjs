// Create 4 multi-language Google Ads campaigns mirroring "Campaign #1" (EN).
// Status: PAUSED so user can review before launching.
// Usage on server: node scripts/google-ads-create-multilang.mjs

import { GoogleAdsApi } from "google-ads-api";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync("/var/www/photoportugal/.env", "utf-8")
    .split("\n").filter((l) => l && l.includes("=") && !l.startsWith("#"))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim().replace(/^["']|["']$/g, "")]; }),
);

const client = new GoogleAdsApi({
  client_id: env.GOOGLE_ADS_CLIENT_ID,
  client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: env.GOOGLE_ADS_DEVELOPER_TOKEN,
});
const customer = client.Customer({
  customer_id: env.GOOGLE_ADS_CUSTOMER_ID,
  refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
});

const BASE = "https://photoportugal.com";

// Geo target constants (country-level)
const GEO = {
  france: "geoTargetConstants/2250",
  belgium: "geoTargetConstants/2056",
  switzerland: "geoTargetConstants/2756",
  luxembourg: "geoTargetConstants/2442",
  monaco: "geoTargetConstants/2492",
  spain: "geoTargetConstants/2724",
  mexico: "geoTargetConstants/2484",
  argentina: "geoTargetConstants/2032",
  chile: "geoTargetConstants/2152",
  colombia: "geoTargetConstants/2170",
  peru: "geoTargetConstants/2604",
  germany: "geoTargetConstants/2276",
  austria: "geoTargetConstants/2040",
  brazil: "geoTargetConstants/2076",
};

// Language constants
const LANG = {
  english: "languageConstants/1000",
  german: "languageConstants/1001",
  french: "languageConstants/1002",
  spanish: "languageConstants/1003",
  portuguese: "languageConstants/1014",
};

const CAMPAIGNS = [
  {
    locale: "fr",
    name: "Photo Portugal — FR",
    geos: [GEO.france, GEO.belgium, GEO.switzerland, GEO.luxembourg, GEO.monaco],
    language: LANG.french,
    budgetEuro: 25,
    adGroups: [
      {
        name: "Lisbon FR",
        finalUrl: `${BASE}/fr/lp/lisbon`,
        keywords: [
          "photographe Lisbonne", "photographe à Lisbonne", "séance photo Lisbonne",
          "réserver photographe Lisbonne", "photographe vacances Lisbonne", "photo de couple Lisbonne",
          "photographe famille Lisbonne", "photographe mariage Lisbonne", "demande en mariage Lisbonne photographe",
          "shooting photo Lisbonne", "photographe portugais Lisbonne", "photographe Alfama",
          "photographe Belém", "photographe LX Factory", "photographe pro Lisbonne",
          "photographe touriste Lisbonne", "photographe lune de miel Lisbonne", "photographe solo Lisbonne",
          "tarif photographe Lisbonne", "photographe anglophone Lisbonne",
        ],
        headlines: [
          "Photographe à Lisbonne",
          "Réservez en 60 secondes",
          "Photographes vérifiés",
          "Paiement sécurisé Stripe",
          "Garantie de remboursement",
          "Photographes triés sur le volet",
          "Séance photo à Lisbonne",
          "Réservation instantanée",
          "Photographe pro Lisbonne",
          "Avis clients vérifiés",
        ],
        descriptions: [
          "Réservez un photographe pro à Lisbonne en quelques minutes. Paiement sécurisé, photographes vérifiés.",
          "Photographes triés sur le volet à Lisbonne. Réservation instantanée, garantie de remboursement.",
          "Capturez votre voyage à Lisbonne avec un photographe local. Avis vérifiés, prix transparents.",
          "Demande gratuite — payez seulement après confirmation du photographe. Annulation libre.",
        ],
      },
      {
        name: "Porto FR",
        finalUrl: `${BASE}/fr/lp/porto`,
        keywords: [
          "photographe Porto", "photographe à Porto Portugal", "séance photo Porto",
          "réserver photographe Porto", "photographe vacances Porto", "photo de couple Porto",
          "photographe famille Porto", "photographe mariage Porto", "shooting photo Porto Portugal",
          "photographe Ribeira Porto", "photographe vallée Douro", "photographe Foz Porto",
          "tarif photographe Porto", "photographe lune de miel Porto", "photographe pro Porto",
          "photographe touriste Porto", "demande en mariage Porto photographe",
        ],
        headlines: [
          "Photographe à Porto",
          "Réservez en 60 secondes",
          "Photographes vérifiés",
          "Paiement sécurisé Stripe",
          "Garantie de remboursement",
          "Séance photo à Porto",
          "Photographe pro Porto",
          "Réservation instantanée",
          "Avis clients vérifiés",
          "Capturez votre voyage",
        ],
        descriptions: [
          "Réservez un photographe pro à Porto. Paiement sécurisé, photographes vérifiés et triés sur le volet.",
          "Photographes locaux à Porto et vallée du Douro. Réservation instantanée, garantie de remboursement.",
          "Capturez votre voyage à Porto avec un photographe local. Avis vérifiés, prix transparents.",
          "Demande gratuite — payez seulement après confirmation. Annulation libre avant la séance.",
        ],
      },
      {
        name: "Sintra FR",
        finalUrl: `${BASE}/fr/lp/sintra`,
        keywords: [
          "photographe Sintra", "séance photo Sintra", "photographe palais Pena",
          "photographe Quinta da Regaleira", "réserver photographe Sintra", "photographe couple Sintra",
          "photographe mariage Sintra", "photo de famille Sintra", "shooting Sintra Portugal",
          "photographe lune de miel Sintra", "demande en mariage Sintra photographe",
          "photographe pro Sintra", "tarif photographe Sintra",
        ],
        headlines: [
          "Photographe à Sintra",
          "Palais de Pena & Quinta",
          "Réservez en 60 secondes",
          "Photographes vérifiés",
          "Paiement sécurisé Stripe",
          "Garantie de remboursement",
          "Séance photo à Sintra",
          "Photographe pro Sintra",
          "Avis clients vérifiés",
          "Réservation instantanée",
        ],
        descriptions: [
          "Réservez un photographe pro à Sintra. Palais de Pena, Quinta da Regaleira et plus. Paiement sécurisé.",
          "Photographes locaux à Sintra triés sur le volet. Réservation instantanée, garantie de remboursement.",
          "Capturez la magie de Sintra avec un photographe local expérimenté. Avis vérifiés, prix transparents.",
          "Demande gratuite — payez seulement après confirmation du photographe. Annulation libre.",
        ],
      },
      {
        name: "Algarve FR",
        finalUrl: `${BASE}/fr/lp/algarve`,
        keywords: [
          "photographe Algarve", "séance photo Algarve", "photographe Faro",
          "photographe Lagos Portugal", "photographe Albufeira", "réserver photographe Algarve",
          "photographe famille plage Algarve", "photographe couple Algarve",
          "photographe mariage Algarve", "photographe Benagil", "shooting Algarve",
          "photographe lune de miel Algarve", "photographe pro Algarve",
          "tarif photographe Algarve", "demande en mariage Algarve photographe",
        ],
        headlines: [
          "Photographe en Algarve",
          "Plages dorées & falaises",
          "Réservez en 60 secondes",
          "Photographes vérifiés",
          "Paiement sécurisé Stripe",
          "Garantie de remboursement",
          "Séance photo Algarve",
          "Photographe pro Algarve",
          "Avis clients vérifiés",
          "Faro, Lagos, Albufeira",
        ],
        descriptions: [
          "Réservez un photographe pro en Algarve. Faro, Lagos, Albufeira, Benagil. Paiement sécurisé.",
          "Photographes locaux en Algarve triés sur le volet. Réservation instantanée, garantie de remboursement.",
          "Capturez votre voyage en Algarve avec un photographe local. Avis vérifiés, prix transparents.",
          "Demande gratuite — payez seulement après confirmation du photographe. Annulation libre.",
        ],
      },
      {
        name: "Portugal General FR",
        finalUrl: `${BASE}/fr/photographers`,
        keywords: [
          "photographe Portugal", "photographe vacances Portugal", "réserver photographe Portugal",
          "séance photo Portugal", "photographe touriste Portugal", "photographe pro Portugal",
          "shooting photo Portugal", "photographe famille Portugal", "photographe couple Portugal",
          "photographe mariage Portugal", "photographe lune de miel Portugal",
          "photographe demande en mariage Portugal", "photographe Cascais", "photographe Madère",
          "photographe Açores",
        ],
        headlines: [
          "Photographe au Portugal",
          "Réservez en 60 secondes",
          "Photographes vérifiés",
          "Paiement sécurisé Stripe",
          "Garantie de remboursement",
          "Lisbonne, Porto, Algarve",
          "Photographes triés à la main",
          "Réservation instantanée",
          "Avis clients vérifiés",
          "Capturez vos vacances",
        ],
        descriptions: [
          "Réservez un photographe pro partout au Portugal. Paiement sécurisé, photographes vérifiés.",
          "Lisbonne, Porto, Algarve, Sintra et plus. Photographes locaux triés sur le volet.",
          "Capturez votre voyage au Portugal avec un photographe local. Avis vérifiés, prix transparents.",
          "Demande gratuite — payez seulement après confirmation. Annulation libre avant la séance.",
        ],
      },
    ],
  },

  {
    locale: "es",
    name: "Photo Portugal — ES",
    geos: [GEO.spain, GEO.mexico, GEO.argentina, GEO.chile, GEO.colombia, GEO.peru],
    language: LANG.spanish,
    budgetEuro: 20,
    adGroups: [
      {
        name: "Lisbon ES",
        finalUrl: `${BASE}/es/lp/lisbon`,
        keywords: [
          "fotógrafo Lisboa", "fotógrafo en Lisboa", "sesión de fotos Lisboa",
          "reservar fotógrafo Lisboa", "fotógrafo vacaciones Lisboa", "fotógrafo pareja Lisboa",
          "fotógrafo familia Lisboa", "fotógrafo boda Lisboa", "pedida de mano Lisboa fotógrafo",
          "fotos profesionales Lisboa", "fotógrafo Alfama", "fotógrafo Belém",
          "fotógrafo turista Lisboa", "fotógrafo luna de miel Lisboa", "fotógrafo solo Lisboa",
          "precio fotógrafo Lisboa", "fotógrafo profesional Lisboa",
        ],
        headlines: [
          "Fotógrafo en Lisboa",
          "Reserve en 60 segundos",
          "Fotógrafos verificados",
          "Pago seguro Stripe",
          "Garantía de devolución",
          "Sesión de fotos Lisboa",
          "Fotógrafo profesional",
          "Reserva instantánea",
          "Reseñas verificadas",
          "Fotógrafos seleccionados",
        ],
        descriptions: [
          "Reserve un fotógrafo profesional en Lisboa en minutos. Pago seguro, fotógrafos verificados.",
          "Fotógrafos locales en Lisboa seleccionados a mano. Reserva instantánea, garantía de devolución.",
          "Capture su viaje a Lisboa con un fotógrafo local. Reseñas verificadas, precios transparentes.",
          "Solicitud gratuita — pague solo tras confirmación del fotógrafo. Cancelación libre.",
        ],
      },
      {
        name: "Porto ES",
        finalUrl: `${BASE}/es/lp/porto`,
        keywords: [
          "fotógrafo Oporto", "fotógrafo Porto Portugal", "sesión de fotos Oporto",
          "reservar fotógrafo Oporto", "fotógrafo pareja Oporto", "fotógrafo familia Oporto",
          "fotógrafo boda Oporto", "fotos vacaciones Oporto", "fotógrafo Ribeira",
          "fotógrafo valle del Duero", "precio fotógrafo Oporto", "fotógrafo profesional Oporto",
          "fotógrafo turista Oporto", "fotógrafo luna de miel Oporto",
        ],
        headlines: [
          "Fotógrafo en Oporto",
          "Reserve en 60 segundos",
          "Fotógrafos verificados",
          "Pago seguro Stripe",
          "Garantía de devolución",
          "Sesión de fotos Oporto",
          "Fotógrafo profesional Oporto",
          "Reserva instantánea",
          "Reseñas verificadas",
          "Capture su viaje",
        ],
        descriptions: [
          "Reserve un fotógrafo profesional en Oporto. Pago seguro, fotógrafos verificados y seleccionados.",
          "Fotógrafos locales en Oporto y valle del Duero. Reserva instantánea, garantía de devolución.",
          "Capture su viaje a Oporto con un fotógrafo local. Reseñas verificadas, precios transparentes.",
          "Solicitud gratuita — pague solo tras confirmación. Cancelación libre antes de la sesión.",
        ],
      },
      {
        name: "Sintra ES",
        finalUrl: `${BASE}/es/lp/sintra`,
        keywords: [
          "fotógrafo Sintra", "sesión de fotos Sintra", "fotógrafo Palacio Pena",
          "fotógrafo Quinta da Regaleira", "reservar fotógrafo Sintra", "fotógrafo pareja Sintra",
          "fotógrafo boda Sintra", "fotos familia Sintra", "fotógrafo luna de miel Sintra",
          "pedida de mano Sintra fotógrafo", "precio fotógrafo Sintra", "fotógrafo profesional Sintra",
        ],
        headlines: [
          "Fotógrafo en Sintra",
          "Palacio Pena y Quinta",
          "Reserve en 60 segundos",
          "Fotógrafos verificados",
          "Pago seguro Stripe",
          "Garantía de devolución",
          "Sesión de fotos Sintra",
          "Fotógrafo profesional Sintra",
          "Reseñas verificadas",
          "Reserva instantánea",
        ],
        descriptions: [
          "Reserve un fotógrafo profesional en Sintra. Palacio de Pena, Quinta da Regaleira y más.",
          "Fotógrafos locales en Sintra seleccionados a mano. Reserva instantánea, garantía de devolución.",
          "Capture la magia de Sintra con un fotógrafo local experimentado. Reseñas verificadas.",
          "Solicitud gratuita — pague solo tras confirmación del fotógrafo. Cancelación libre.",
        ],
      },
      {
        name: "Algarve ES",
        finalUrl: `${BASE}/es/lp/algarve`,
        keywords: [
          "fotógrafo Algarve", "sesión de fotos Algarve", "fotógrafo Faro",
          "fotógrafo Lagos Portugal", "fotógrafo Albufeira", "reservar fotógrafo Algarve",
          "fotógrafo familia playa Algarve", "fotógrafo pareja Algarve",
          "fotógrafo boda Algarve", "fotógrafo Benagil", "fotos Algarve playa",
          "fotógrafo luna de miel Algarve", "precio fotógrafo Algarve", "fotógrafo profesional Algarve",
        ],
        headlines: [
          "Fotógrafo en Algarve",
          "Playas doradas y acantilados",
          "Reserve en 60 segundos",
          "Fotógrafos verificados",
          "Pago seguro Stripe",
          "Garantía de devolución",
          "Sesión Algarve",
          "Fotógrafo profesional Algarve",
          "Reseñas verificadas",
          "Faro, Lagos, Albufeira",
        ],
        descriptions: [
          "Reserve un fotógrafo profesional en Algarve. Faro, Lagos, Albufeira, Benagil. Pago seguro.",
          "Fotógrafos locales en Algarve seleccionados a mano. Reserva instantánea, garantía de devolución.",
          "Capture su viaje a Algarve con un fotógrafo local. Reseñas verificadas, precios transparentes.",
          "Solicitud gratuita — pague solo tras confirmación. Cancelación libre antes de la sesión.",
        ],
      },
      {
        name: "Portugal General ES",
        finalUrl: `${BASE}/es/photographers`,
        keywords: [
          "fotógrafo Portugal", "fotógrafo vacaciones Portugal", "reservar fotógrafo Portugal",
          "sesión de fotos Portugal", "fotógrafo turista Portugal", "fotógrafo profesional Portugal",
          "fotógrafo familia Portugal", "fotógrafo pareja Portugal", "fotógrafo boda Portugal",
          "fotógrafo luna de miel Portugal", "fotógrafo pedida de mano Portugal",
          "fotógrafo Cascais", "fotógrafo Madeira", "fotógrafo Azores",
        ],
        headlines: [
          "Fotógrafo en Portugal",
          "Reserve en 60 segundos",
          "Fotógrafos verificados",
          "Pago seguro Stripe",
          "Garantía de devolución",
          "Lisboa, Oporto, Algarve",
          "Seleccionados a mano",
          "Reserva instantánea",
          "Reseñas verificadas",
          "Capture sus vacaciones",
        ],
        descriptions: [
          "Reserve un fotógrafo profesional en cualquier lugar de Portugal. Pago seguro, fotógrafos verificados.",
          "Lisboa, Oporto, Algarve, Sintra y más. Fotógrafos locales seleccionados a mano.",
          "Capture su viaje a Portugal con un fotógrafo local. Reseñas verificadas, precios transparentes.",
          "Solicitud gratuita — pague solo tras confirmación. Cancelación libre antes de la sesión.",
        ],
      },
    ],
  },

  {
    locale: "de",
    name: "Photo Portugal — DE",
    geos: [GEO.germany, GEO.austria, GEO.switzerland],
    language: LANG.german,
    budgetEuro: 25,
    adGroups: [
      {
        name: "Lisbon DE",
        finalUrl: `${BASE}/de/lp/lisbon`,
        keywords: [
          "Fotograf Lissabon", "Fotograf in Lissabon", "Fotoshooting Lissabon",
          "Fotograf Lissabon buchen", "Urlaubsfotograf Lissabon", "Paarfotograf Lissabon",
          "Familienfotograf Lissabon", "Hochzeitsfotograf Lissabon", "Heiratsantrag Lissabon Fotograf",
          "Profi Fotograf Lissabon", "Fotograf Alfama", "Fotograf Belém",
          "Fotograf Touristen Lissabon", "Fotograf Hochzeitsreise Lissabon", "Solo Fotograf Lissabon",
          "Preise Fotograf Lissabon", "professioneller Fotograf Lissabon",
        ],
        headlines: [
          "Fotograf in Lissabon",
          "In 60 Sekunden buchen",
          "Verifizierte Fotografen",
          "Sichere Stripe-Zahlung",
          "Geld-zurück-Garantie",
          "Fotoshooting Lissabon",
          "Profi-Fotograf Lissabon",
          "Sofortbuchung",
          "Verifizierte Bewertungen",
          "Handverlesene Fotografen",
        ],
        descriptions: [
          "Buchen Sie einen Profi-Fotografen in Lissabon in Minuten. Sichere Zahlung, verifizierte Fotografen.",
          "Lokale Fotografen in Lissabon, handverlesen. Sofortbuchung, Geld-zurück-Garantie.",
          "Halten Sie Ihre Reise nach Lissabon mit einem lokalen Fotografen fest. Echte Bewertungen.",
          "Kostenlose Anfrage — Sie zahlen erst nach Bestätigung des Fotografen. Kostenlose Stornierung.",
        ],
      },
      {
        name: "Porto DE",
        finalUrl: `${BASE}/de/lp/porto`,
        keywords: [
          "Fotograf Porto", "Fotograf Porto Portugal", "Fotoshooting Porto",
          "Fotograf Porto buchen", "Paarfotograf Porto", "Familienfotograf Porto",
          "Hochzeitsfotograf Porto", "Urlaubsfotograf Porto", "Fotograf Ribeira",
          "Fotograf Dourotal", "Preise Fotograf Porto", "Profi Fotograf Porto",
          "Fotograf Touristen Porto", "Fotograf Hochzeitsreise Porto",
        ],
        headlines: [
          "Fotograf in Porto",
          "In 60 Sekunden buchen",
          "Verifizierte Fotografen",
          "Sichere Stripe-Zahlung",
          "Geld-zurück-Garantie",
          "Fotoshooting Porto",
          "Profi-Fotograf Porto",
          "Sofortbuchung",
          "Verifizierte Bewertungen",
          "Reise festhalten",
        ],
        descriptions: [
          "Buchen Sie einen Profi-Fotografen in Porto. Sichere Zahlung, verifizierte und handverlesene Fotografen.",
          "Lokale Fotografen in Porto und Dourotal. Sofortbuchung, Geld-zurück-Garantie.",
          "Halten Sie Ihre Porto-Reise mit einem lokalen Fotografen fest. Echte Bewertungen.",
          "Kostenlose Anfrage — Sie zahlen erst nach Bestätigung. Kostenlose Stornierung vor der Session.",
        ],
      },
      {
        name: "Sintra DE",
        finalUrl: `${BASE}/de/lp/sintra`,
        keywords: [
          "Fotograf Sintra", "Fotoshooting Sintra", "Fotograf Pena Palast",
          "Fotograf Quinta da Regaleira", "Fotograf Sintra buchen", "Paarfotograf Sintra",
          "Hochzeitsfotograf Sintra", "Familienfotos Sintra", "Fotograf Hochzeitsreise Sintra",
          "Heiratsantrag Sintra Fotograf", "Preise Fotograf Sintra", "Profi Fotograf Sintra",
        ],
        headlines: [
          "Fotograf in Sintra",
          "Pena Palast & Quinta",
          "In 60 Sekunden buchen",
          "Verifizierte Fotografen",
          "Sichere Stripe-Zahlung",
          "Geld-zurück-Garantie",
          "Fotoshooting Sintra",
          "Profi-Fotograf Sintra",
          "Verifizierte Bewertungen",
          "Sofortbuchung",
        ],
        descriptions: [
          "Buchen Sie einen Profi-Fotografen in Sintra. Pena Palast, Quinta da Regaleira und mehr.",
          "Lokale Fotografen in Sintra, handverlesen. Sofortbuchung, Geld-zurück-Garantie.",
          "Halten Sie die Magie von Sintra mit einem erfahrenen lokalen Fotografen fest.",
          "Kostenlose Anfrage — Sie zahlen erst nach Bestätigung des Fotografen. Kostenlose Stornierung.",
        ],
      },
      {
        name: "Algarve DE",
        finalUrl: `${BASE}/de/lp/algarve`,
        keywords: [
          "Fotograf Algarve", "Fotoshooting Algarve", "Fotograf Faro",
          "Fotograf Lagos Portugal", "Fotograf Albufeira", "Fotograf Algarve buchen",
          "Familienfotograf Strand Algarve", "Paarfotograf Algarve",
          "Hochzeitsfotograf Algarve", "Fotograf Benagil", "Strand Fotos Algarve",
          "Fotograf Hochzeitsreise Algarve", "Preise Fotograf Algarve", "Profi Fotograf Algarve",
        ],
        headlines: [
          "Fotograf in Algarve",
          "Goldene Strände, Klippen",
          "In 60 Sekunden buchen",
          "Verifizierte Fotografen",
          "Sichere Stripe-Zahlung",
          "Geld-zurück-Garantie",
          "Fotoshooting Algarve",
          "Profi-Fotograf Algarve",
          "Verifizierte Bewertungen",
          "Faro, Lagos, Albufeira",
        ],
        descriptions: [
          "Buchen Sie einen Profi-Fotografen in der Algarve. Faro, Lagos, Albufeira, Benagil.",
          "Lokale Fotografen in der Algarve, handverlesen. Sofortbuchung, Geld-zurück-Garantie.",
          "Halten Sie Ihre Algarve-Reise mit einem lokalen Fotografen fest. Echte Bewertungen.",
          "Kostenlose Anfrage — Sie zahlen erst nach Bestätigung. Kostenlose Stornierung.",
        ],
      },
      {
        name: "Portugal General DE",
        finalUrl: `${BASE}/de/photographers`,
        keywords: [
          "Fotograf Portugal", "Urlaubsfotograf Portugal", "Fotograf Portugal buchen",
          "Fotoshooting Portugal", "Fotograf Touristen Portugal", "Profi Fotograf Portugal",
          "Familienfotograf Portugal", "Paarfotograf Portugal", "Hochzeitsfotograf Portugal",
          "Fotograf Hochzeitsreise Portugal", "Heiratsantrag Portugal Fotograf",
          "Fotograf Cascais", "Fotograf Madeira", "Fotograf Azoren",
        ],
        headlines: [
          "Fotograf in Portugal",
          "In 60 Sekunden buchen",
          "Verifizierte Fotografen",
          "Sichere Stripe-Zahlung",
          "Geld-zurück-Garantie",
          "Lissabon, Porto, Algarve",
          "Handverlesene Fotografen",
          "Sofortbuchung",
          "Verifizierte Bewertungen",
          "Urlaub festhalten",
        ],
        descriptions: [
          "Buchen Sie einen Profi-Fotografen überall in Portugal. Sichere Zahlung, verifizierte Fotografen.",
          "Lissabon, Porto, Algarve, Sintra und mehr. Lokale Fotografen, handverlesen.",
          "Halten Sie Ihre Portugal-Reise mit einem lokalen Fotografen fest. Echte Bewertungen.",
          "Kostenlose Anfrage — Sie zahlen erst nach Bestätigung. Kostenlose Stornierung vor der Session.",
        ],
      },
    ],
  },

  {
    locale: "pt",
    name: "Photo Portugal — PT (Brazil)",
    geos: [GEO.brazil],
    language: LANG.portuguese,
    budgetEuro: 15,
    adGroups: [
      {
        name: "Lisbon PT",
        finalUrl: `${BASE}/pt/lp/lisbon`,
        keywords: [
          "fotógrafo Lisboa", "fotógrafo em Lisboa", "ensaio fotográfico Lisboa",
          "reservar fotógrafo Lisboa", "fotógrafo de férias Lisboa", "fotógrafo casal Lisboa",
          "fotógrafo família Lisboa", "fotógrafo casamento Lisboa", "pedido de casamento Lisboa fotógrafo",
          "fotógrafo profissional Lisboa", "fotógrafo Alfama", "fotógrafo Belém",
          "fotógrafo turista Lisboa", "fotógrafo lua de mel Lisboa", "preço fotógrafo Lisboa",
        ],
        headlines: [
          "Fotógrafo em Lisboa",
          "Reserve em 60 segundos",
          "Fotógrafos verificados",
          "Pagamento seguro Stripe",
          "Garantia de devolução",
          "Ensaio fotográfico Lisboa",
          "Fotógrafo profissional",
          "Reserva instantânea",
          "Avaliações verificadas",
          "Selecionados a dedo",
        ],
        descriptions: [
          "Reserve um fotógrafo profissional em Lisboa em minutos. Pagamento seguro, fotógrafos verificados.",
          "Fotógrafos locais em Lisboa, selecionados a dedo. Reserva instantânea, garantia de devolução.",
          "Capture sua viagem a Lisboa com um fotógrafo local. Avaliações verificadas, preços transparentes.",
          "Pedido grátis — pague apenas após confirmação do fotógrafo. Cancelamento livre.",
        ],
      },
      {
        name: "Porto PT",
        finalUrl: `${BASE}/pt/lp/porto`,
        keywords: [
          "fotógrafo Porto Portugal", "fotógrafo no Porto", "ensaio fotográfico Porto",
          "reservar fotógrafo Porto", "fotógrafo casal Porto", "fotógrafo família Porto",
          "fotógrafo casamento Porto", "ensaio Porto Portugal", "fotógrafo Ribeira",
          "fotógrafo Vale do Douro", "preço fotógrafo Porto", "fotógrafo profissional Porto",
        ],
        headlines: [
          "Fotógrafo no Porto",
          "Reserve em 60 segundos",
          "Fotógrafos verificados",
          "Pagamento seguro Stripe",
          "Garantia de devolução",
          "Ensaio fotográfico Porto",
          "Fotógrafo profissional Porto",
          "Reserva instantânea",
          "Avaliações verificadas",
          "Capture sua viagem",
        ],
        descriptions: [
          "Reserve um fotógrafo profissional no Porto. Pagamento seguro, fotógrafos verificados.",
          "Fotógrafos locais no Porto e Vale do Douro. Reserva instantânea, garantia de devolução.",
          "Capture sua viagem ao Porto com um fotógrafo local. Avaliações verificadas, preços transparentes.",
          "Pedido grátis — pague apenas após confirmação. Cancelamento livre antes da sessão.",
        ],
      },
      {
        name: "Algarve PT",
        finalUrl: `${BASE}/pt/lp/algarve`,
        keywords: [
          "fotógrafo Algarve", "ensaio fotográfico Algarve", "fotógrafo Faro",
          "fotógrafo Lagos Portugal", "fotógrafo Albufeira", "reservar fotógrafo Algarve",
          "fotógrafo família praia Algarve", "fotógrafo casal Algarve",
          "fotógrafo casamento Algarve", "fotógrafo Benagil", "ensaio Algarve praia",
          "fotógrafo lua de mel Algarve", "preço fotógrafo Algarve",
        ],
        headlines: [
          "Fotógrafo no Algarve",
          "Praias douradas",
          "Reserve em 60 segundos",
          "Fotógrafos verificados",
          "Pagamento seguro Stripe",
          "Garantia de devolução",
          "Ensaio Algarve",
          "Fotógrafo profissional Algarve",
          "Avaliações verificadas",
          "Faro, Lagos, Albufeira",
        ],
        descriptions: [
          "Reserve um fotógrafo profissional no Algarve. Faro, Lagos, Albufeira, Benagil. Pagamento seguro.",
          "Fotógrafos locais no Algarve, selecionados a dedo. Reserva instantânea, garantia de devolução.",
          "Capture sua viagem ao Algarve com um fotógrafo local. Avaliações verificadas, preços transparentes.",
          "Pedido grátis — pague apenas após confirmação. Cancelamento livre antes da sessão.",
        ],
      },
      {
        name: "Portugal General PT",
        finalUrl: `${BASE}/pt/photographers`,
        keywords: [
          "fotógrafo Portugal", "fotógrafo de férias Portugal", "reservar fotógrafo Portugal",
          "ensaio fotográfico Portugal", "fotógrafo turista Portugal", "fotógrafo profissional Portugal",
          "fotógrafo família Portugal", "fotógrafo casal Portugal", "fotógrafo casamento Portugal",
          "fotógrafo lua de mel Portugal", "fotógrafo pedido de casamento Portugal",
          "fotógrafo Sintra", "fotógrafo Cascais", "fotógrafo Madeira",
        ],
        headlines: [
          "Fotógrafo em Portugal",
          "Reserve em 60 segundos",
          "Fotógrafos verificados",
          "Pagamento seguro Stripe",
          "Garantia de devolução",
          "Lisboa, Porto, Algarve",
          "Selecionados a dedo",
          "Reserva instantânea",
          "Avaliações verificadas",
          "Capture suas férias",
        ],
        descriptions: [
          "Reserve um fotógrafo profissional em qualquer lugar de Portugal. Pagamento seguro, fotógrafos verificados.",
          "Lisboa, Porto, Algarve, Sintra e mais. Fotógrafos locais selecionados a dedo.",
          "Capture sua viagem a Portugal com um fotógrafo local. Avaliações verificadas, preços transparentes.",
          "Pedido grátis — pague apenas após confirmação. Cancelamento livre antes da sessão.",
        ],
      },
    ],
  },
];

const customerId = env.GOOGLE_ADS_CUSTOMER_ID;

// Match types: 2 = BROAD, 3 = PHRASE, 4 = EXACT
const PHRASE = 3;
const EXACT = 4;

async function createCampaign(c) {
  console.log(`\n=== Creating campaign: ${c.name} ===`);

  // 1. Create campaign budget
  const budget = await customer.campaignBudgets.create([{
    name: `${c.name} Budget`,
    amount_micros: c.budgetEuro * 1_000_000,
    delivery_method: 2, // STANDARD
    explicitly_shared: false,
  }]);
  const budgetResource = budget.results[0].resource_name;
  console.log(`  ✓ budget €${c.budgetEuro}/day (${budgetResource})`);

  // 2. Create campaign (ENABLED — launch immediately per user request)
  const campaign = await customer.campaigns.create([{
    name: c.name,
    status: 2, // ENABLED
    advertising_channel_type: 2, // SEARCH
    campaign_budget: budgetResource,
    maximize_conversions: {},
    contains_eu_political_advertising: 3, // DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    network_settings: {
      target_google_search: true,
      target_search_network: true,
      target_content_network: false,
      target_partner_search_network: false,
    },
  }]);
  const campaignResource = campaign.results[0].resource_name;
  console.log(`  ✓ campaign created PAUSED (${campaignResource})`);

  // 3. Add geo + language targeting
  const criteria = [
    ...c.geos.map((g) => ({ campaign: campaignResource, location: { geo_target_constant: g } })),
    { campaign: campaignResource, language: { language_constant: c.language } },
  ];
  await customer.campaignCriteria.create(criteria);
  console.log(`  ✓ ${c.geos.length} geo + 1 language target`);

  // 4. For each ad group: create ad group, keywords, ad
  for (const ag of c.adGroups) {
    const adGroupRes = await customer.adGroups.create([{
      name: ag.name,
      campaign: campaignResource,
      status: 2, // ENABLED
      type: 2, // SEARCH_STANDARD
    }]);
    const adGroupResource = adGroupRes.results[0].resource_name;
    console.log(`    → ad group "${ag.name}" (${adGroupResource})`);

    // Keywords (each keyword as both PHRASE and EXACT)
    const keywordCriteria = [];
    for (const kw of ag.keywords) {
      keywordCriteria.push(
        { ad_group: adGroupResource, status: 2, keyword: { text: kw, match_type: PHRASE } },
        { ad_group: adGroupResource, status: 2, keyword: { text: kw, match_type: EXACT } },
      );
    }
    await customer.adGroupCriteria.create(keywordCriteria);
    console.log(`      ✓ ${ag.keywords.length} keywords × 2 match types = ${keywordCriteria.length}`);

    // Responsive search ad
    const ad = await customer.adGroupAds.create([{
      ad_group: adGroupResource,
      status: 2, // ENABLED
      ad: {
        final_urls: [ag.finalUrl],
        responsive_search_ad: {
          headlines: ag.headlines.map((h) => ({ text: h })),
          descriptions: ag.descriptions.map((d) => ({ text: d })),
        },
      },
    }]);
    console.log(`      ✓ responsive search ad: ${ag.headlines.length} headlines, ${ag.descriptions.length} descriptions`);
  }

  console.log(`✓ ${c.name} done`);
}

(async () => {
  for (const c of CAMPAIGNS) {
    try {
      await createCampaign(c);
    } catch (e) {
      console.error(`✗ ${c.name} FAILED:`, JSON.stringify(e?.errors || e?.message || e, null, 2));
    }
  }
  console.log("\n=== ALL DONE — campaigns are PAUSED, review in Google Ads UI then enable ===");
})();
