// Import Perry Gallagher's 6 Yelp testimonials (the gallery screenshots
// on https://perrygallagher.com/testimonials/). Real dates and US
// locations extracted from each screenshot.
//
// Usage on prod server:
//   cd /var/www/photoportugal-blue && node scripts/import-perry-reviews.mjs

import fs from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  fs
    .readFileSync("/var/www/photoportugal/.env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    })
);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

const PHOTOG_ID = "6dcbc372-c765-45c8-8247-e6af9aa9ef6d"; // Perry Gallagher

const reviews = [
  {
    name: "Brent O.",
    city: "Lisle, IL",
    date: "2019-05-23",
    text: "I have worked with other photographers in the past and well, Perry is my favorite. Hands down.\n\nI have collaborated with/commissioned Perry to do 3 different shoots now (and let me tell you…they were not easy to set up and were quite unconventional) and I have absolutely loved the results we've gotten each time.\n\nWhat I love most about working with Perry is his communication, flexibility, and most importantly, his willingness to LISTEN TO THE CUSTOMER. This doesn't always happen! Perry strives very hard to get YOUR VISION right so that YOU ARE HAPPY.\n\nI can't recommend Perry enough!",
  },
  {
    name: "Natalie V.",
    city: "Atlanta, GA",
    date: "2014-12-08",
    text: "I am not someone who grants high compliments lightly. But the first time I looked through Perry's portfolio, I thought \"This guy is a genius!\" A year and a half later I shot with him. He is an excellent blend of both personal and professional. He was personal enough to help me feel at ease. But he was also very professional, instructing my poses in an informed and helpful manner which, incidentally, also put me at ease. But it is the photos that Perry sets himself apart. I've never had so many compliments on photos of me EVER. Nothing even comes close! Even Facebook \"friends\" that I haven't spoken to in years reached out to tell me how beautiful I looked in his photos. I cannot recommend him enough…",
  },
  {
    name: "Shana S.",
    city: "San Jose, CA",
    date: "2019-05-29",
    text: "Working with Perry was fantastic. I have done two shoots with him over the last 6 years. I'm not naturally comfortable in front of the camera but Perry put me at ease. If you want pictures that show you at your most beautiful, glamorous, and natural self, then work with Perry. He works with natural light and he sees the beauty in all of his subjects. I love the pictures we've made and I will work with him again.",
  },
  {
    name: "Monique F.",
    city: "San Luis Obispo, CA",
    date: "2019-05-25",
    text: "Such an amazing and professional photographer! The Lighting in our photo shoot totally made me look like a rockstar! He captures a perfect blend of softness, sharp and clear photos. I have posted my pictures on social media and have gotten a ton of complements on how great my skin tone looks! Plus my boyfriend loves to look through my photo shoot pics when we are apart. Thank you so much for taking some of the best pictures of me!",
  },
  {
    name: "Anyssa S.",
    city: "Delray Beach, FL",
    date: "2007-02-10",
    text: "I have been fortunate enough to have modeled for and to have assisted the amazing photographer, Perry Gallagher. His work is beyond exceptional. His website features his outstanding erotic art photography. He also does phenomenal wedding and fashion work. If you are looking for the best to shoot your wedding, portfolio or head shots contact Perry. He is also a very warm, caring, patient and funny person. I am honored to have the opportunity to know him and to work with him.",
  },
  {
    name: "Tomiko P.",
    city: "Las Vegas, NV",
    date: "2019-05-24",
    text: "Absolutely amazing photographer. He is easy to work with and he makes everyone look fantastic. I can't say enough nice things about him.",
  },
];

let inserted = 0;
for (const r of reviews) {
  // We keep the city in the title slot so it shows next to the reviewer
  // name on the profile (matches Yelp's "Name · City" pattern).
  const res = await pool.query(
    `INSERT INTO reviews
      (photographer_id, rating, text, title, client_name_override, client_country_override,
       is_verified, is_approved, source_locale, created_at)
     VALUES ($1, 5, $2, $3, $4, 'US', TRUE, TRUE, 'en', $5::timestamptz)
     RETURNING id, created_at`,
    [PHOTOG_ID, r.text, r.city, r.name, r.date]
  );
  inserted++;
  console.log(`✓ ${inserted}/${reviews.length} ${r.name.padEnd(12)} · ${r.city.padEnd(22)} · ${r.date} · ${r.text.slice(0, 60)}…`);
}

// Refresh the photographer's cached review_count + average rating.
await pool.query(
  `UPDATE photographer_profiles SET
     review_count = (SELECT COUNT(*) FROM reviews WHERE photographer_id = $1 AND is_approved = TRUE AND rejected_at IS NULL),
     rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE photographer_id = $1 AND is_approved = TRUE AND rejected_at IS NULL)
   WHERE id = $1`,
  [PHOTOG_ID]
);
const p = await pool.query(
  "SELECT review_count, rating FROM photographer_profiles WHERE id = $1",
  [PHOTOG_ID]
);
console.log(`\nProfile now: ${p.rows[0].review_count} reviews · ${p.rows[0].rating}★`);

await pool.end();
