// Continue creating ad groups + ads in 4 multi-language campaigns.
// Skips ad groups that already exist; adds missing ones + ads.
// Headlines max 30 chars, descriptions max 90 chars.

import { GoogleAdsApi, enums } from "google-ads-api";
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

const CAMPAIGNS = [
  {
    campaignName: "Photo Portugal — FR",
    adGroups: [
      {
        name: "Lisbon FR", finalUrl: `${BASE}/fr/lp/lisbon`,
        keywords: ["photographe Lisbonne","séance photo Lisbonne","réserver photographe Lisbonne","photographe vacances Lisbonne","photographe couple Lisbonne","photographe famille Lisbonne","photographe mariage Lisbonne","photographe Alfama","photographe Belém","photographe pro Lisbonne","photographe touriste Lisbonne","photographe lune de miel Lisbonne","tarif photographe Lisbonne","photographe anglophone Lisbonne","shooting photo Lisbonne"],
        headlines: ["Photographe à Lisbonne","Réservez en 60 secondes","Photographes vérifiés","Paiement sécurisé Stripe","Garantie remboursement","Photographes triés","Séance photo Lisbonne","Réservation instantanée","Avis vérifiés","Photographe pro Lisbonne"],
        descriptions: ["Réservez un photographe pro à Lisbonne en quelques minutes. Paiement sécurisé.","Photographes locaux triés sur le volet à Lisbonne. Garantie de remboursement.","Capturez votre voyage à Lisbonne avec un local. Avis vérifiés, prix clairs.","Demande gratuite — payez après confirmation. Annulation libre."],
      },
      {
        name: "Porto FR", finalUrl: `${BASE}/fr/lp/porto`,
        keywords: ["photographe Porto","séance photo Porto","réserver photographe Porto","photographe vacances Porto","photographe couple Porto","photographe famille Porto","photographe mariage Porto","photographe Ribeira Porto","photographe vallée Douro","photographe Foz Porto","tarif photographe Porto","photographe lune de miel Porto","photographe pro Porto","photographe touriste Porto"],
        headlines: ["Photographe à Porto","Réservez en 60 secondes","Photographes vérifiés","Paiement sécurisé Stripe","Garantie remboursement","Séance photo Porto","Photographe pro Porto","Réservation instantanée","Avis vérifiés","Capturez votre voyage"],
        descriptions: ["Réservez un photographe pro à Porto. Paiement sécurisé, photographes vérifiés.","Photographes locaux à Porto et vallée du Douro. Garantie remboursement.","Capturez votre voyage à Porto avec un local. Avis vérifiés, prix clairs.","Demande gratuite — payez après confirmation. Annulation libre."],
      },
      {
        name: "Sintra FR", finalUrl: `${BASE}/fr/lp/sintra`,
        keywords: ["photographe Sintra","séance photo Sintra","photographe palais Pena","photographe Quinta da Regaleira","réserver photographe Sintra","photographe couple Sintra","photographe mariage Sintra","photo de famille Sintra","photographe lune de miel Sintra","photographe pro Sintra","tarif photographe Sintra"],
        headlines: ["Photographe à Sintra","Palais de Pena & Quinta","Réservez en 60 secondes","Photographes vérifiés","Paiement sécurisé Stripe","Garantie remboursement","Séance photo Sintra","Photographe pro Sintra","Avis vérifiés","Réservation instantanée"],
        descriptions: ["Réservez un photographe pro à Sintra. Pena, Quinta da Regaleira et plus.","Photographes locaux à Sintra triés sur le volet. Garantie remboursement.","Capturez la magie de Sintra avec un local expérimenté. Avis vérifiés.","Demande gratuite — payez après confirmation. Annulation libre."],
      },
      {
        name: "Algarve FR", finalUrl: `${BASE}/fr/lp/algarve`,
        keywords: ["photographe Algarve","séance photo Algarve","photographe Faro","photographe Lagos Portugal","photographe Albufeira","réserver photographe Algarve","photographe famille plage Algarve","photographe couple Algarve","photographe mariage Algarve","photographe Benagil","photographe lune de miel Algarve","photographe pro Algarve","tarif photographe Algarve"],
        headlines: ["Photographe en Algarve","Plages dorées, falaises","Réservez en 60 secondes","Photographes vérifiés","Paiement sécurisé Stripe","Garantie remboursement","Séance photo Algarve","Photographe pro Algarve","Avis vérifiés","Faro, Lagos, Albufeira"],
        descriptions: ["Photographe pro en Algarve. Faro, Lagos, Albufeira, Benagil. Paiement sécurisé.","Photographes locaux en Algarve triés sur le volet. Garantie remboursement.","Capturez votre voyage en Algarve avec un local. Avis vérifiés, prix clairs.","Demande gratuite — payez après confirmation. Annulation libre."],
      },
      {
        name: "Portugal General FR", finalUrl: `${BASE}/fr/photographers`,
        keywords: ["photographe Portugal","photographe vacances Portugal","réserver photographe Portugal","séance photo Portugal","photographe touriste Portugal","photographe pro Portugal","photographe famille Portugal","photographe couple Portugal","photographe mariage Portugal","photographe lune de miel Portugal","photographe Cascais","photographe Madère","photographe Açores"],
        headlines: ["Photographe au Portugal","Réservez en 60 secondes","Photographes vérifiés","Paiement sécurisé Stripe","Garantie remboursement","Lisbonne, Porto, Algarve","Photographes triés","Réservation instantanée","Avis vérifiés","Capturez vos vacances"],
        descriptions: ["Photographe pro partout au Portugal. Paiement sécurisé, photographes vérifiés.","Lisbonne, Porto, Algarve, Sintra et plus. Photographes locaux triés.","Capturez votre voyage au Portugal avec un local. Avis vérifiés.","Demande gratuite — payez après confirmation. Annulation libre."],
      },
    ],
  },

  {
    campaignName: "Photo Portugal — ES",
    adGroups: [
      {
        name: "Lisbon ES", finalUrl: `${BASE}/es/lp/lisbon`,
        keywords: ["fotógrafo Lisboa","sesión de fotos Lisboa","reservar fotógrafo Lisboa","fotógrafo vacaciones Lisboa","fotógrafo pareja Lisboa","fotógrafo familia Lisboa","fotógrafo boda Lisboa","fotos profesionales Lisboa","fotógrafo Alfama","fotógrafo Belém","fotógrafo turista Lisboa","fotógrafo luna de miel Lisboa","precio fotógrafo Lisboa","fotógrafo profesional Lisboa"],
        headlines: ["Fotógrafo en Lisboa","Reserve en 60 segundos","Fotógrafos verificados","Pago seguro Stripe","Garantía devolución","Sesión de fotos Lisboa","Fotógrafo pro Lisboa","Reserva instantánea","Reseñas verificadas","Selección a mano"],
        descriptions: ["Fotógrafo pro en Lisboa en minutos. Pago seguro, fotógrafos verificados.","Fotógrafos locales en Lisboa, seleccionados a mano. Garantía devolución.","Capture su viaje a Lisboa con un local. Reseñas verificadas, precios claros.","Solicitud gratis — pague tras confirmación. Cancelación libre."],
      },
      {
        name: "Porto ES", finalUrl: `${BASE}/es/lp/porto`,
        keywords: ["fotógrafo Oporto","fotógrafo Porto Portugal","sesión de fotos Oporto","reservar fotógrafo Oporto","fotógrafo pareja Oporto","fotógrafo familia Oporto","fotógrafo boda Oporto","fotógrafo Ribeira","fotógrafo valle del Duero","precio fotógrafo Oporto","fotógrafo profesional Oporto","fotógrafo turista Oporto","fotógrafo luna de miel Oporto"],
        headlines: ["Fotógrafo en Oporto","Reserve en 60 segundos","Fotógrafos verificados","Pago seguro Stripe","Garantía devolución","Sesión de fotos Oporto","Fotógrafo pro Oporto","Reserva instantánea","Reseñas verificadas","Capture su viaje"],
        descriptions: ["Fotógrafo pro en Oporto. Pago seguro, fotógrafos verificados y a mano.","Fotógrafos locales en Oporto y valle del Duero. Garantía devolución.","Capture su viaje a Oporto con un local. Reseñas verificadas, precios claros.","Solicitud gratis — pague tras confirmación. Cancelación libre."],
      },
      {
        name: "Sintra ES", finalUrl: `${BASE}/es/lp/sintra`,
        keywords: ["fotógrafo Sintra","sesión de fotos Sintra","fotógrafo Palacio Pena","fotógrafo Quinta da Regaleira","reservar fotógrafo Sintra","fotógrafo pareja Sintra","fotógrafo boda Sintra","fotos familia Sintra","fotógrafo luna de miel Sintra","precio fotógrafo Sintra","fotógrafo profesional Sintra"],
        headlines: ["Fotógrafo en Sintra","Palacio Pena y Quinta","Reserve en 60 segundos","Fotógrafos verificados","Pago seguro Stripe","Garantía devolución","Sesión de fotos Sintra","Fotógrafo pro Sintra","Reseñas verificadas","Reserva instantánea"],
        descriptions: ["Fotógrafo pro en Sintra. Palacio de Pena, Quinta da Regaleira y más.","Fotógrafos locales en Sintra a mano. Garantía devolución.","Capture la magia de Sintra con un local experimentado. Reseñas verificadas.","Solicitud gratis — pague tras confirmación. Cancelación libre."],
      },
      {
        name: "Algarve ES", finalUrl: `${BASE}/es/lp/algarve`,
        keywords: ["fotógrafo Algarve","sesión de fotos Algarve","fotógrafo Faro","fotógrafo Lagos Portugal","fotógrafo Albufeira","reservar fotógrafo Algarve","fotógrafo familia playa Algarve","fotógrafo pareja Algarve","fotógrafo boda Algarve","fotógrafo Benagil","fotos Algarve playa","fotógrafo luna de miel Algarve","precio fotógrafo Algarve"],
        headlines: ["Fotógrafo en Algarve","Playas doradas","Reserve en 60 segundos","Fotógrafos verificados","Pago seguro Stripe","Garantía devolución","Sesión Algarve","Fotógrafo pro Algarve","Reseñas verificadas","Faro, Lagos, Albufeira"],
        descriptions: ["Fotógrafo pro en Algarve. Faro, Lagos, Albufeira, Benagil. Pago seguro.","Fotógrafos locales en Algarve a mano. Garantía devolución.","Capture su viaje a Algarve con un local. Reseñas verificadas.","Solicitud gratis — pague tras confirmación. Cancelación libre."],
      },
      {
        name: "Portugal General ES", finalUrl: `${BASE}/es/photographers`,
        keywords: ["fotógrafo Portugal","fotógrafo vacaciones Portugal","reservar fotógrafo Portugal","sesión de fotos Portugal","fotógrafo turista Portugal","fotógrafo profesional Portugal","fotógrafo familia Portugal","fotógrafo pareja Portugal","fotógrafo boda Portugal","fotógrafo luna de miel Portugal","fotógrafo Cascais","fotógrafo Madeira","fotógrafo Azores"],
        headlines: ["Fotógrafo en Portugal","Reserve en 60 segundos","Fotógrafos verificados","Pago seguro Stripe","Garantía devolución","Lisboa, Oporto, Algarve","Selección a mano","Reserva instantánea","Reseñas verificadas","Capture sus vacaciones"],
        descriptions: ["Fotógrafo pro en cualquier lugar de Portugal. Pago seguro, verificados.","Lisboa, Oporto, Algarve, Sintra y más. Fotógrafos locales a mano.","Capture su viaje a Portugal con un local. Reseñas verificadas.","Solicitud gratis — pague tras confirmación. Cancelación libre."],
      },
    ],
  },

  {
    campaignName: "Photo Portugal — DE",
    adGroups: [
      {
        name: "Lisbon DE", finalUrl: `${BASE}/de/lp/lisbon`,
        keywords: ["Fotograf Lissabon","Fotoshooting Lissabon","Fotograf Lissabon buchen","Urlaubsfotograf Lissabon","Paarfotograf Lissabon","Familienfotograf Lissabon","Hochzeitsfotograf Lissabon","Profi Fotograf Lissabon","Fotograf Alfama","Fotograf Belém","Fotograf Touristen Lissabon","Fotograf Hochzeitsreise Lissabon","Preise Fotograf Lissabon"],
        headlines: ["Fotograf in Lissabon","In 60 Sekunden buchen","Verifizierte Fotografen","Sichere Stripe-Zahlung","Geld-zurück-Garantie","Fotoshooting Lissabon","Profi Fotograf Lissabon","Sofortbuchung","Echte Bewertungen","Handverlesene Profis"],
        descriptions: ["Profi-Fotograf in Lissabon in Minuten buchen. Sichere Zahlung, verifiziert.","Lokale Fotografen in Lissabon, handverlesen. Geld-zurück-Garantie.","Reise nach Lissabon mit lokalem Fotografen festhalten. Echte Bewertungen.","Kostenlose Anfrage — zahlen erst nach Bestätigung. Kostenlose Stornierung."],
      },
      {
        name: "Porto DE", finalUrl: `${BASE}/de/lp/porto`,
        keywords: ["Fotograf Porto","Fotograf Porto Portugal","Fotoshooting Porto","Fotograf Porto buchen","Paarfotograf Porto","Familienfotograf Porto","Hochzeitsfotograf Porto","Urlaubsfotograf Porto","Fotograf Ribeira","Fotograf Dourotal","Preise Fotograf Porto","Profi Fotograf Porto","Fotograf Touristen Porto"],
        headlines: ["Fotograf in Porto","In 60 Sekunden buchen","Verifizierte Fotografen","Sichere Stripe-Zahlung","Geld-zurück-Garantie","Fotoshooting Porto","Profi Fotograf Porto","Sofortbuchung","Echte Bewertungen","Reise festhalten"],
        descriptions: ["Profi-Fotograf in Porto. Sichere Zahlung, verifizierte Fotografen.","Lokale Fotografen in Porto und Dourotal. Geld-zurück-Garantie.","Porto-Reise mit lokalem Fotografen festhalten. Echte Bewertungen.","Kostenlose Anfrage — zahlen erst nach Bestätigung."],
      },
      {
        name: "Sintra DE", finalUrl: `${BASE}/de/lp/sintra`,
        keywords: ["Fotograf Sintra","Fotoshooting Sintra","Fotograf Pena Palast","Fotograf Quinta da Regaleira","Fotograf Sintra buchen","Paarfotograf Sintra","Hochzeitsfotograf Sintra","Familienfotos Sintra","Fotograf Hochzeitsreise Sintra","Preise Fotograf Sintra","Profi Fotograf Sintra"],
        headlines: ["Fotograf in Sintra","Pena Palast & Quinta","In 60 Sekunden buchen","Verifizierte Fotografen","Sichere Stripe-Zahlung","Geld-zurück-Garantie","Fotoshooting Sintra","Profi Fotograf Sintra","Echte Bewertungen","Sofortbuchung"],
        descriptions: ["Profi-Fotograf in Sintra. Pena Palast, Quinta da Regaleira und mehr.","Lokale Fotografen in Sintra, handverlesen. Geld-zurück-Garantie.","Magie von Sintra mit erfahrenem lokalem Fotografen festhalten.","Kostenlose Anfrage — zahlen erst nach Bestätigung. Kostenlose Stornierung."],
      },
      {
        name: "Algarve DE", finalUrl: `${BASE}/de/lp/algarve`,
        keywords: ["Fotograf Algarve","Fotoshooting Algarve","Fotograf Faro","Fotograf Lagos Portugal","Fotograf Albufeira","Fotograf Algarve buchen","Familienfotograf Strand Algarve","Paarfotograf Algarve","Hochzeitsfotograf Algarve","Fotograf Benagil","Strand Fotos Algarve","Fotograf Hochzeitsreise Algarve","Preise Fotograf Algarve"],
        headlines: ["Fotograf in Algarve","Goldene Strände","In 60 Sekunden buchen","Verifizierte Fotografen","Sichere Stripe-Zahlung","Geld-zurück-Garantie","Fotoshooting Algarve","Profi Fotograf Algarve","Echte Bewertungen","Faro, Lagos, Albufeira"],
        descriptions: ["Profi-Fotograf in der Algarve. Faro, Lagos, Albufeira, Benagil.","Lokale Fotografen in der Algarve. Geld-zurück-Garantie.","Algarve-Reise mit lokalem Fotografen festhalten. Echte Bewertungen.","Kostenlose Anfrage — zahlen erst nach Bestätigung. Stornierung kostenlos."],
      },
      {
        name: "Portugal General DE", finalUrl: `${BASE}/de/photographers`,
        keywords: ["Fotograf Portugal","Urlaubsfotograf Portugal","Fotograf Portugal buchen","Fotoshooting Portugal","Fotograf Touristen Portugal","Profi Fotograf Portugal","Familienfotograf Portugal","Paarfotograf Portugal","Hochzeitsfotograf Portugal","Fotograf Hochzeitsreise Portugal","Fotograf Cascais","Fotograf Madeira","Fotograf Azoren"],
        headlines: ["Fotograf in Portugal","In 60 Sekunden buchen","Verifizierte Fotografen","Sichere Stripe-Zahlung","Geld-zurück-Garantie","Lissabon, Porto, Algarve","Handverlesen","Sofortbuchung","Echte Bewertungen","Urlaub festhalten"],
        descriptions: ["Profi-Fotograf überall in Portugal. Sichere Zahlung, verifiziert.","Lissabon, Porto, Algarve, Sintra und mehr. Lokale Fotografen.","Portugal-Reise mit lokalem Fotografen festhalten. Echte Bewertungen.","Kostenlose Anfrage — zahlen erst nach Bestätigung."],
      },
    ],
  },

  {
    campaignName: "Photo Portugal — PT (Brazil)",
    adGroups: [
      {
        name: "Lisbon PT", finalUrl: `${BASE}/pt/lp/lisbon`,
        keywords: ["fotógrafo Lisboa","ensaio fotográfico Lisboa","reservar fotógrafo Lisboa","fotógrafo de férias Lisboa","fotógrafo casal Lisboa","fotógrafo família Lisboa","fotógrafo casamento Lisboa","fotógrafo profissional Lisboa","fotógrafo Alfama","fotógrafo Belém","fotógrafo turista Lisboa","fotógrafo lua de mel Lisboa","preço fotógrafo Lisboa"],
        headlines: ["Fotógrafo em Lisboa","Reserve em 60 segundos","Fotógrafos verificados","Pagamento seguro Stripe","Garantia devolução","Ensaio fotográfico Lisboa","Fotógrafo pro Lisboa","Reserva instantânea","Avaliações verificadas","Selecionados a dedo"],
        descriptions: ["Fotógrafo pro em Lisboa em minutos. Pagamento seguro, verificados.","Fotógrafos locais em Lisboa, selecionados a dedo. Garantia devolução.","Capture sua viagem a Lisboa com um local. Avaliações verificadas.","Pedido grátis — pague após confirmação. Cancelamento livre."],
      },
      {
        name: "Porto PT", finalUrl: `${BASE}/pt/lp/porto`,
        keywords: ["fotógrafo Porto Portugal","fotógrafo no Porto","ensaio fotográfico Porto","reservar fotógrafo Porto","fotógrafo casal Porto","fotógrafo família Porto","fotógrafo casamento Porto","fotógrafo Ribeira","fotógrafo Vale do Douro","preço fotógrafo Porto","fotógrafo profissional Porto"],
        headlines: ["Fotógrafo no Porto","Reserve em 60 segundos","Fotógrafos verificados","Pagamento seguro Stripe","Garantia devolução","Ensaio Porto","Fotógrafo pro Porto","Reserva instantânea","Avaliações verificadas","Capture sua viagem"],
        descriptions: ["Fotógrafo pro no Porto. Pagamento seguro, fotógrafos verificados.","Fotógrafos locais no Porto e Vale do Douro. Garantia devolução.","Capture sua viagem ao Porto com um local. Avaliações verificadas.","Pedido grátis — pague após confirmação. Cancelamento livre."],
      },
      {
        name: "Algarve PT", finalUrl: `${BASE}/pt/lp/algarve`,
        keywords: ["fotógrafo Algarve","ensaio fotográfico Algarve","fotógrafo Faro","fotógrafo Lagos Portugal","fotógrafo Albufeira","reservar fotógrafo Algarve","fotógrafo família praia Algarve","fotógrafo casal Algarve","fotógrafo casamento Algarve","fotógrafo Benagil","ensaio Algarve praia","fotógrafo lua de mel Algarve"],
        headlines: ["Fotógrafo no Algarve","Praias douradas","Reserve em 60 segundos","Fotógrafos verificados","Pagamento seguro Stripe","Garantia devolução","Ensaio Algarve","Fotógrafo pro Algarve","Avaliações verificadas","Faro, Lagos, Albufeira"],
        descriptions: ["Fotógrafo pro no Algarve. Faro, Lagos, Albufeira, Benagil.","Fotógrafos locais no Algarve, selecionados a dedo. Garantia devolução.","Capture sua viagem ao Algarve com um local. Avaliações verificadas.","Pedido grátis — pague após confirmação. Cancelamento livre."],
      },
      {
        name: "Portugal General PT", finalUrl: `${BASE}/pt/photographers`,
        keywords: ["fotógrafo Portugal","fotógrafo de férias Portugal","reservar fotógrafo Portugal","ensaio fotográfico Portugal","fotógrafo turista Portugal","fotógrafo profissional Portugal","fotógrafo família Portugal","fotógrafo casal Portugal","fotógrafo casamento Portugal","fotógrafo lua de mel Portugal","fotógrafo Sintra","fotógrafo Cascais","fotógrafo Madeira"],
        headlines: ["Fotógrafo em Portugal","Reserve em 60 segundos","Fotógrafos verificados","Pagamento seguro Stripe","Garantia devolução","Lisboa, Porto, Algarve","Selecionados a dedo","Reserva instantânea","Avaliações verificadas","Capture suas férias"],
        descriptions: ["Fotógrafo pro em qualquer lugar de Portugal. Pagamento seguro.","Lisboa, Porto, Algarve, Sintra e mais. Fotógrafos locais.","Capture sua viagem a Portugal com um local. Avaliações verificadas.","Pedido grátis — pague após confirmação. Cancelamento livre."],
      },
    ],
  },
];

// Validate lengths first
let invalid = 0;
for (const c of CAMPAIGNS) for (const ag of c.adGroups) {
  for (const h of ag.headlines) if (h.length > 30) { console.error(`HEADLINE TOO LONG (${h.length}): "${h}"`); invalid++; }
  for (const d of ag.descriptions) if (d.length > 90) { console.error(`DESC TOO LONG (${d.length}): "${d}"`); invalid++; }
}
if (invalid > 0) { console.error(`\n${invalid} text-length errors. Fix and re-run.`); process.exit(1); }
console.log("✓ all text lengths within Google Ads limits");

const PHRASE = 3, EXACT = 4;

// Look up existing campaigns + ad groups
const existing = await customer.query(`
  SELECT campaign.id, campaign.name, campaign.resource_name, ad_group.id, ad_group.name, ad_group.resource_name
  FROM ad_group
  WHERE campaign.name LIKE 'Photo Portugal — %'
`);
const campaignsByName = new Map();
for (const r of existing) {
  const name = r.campaign.name;
  if (!campaignsByName.has(name)) campaignsByName.set(name, { resource: r.campaign.resource_name, adGroups: new Map() });
  campaignsByName.get(name).adGroups.set(r.ad_group.name, r.ad_group.resource_name);
}

// For campaigns without ad groups (zero) we still need their resource_name
const campaignOnly = await customer.query(`
  SELECT campaign.id, campaign.name, campaign.resource_name FROM campaign WHERE campaign.name LIKE 'Photo Portugal — %'
`);
for (const r of campaignOnly) {
  if (!campaignsByName.has(r.campaign.name)) campaignsByName.set(r.campaign.name, { resource: r.campaign.resource_name, adGroups: new Map() });
}

console.log(`Found ${campaignsByName.size} existing campaigns`);

for (const c of CAMPAIGNS) {
  const camp = campaignsByName.get(c.campaignName);
  if (!camp) { console.error(`✗ campaign not found: ${c.campaignName}`); continue; }
  console.log(`\n=== ${c.campaignName} (${camp.resource}) ===`);

  for (const ag of c.adGroups) {
    let agResource = camp.adGroups.get(ag.name);
    if (!agResource) {
      // Create ad group + keywords
      const created = await customer.adGroups.create([{ name: ag.name, campaign: camp.resource, status: 2, type: 2 }]);
      agResource = created.results[0].resource_name;
      console.log(`  + ad group "${ag.name}"`);

      const keywordCriteria = [];
      for (const kw of ag.keywords) {
        keywordCriteria.push(
          { ad_group: agResource, status: 2, keyword: { text: kw, match_type: PHRASE } },
          { ad_group: agResource, status: 2, keyword: { text: kw, match_type: EXACT } },
        );
      }
      try {
        await customer.adGroupCriteria.create(keywordCriteria);
        console.log(`    + ${ag.keywords.length} keywords × 2 = ${keywordCriteria.length}`);
      } catch (e) {
        console.error(`    ✗ keyword create FAILED:`, e?.errors?.[0]?.message || e);
      }
    } else {
      console.log(`  ~ ad group exists: ${ag.name}`);
    }

    // Check if ad already exists for this ad group
    const existingAds = await customer.query(`SELECT ad_group_ad.ad.id FROM ad_group_ad WHERE ad_group.resource_name = "${agResource}" AND ad_group_ad.status != 'REMOVED'`);
    if (existingAds.length > 0) {
      console.log(`    ~ ad already exists, skipping`);
      continue;
    }

    try {
      await customer.adGroupAds.create([{
        ad_group: agResource,
        status: 2,
        ad: {
          final_urls: [ag.finalUrl],
          responsive_search_ad: {
            headlines: ag.headlines.map((h) => ({ text: h })),
            descriptions: ag.descriptions.map((d) => ({ text: d })),
          },
        },
      }]);
      console.log(`    + ad: ${ag.headlines.length}H + ${ag.descriptions.length}D`);
    } catch (e) {
      console.error(`    ✗ ad create FAILED:`, JSON.stringify(e?.errors || e?.message || e, null, 2));
    }
  }
}

console.log("\n=== DONE — campaigns are ENABLED, running live ===");
