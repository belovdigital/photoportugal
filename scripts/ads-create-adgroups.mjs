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

const CUSTOMER_ID = "8533157376";
const CAMPAIGN_ID = "23690057178"; // Campaign #1
const CPC_BID_MICROS = 2_500_000; // €2.50
const DEFAULT_CITY_STATUS = enums.AdGroupStatus.ENABLED;

// city_kw: what appears in keyword text (lowercase, accents stripped)
// name: what appears in RSA headlines/descriptions (proper case)
// slug: URL slug for /lp/{slug}
// min_price: min package price (for "from €X" in RSA)
// extras: extra keywords unique to this city [text, matchType, typeParam?]
const CITIES = [
  {
    name: "Setubal",
    slug: "setubal",
    city_kw: "setubal",
    min_price: 90,
    extras: [
      ["arrabida photographer", "PHRASE", null],
      ["arrabida photographer", "BROAD", null],
      ["setubal dolphin photoshoot", "PHRASE", null],
      ["arrabida photoshoot", "PHRASE", null],
      ["photographer in arrabida", "PHRASE", null],
    ],
    rsa_headlines: [
      "Setubal Photographer",
      "Arrabida Photoshoot",
      "From €90 · Book Online",
      "Troia Beach Pros",
      "Dolphin Watch Photos",
      "Real Reviews & Portfolios",
      "Verified Local Pros",
      "Book In 2 Minutes",
      "Free Cancellation",
      "Couples Family & Solo",
      "Secure Payment",
      "Serra Da Arrabida",
      "Photos in 5 Days",
      "Private Gallery Delivery",
      "Hand-Picked Photographers",
    ],
    rsa_descriptions: [
      "Vacation photoshoots in Setubal & Arrabida. Verified local pros from €90.",
      "Hand-picked Setubal photographers. Real reviews and portfolios. Secure payment.",
      "Couples, family, proposal and solo shoots. 24h response. Private gallery delivery.",
      "Capture your Setubal trip with a local pro. Book online in 2 minutes.",
    ],
  },
  {
    name: "Aveiro",
    slug: "aveiro",
    city_kw: "aveiro",
    min_price: 100,
    extras: [
      ["costa nova photographer", "PHRASE", null],
      ["costa nova photographer", "BROAD", null],
      ["aveiro canal photoshoot", "PHRASE", null],
      ["moliceiro boat photoshoot", "PHRASE", null],
      ["photographer in costa nova", "PHRASE", null],
    ],
    rsa_headlines: [
      "Aveiro Photographer",
      "Aveiro Photoshoot",
      "Costa Nova Striped Houses",
      "From €100 · Book Online",
      "Canal & Moliceiro Shoots",
      "Real Reviews & Portfolios",
      "Verified Local Pros",
      "Book In 2 Minutes",
      "Free Cancellation",
      "Couples Family & Solo",
      "Secure Payment",
      "Portuguese Venice Photos",
      "Photos in 5 Days",
      "Private Gallery Delivery",
      "Hand-Picked Photographers",
    ],
    rsa_descriptions: [
      "Vacation photoshoots in Aveiro. Canals, moliceiros, Costa Nova. Pros from €100.",
      "Hand-picked Aveiro photographers. Real reviews and portfolios. Secure payment.",
      "Couples, family, proposal and solo shoots. 24h response. Private gallery delivery.",
      "Capture your Aveiro trip with a local pro. Book online in 2 minutes.",
    ],
  },
  {
    name: "Guimaraes",
    slug: "guimaraes",
    city_kw: "guimaraes",
    min_price: 100,
    extras: [
      ["guimarães photographer", "PHRASE", null],
      ["guimarães photographer", "BROAD", null],
      ["guimaraes castle photoshoot", "PHRASE", null],
      ["guimaraes wedding photographer", "PHRASE", "wedding"],
      ["photographer in guimaraes", "PHRASE", null],
    ],
    rsa_headlines: [
      "Guimaraes Photographer",
      "Guimaraes Photoshoot",
      "Castle & Historic Center",
      "From €100 · Book Online",
      "UNESCO World Heritage",
      "Real Reviews & Portfolios",
      "Verified Local Pros",
      "Book In 2 Minutes",
      "Free Cancellation",
      "Couples Family & Solo",
      "Secure Payment",
      "Birthplace Of Portugal",
      "Photos in 5 Days",
      "Private Gallery Delivery",
      "Hand-Picked Photographers",
    ],
    rsa_descriptions: [
      "Vacation photoshoots in Guimaraes. Castle, Palacio, historic center. Pros from €100.",
      "Hand-picked Guimaraes photographers. Real reviews and portfolios. Secure payment.",
      "Couples, family, proposal and wedding shoots. 24h response. Private gallery.",
      "Capture your Guimaraes trip with a local pro. Book online in 2 minutes.",
    ],
  },
  {
    name: "Douro Valley",
    slug: "douro-valley",
    city_kw: "douro valley",
    min_price: 150,
    extras: [
      ["douro wine tour photographer", "PHRASE", null],
      ["douro wine tour photographer", "BROAD", null],
      ["pinhao photographer", "PHRASE", null],
      ["douro river cruise photoshoot", "PHRASE", null],
      ["douro vineyard photoshoot", "PHRASE", null],
      ["douro photographer", "PHRASE", null],
      ["photographer in douro", "PHRASE", null],
    ],
    rsa_headlines: [
      "Douro Valley Photographer",
      "Wine Quinta Photoshoot",
      "Pinhao & Regua Pros",
      "From €150 · Book Online",
      "Vineyard Golden Hour",
      "Real Reviews & Portfolios",
      "Verified Local Pros",
      "Book In 2 Minutes",
      "Free Cancellation",
      "Honeymoon In Douro",
      "Wine Tour Photo Session",
      "Romantic Douro Shoots",
      "Photos in 5 Days",
      "Private Gallery Delivery",
      "Couples Family & Solo",
    ],
    rsa_descriptions: [
      "Vacation photoshoots in the Douro Valley. Vineyards, quintas, river cruises. From €150.",
      "Hand-picked Douro photographers. Real reviews and portfolios. Secure payment.",
      "Couples, honeymoon, wine tour and proposal shoots. 24h response. Private gallery.",
      "Capture your Douro Valley trip with a local pro. Book online in 2 minutes.",
    ],
  },
  {
    name: "Coimbra",
    slug: "coimbra",
    city_kw: "coimbra",
    min_price: 100,
    extras: [
      ["coimbra university photoshoot", "PHRASE", null],
      ["coimbra wedding photographer", "PHRASE", "wedding"],
      ["photographer in coimbra", "PHRASE", null],
    ],
    rsa_headlines: [
      "Coimbra Photographer",
      "Coimbra Photoshoot",
      "University & Old Town",
      "From €100 · Book Online",
      "UNESCO World Heritage",
      "Real Reviews & Portfolios",
      "Verified Local Pros",
      "Book In 2 Minutes",
      "Free Cancellation",
      "Couples Family & Solo",
      "Secure Payment",
      "Joanina Library Photos",
      "Photos in 5 Days",
      "Private Gallery Delivery",
      "Hand-Picked Photographers",
    ],
    rsa_descriptions: [
      "Vacation photoshoots in Coimbra. University, old town, historic streets. Pros from €100.",
      "Hand-picked Coimbra photographers. Real reviews and portfolios. Secure payment.",
      "Couples, family, proposal and wedding shoots. 24h response. Private gallery.",
      "Capture your Coimbra trip with a local pro. Book online in 2 minutes.",
    ],
  },
];

// Common keyword template (replicates Lisbon group structure)
// [template, matchType, typeParam or null]
const COMMON_KEYWORDS = [
  ["{city} photographer", "PHRASE", null],
  ["{city} photographer", "BROAD", null],
  ["photographer in {city}", "PHRASE", null],
  ["{city} photoshoot", "PHRASE", null],
  ["{city} photo session", "PHRASE", null],
  ["{city} photo session", "BROAD", null],
  ["vacation photographer {city}", "PHRASE", null],
  ["vacation photographer {city}", "BROAD", null],
  ["holiday photographer {city}", "PHRASE", null],
  ["holiday photographer {city}", "BROAD", null],
  ["book photographer {city}", "PHRASE", null],
  ["book photographer {city}", "BROAD", null],
  ["wedding photographer {city}", "PHRASE", "wedding"],
  ["family photoshoot {city}", "PHRASE", "family"],
  ["family photoshoot {city}", "BROAD", "family"],
  ["couples photoshoot {city}", "PHRASE", "couples"],
  ["couples photoshoot {city}", "BROAD", "couples"],
  ["elopement photographer {city}", "PHRASE", "elopement"],
  ["elopement photographer {city}", "BROAD", "elopement"],
  ["proposal photographer {city}", "PHRASE", "proposal"],
  ["proposal photographer {city}", "BROAD", "proposal"],
  ["honeymoon photoshoot {city}", "PHRASE", "honeymoon"],
  ["honeymoon photoshoot {city}", "BROAD", "honeymoon"],
  ["solo photoshoot {city}", "PHRASE", "solo"],
  ["solo photoshoot {city}", "BROAD", "solo"],
  ["birthday photoshoot {city}", "PHRASE", "birthday"],
  ["birthday photoshoot {city}", "BROAD", "birthday"],
  ["content creator photographer {city}", "PHRASE", "content-creator"],
  ["content creator photographer {city}", "BROAD", "content-creator"],
];

function urlFor(slug, typeParam) {
  return typeParam
    ? `https://photoportugal.com/lp/${slug}?type=${typeParam}`
    : `https://photoportugal.com/lp/${slug}`;
}

const matchTypeEnum = (mt) => enums.KeywordMatchType[mt];

const summary = [];

for (const city of CITIES) {
  console.log(`\n=== ${city.name} (${city.slug}) ===`);

  // 1. Create ad group
  const adGroupName = `${city.name} Photographers`;
  const adGroupRes = await customer.adGroups.create([
    {
      name: adGroupName,
      campaign: `customers/${CUSTOMER_ID}/campaigns/${CAMPAIGN_ID}`,
      status: DEFAULT_CITY_STATUS,
      type: enums.AdGroupType.SEARCH_STANDARD,
      cpc_bid_micros: CPC_BID_MICROS,
    },
  ]);
  const adGroupResource = adGroupRes.results[0].resource_name;
  const adGroupId = adGroupResource.split("/").pop();
  console.log(`  ad_group ${adGroupId} created: ${adGroupResource}`);

  // 2. Create keywords
  const allKeywords = [
    ...COMMON_KEYWORDS.map(([tmpl, mt, type]) => [tmpl.replace("{city}", city.city_kw), mt, type]),
    ...city.extras,
  ];

  const criteria = allKeywords.map(([text, mt, type]) => ({
    ad_group: adGroupResource,
    status: enums.AdGroupCriterionStatus.ENABLED,
    keyword: {
      text,
      match_type: matchTypeEnum(mt),
    },
    final_urls: [urlFor(city.slug, type)],
  }));

  // Batch create keywords
  const kwRes = await customer.adGroupCriteria.create(criteria, { partial_failure: true });
  console.log(`  ${kwRes.results.length} keywords created`);

  // 3. Create Responsive Search Ad
  const finalUrl = `https://photoportugal.com/lp/${city.slug}`;
  const adRes = await customer.adGroupAds.create([
    {
      ad_group: adGroupResource,
      status: enums.AdGroupAdStatus.ENABLED,
      ad: {
        final_urls: [finalUrl],
        responsive_search_ad: {
          headlines: city.rsa_headlines.map((text) => ({ text })),
          descriptions: city.rsa_descriptions.map((text) => ({ text })),
          path1: city.slug.replace(/-/g, ""),
          path2: "book",
        },
      },
    },
  ]);
  console.log(`  RSA created: ${adRes.results[0].resource_name}`);

  summary.push({
    city: city.name,
    adGroupId,
    keywords: kwRes.results.length,
    ad: adRes.results[0].resource_name,
  });
}

console.log("\n=== SUMMARY ===");
for (const s of summary) {
  console.log(`  ${s.city}: ad_group=${s.adGroupId}, ${s.keywords} keywords, 1 RSA`);
}
console.log(`\nTotal ad groups: ${summary.length}`);
console.log(`Total keywords: ${summary.reduce((a, b) => a + b.keywords, 0)}`);
