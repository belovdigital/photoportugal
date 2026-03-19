import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://photoportugal:PhotoPortugal2026Secure@localhost:5432/photoportugal",
});

const posts = [
  {
    slug: "solo-travel-photoshoot-portugal",
    title: "Solo Travel Photoshoot in Portugal: Your Complete Guide",
    excerpt: "Traveling solo in Portugal? A professional photoshoot turns your adventure into stunning portraits.",
    meta_title: "Solo Travel Photoshoot in Portugal — Guide & Tips",
    meta_description: "Plan the perfect solo travel photoshoot in Portugal. Best locations, posing tips, what to wear, and how to choose your photographer.",
    target_keywords: "solo travel photoshoot portugal, solo photography portugal, solo traveler photos lisbon",
    content: `## Why Book a Solo Photoshoot in Portugal?

Traveling alone doesn't mean your photos should suffer. While selfies and tripod shots have their place, nothing compares to having a professional photographer capture you in Portugal's most stunning locations.

**Solo travelers are our fastest-growing segment** — and for good reason. You get the undivided attention of your photographer, complete creative freedom, and photos that look like they belong in a magazine.

## Best Locations for Solo Photos

### Lisbon
The colorful streets of Alfama, the panoramic views from Miradouro da Graça, and the iconic yellow trams create the perfect backdrop for solo portraits.

### Sintra
Pena Palace's fairytale architecture makes you feel like the main character in your own story. The misty forests add drama to every shot.

### Porto
Ribeira's riverside charm, the azulejo-covered São Bento station, and the Clérigos Tower offer endless variety for a single session.

### Algarve
Golden cliffs, sea caves, and dramatic coastlines — perfect for that adventurous solo traveler vibe.

## Tips for a Great Solo Photoshoot

- **Be Yourself** — The best solo photos capture genuine personality. Laugh, walk, look off into the distance.
- **Bring Multiple Outfits** — Pack a casual outfit, something dressy, and maybe a bold color.
- **Choose Golden Hour** — Early morning or late afternoon light is universally flattering.
- **Communicate Your Vision** — Show your photographer examples of photos you love.
- **Don't Rush** — A 60-90 minute session gives you time to relax into it.

## How Much Does It Cost?

Solo photoshoots in Portugal typically range from **€120-300** depending on duration and photographer experience. [Browse our photographers](/photographers) to compare packages.`,
  },
  {
    slug: "golden-hour-photography-portugal",
    title: "Golden Hour in Portugal: When & Where to Shoot for Magical Photos",
    excerpt: "Golden hour transforms any photo into something magical. Here's when it happens in Portugal and the best spots to catch it.",
    meta_title: "Golden Hour Photography in Portugal — Times & Best Spots",
    meta_description: "Discover the best golden hour photography spots in Portugal. Sunrise and sunset times, locations in Lisbon, Porto & Algarve.",
    target_keywords: "golden hour portugal, sunset photoshoot lisbon, sunrise photography porto, best light portugal",
    content: `## What Is Golden Hour?

Golden hour is the period shortly after sunrise or before sunset when the light is warm, soft, and directional. It's every photographer's favorite time to shoot — and Portugal's latitude makes it especially beautiful.

## Golden Hour Times in Portugal

Portugal's golden hour varies by season:

- **Summer (June-August):** Sunrise ~6:15, Sunset ~8:45. Golden hour lasts about 45 minutes.
- **Spring/Autumn:** Sunrise ~7:00, Sunset ~7:30. Golden hour lasts about 35 minutes.
- **Winter (December-February):** Sunrise ~7:45, Sunset ~5:30. Shorter but incredibly warm light.

**Pro tip:** Sunrise sessions mean empty streets and no crowds at famous landmarks.

## Best Golden Hour Spots

### Lisbon
- **Miradouro da Graça** — sunset paints the Tagus River gold
- **Praça do Comércio** — the arches frame the light beautifully
- **Alfama streets** — warm light bouncing off yellow and orange walls

### Porto
- **Dom Luís I Bridge** — the Douro River becomes liquid gold
- **Ribeira waterfront** — the colored buildings glow in warm light
- **Jardins do Palácio de Cristal** — panoramic sunset views

### Algarve
- **Praia da Marinha** — golden cliffs at their most dramatic
- **Benagil Cave** — sunlight streaming through the cave roof (morning only)
- **Lagos coastline** — rock formations cast incredible shadows

## What to Wear

Warm tones (cream, beige, terracotta, blush) complement golden light beautifully. Avoid neon colors. White and flowing fabrics look ethereal in backlit golden hour shots.

When you [book with a Photo Portugal photographer](/photographers), mention golden hour — they'll plan the perfect timing.`,
  },
  {
    slug: "maternity-photoshoot-portugal",
    title: "Maternity Photoshoot in Portugal: Beautiful Bump Photos",
    excerpt: "Expecting a baby on your Portugal trip? A maternity photoshoot captures this special moment against stunning backdrops.",
    meta_title: "Maternity Photoshoot in Portugal — Bump Photography Guide",
    meta_description: "Plan a beautiful maternity photoshoot in Portugal. Best locations, what to wear, timing tips, and how to book your session.",
    target_keywords: "maternity photoshoot portugal, pregnancy photos lisbon, bump photography portugal",
    content: `## Why Portugal for Maternity Photos?

Portugal offers something no studio can — natural light, stunning architecture, and romantic landscapes that make maternity photos feel timeless rather than posed.

## Best Time During Pregnancy

Most photographers recommend booking between **28-34 weeks**. Your bump is beautifully visible and you're still comfortable enough to walk and pose.

## Ideal Locations

### For Romance
- **Sintra's gardens** — lush greenery and fairy-tale atmosphere
- **Cascais beachfront** — soft sand and gentle waves
- **Alfama, Lisbon** — intimate cobblestone streets

### For Drama
- **Algarve cliffs** — dramatic sea views
- **Monsanto Park, Lisbon** — forest light filtering through trees

### For Elegance
- **Belém, Lisbon** — the Jerónimos Monastery as a grand backdrop
- **Porto's Palácio da Bolsa** — ornate architecture

## What to Wear

- **Flowing dresses** that drape beautifully over your bump
- **Solid colors** — cream, white, blush, sage, dusty blue
- **Comfortable shoes** you can slip off for beach shots

## Tips for a Comfortable Session

- **Stay hydrated** — bring water, your photographer won't mind breaks
- **Shoot in the morning** when energy is highest and light is soft
- **60 minutes is plenty** — shorter sessions prevent fatigue
- **Include your partner** for 15 minutes of couple shots

Maternity photoshoots in Portugal typically cost **€150-350**. [Find a photographer](/photographers) who specializes in maternity sessions.`,
  },
  {
    slug: "how-to-choose-photographer-portugal",
    title: "How to Choose a Photographer in Portugal: 7 Things to Check",
    excerpt: "Not all photographers are the same. Here are 7 things to look for when choosing your vacation photographer in Portugal.",
    meta_title: "How to Choose a Photographer in Portugal — 7 Tips",
    meta_description: "7 things to check when choosing a vacation photographer in Portugal. Portfolio tips, review reading, package comparison.",
    target_keywords: "choose photographer portugal, best photographer portugal, hire photographer lisbon",
    content: `## 1. Check Their Portfolio Carefully

Don't just glance at the highlights. Look for:
- **Consistency** — are all photos the same quality?
- **Your style** — bright and airy or moody and dramatic?
- **Real people** — do they photograph tourists, not just models?
- **Your locations** — have they shot where you want?

## 2. Read Verified Reviews

On Photo Portugal, every review is tied to a completed booking. Pay attention to what clients say about the **experience**, not just the photos.

## 3. Compare Packages

Look beyond price. Compare:
- **Number of edited photos** — some deliver 30, others 150
- **Session duration** — 30 minutes vs 2 hours is a big difference
- **Delivery time** — important if you're leaving Portugal soon
- **Locations included** — some cover multiple spots

## 4. Check Their Response Time

Send a message before booking. Quick, thoughtful responses signal professionalism.

## 5. Look at Their Locations

Make sure they cover where you want to shoot. A Lisbon photographer may not be available in the Algarve.

## 6. Verify Their Experience

Check years of experience, sessions completed, languages spoken, and verified badge.

## 7. Trust Your Gut

Choose the photographer whose work and personality resonate with you. The best photos come from comfort.

[Browse our photographers](/photographers) and use filters to narrow by location, style, and budget.`,
  },
  {
    slug: "what-to-expect-photoshoot-portugal",
    title: "What to Expect at Your Photoshoot in Portugal (First-Timer Guide)",
    excerpt: "Never done a professional photoshoot? Here's exactly what happens from booking to delivery.",
    meta_title: "What to Expect at Your Photoshoot in Portugal — First Timer Guide",
    meta_description: "First professional photoshoot? Here's what happens before, during, and after your Portugal photography session.",
    target_keywords: "what to expect photoshoot, first photoshoot tips, professional photoshoot portugal",
    content: `## Before the Shoot

Your photographer will message you to confirm the date, discuss your vision, suggest the best route between spots, and share outfit recommendations.

The day before, check the weather forecast together. If rain is expected, you can reschedule for free or move to a covered location.

## During the Shoot

### Meeting Up
Your photographer meets you at the agreed spot. They'll chat for a few minutes and explain the plan.

### The First 10 Minutes
You'll feel a bit awkward — **that's totally normal**. Your photographer starts with easy poses: walking, looking at the view, laughing. By minute 10, you'll forget the camera.

### The Session (60-120 minutes)
- Visit **2-3 locations** within walking distance
- Try different poses — standing, sitting, walking, candid
- **Outfit change breaks** if you brought extra clothes
- Different compositions — wide shots, close-ups, details

### What Your Photographer Does
- Guides you through poses (no experience needed)
- Watches for the best light and background
- Makes you laugh for natural expressions
- Shoots hundreds of photos to select the best

## After the Shoot

### Editing & Delivery (3-14 days)
Your photographer selects and edits the best photos and sends you a link to a **private, password-protected gallery**.

### Your Gallery
- View all photos in high resolution
- Download individually or grab the **entire ZIP**
- Gallery stays accessible for **90 days**
- Accept the delivery when you're happy

[Book your session](/photographers) — it takes under 5 minutes.`,
  },
  {
    slug: "douro-valley-photoshoot-guide",
    title: "Douro Valley Photoshoot: Wine Country Photography at Its Best",
    excerpt: "The Douro Valley's terraced vineyards and river views create breathtaking photo opportunities.",
    meta_title: "Douro Valley Photoshoot — Wine Country Photography Guide",
    meta_description: "Plan a stunning Douro Valley photoshoot in Portugal. Best viewpoints, seasonal tips, outfit ideas for wine country photos.",
    target_keywords: "douro valley photoshoot, douro valley photography, wine country photos portugal",
    content: `## Why the Douro Valley?

The Douro Valley is a **UNESCO World Heritage Site** and one of Europe's most photogenic landscapes. Terraced vineyards cascading down to the river, centuries-old quintas, and golden light reflecting off the water — it's pure magic.

## Best Time to Visit

- **September-October:** Harvest season. Vineyards turn gold and red. Most photogenic time.
- **May-June:** Lush green vineyards, wildflowers, pleasant temperatures.
- **March-April:** Almond blossoms create a pink and white wonderland.
- **Avoid:** July-August can hit 40°C+ in the valley.

## Best Photo Spots

- **São Leonardo de Galafura Viewpoint** — the most iconic panoramic view
- **Pinhão** — charming village with azulejo tiles at the train station
- **Quinta do Crasto** — historic wine estate with stunning terraces
- **Folgosa to Peso da Régua** — scenic riverside walk

## Session Ideas

- **Couples:** Sunset at a viewpoint with wine and cheese
- **Families:** Morning walk through vineyard terraces
- **Solo:** Editorial-style shots among the vines
- **Proposals:** Sunset at a private quinta with river views

## What to Wear

Earth tones — terracotta, olive, cream, burgundy. Linen and cotton. Comfortable shoes for vineyard paths. A sun hat for style and function.

The Douro is about 2 hours from Porto. [Find a photographer](/photographers?location=douro-valley) who covers the Douro Valley.`,
  },
  {
    slug: "beach-photoshoot-portugal-guide",
    title: "Beach Photoshoot in Portugal: Tips for Stunning Coastal Photos",
    excerpt: "Portugal has some of Europe's best beaches. Here's how to get amazing beach photos.",
    meta_title: "Beach Photoshoot in Portugal — Coastal Photography Guide",
    meta_description: "Plan the perfect beach photoshoot in Portugal. Best beaches, outfit ideas, timing tips for stunning coastal photos.",
    target_keywords: "beach photoshoot portugal, beach photography algarve, coastal photos portugal",
    content: `## Portugal's Best Beaches for Photos

### Algarve
- **Praia da Marinha** — dramatic cliffs and crystal water
- **Praia de Benagil** — the famous sea cave
- **Praia do Camilo** — wooden staircase through golden rocks

### Cascais & Sintra Coast
- **Praia do Guincho** — wild Atlantic waves
- **Praia da Ursa** — remote and dramatic (requires a hike)
- **Praia da Adraga** — towering rock formations

### Comporta & Alentejo
- **Comporta** — endless white sand
- **Porto Covo** — charming fishing village + beach

## Best Time for Beach Photos

- **Sunrise:** Empty beaches, soft pink light
- **Late afternoon:** Golden light over the ocean
- **Avoid midday:** Harsh overhead shadows

## What to Wear

- **Flowy dresses and skirts** — they catch the wind beautifully
- **White and light colors** — pop against blue water and golden sand
- **Bare feet** — always looks better on sand
- **Bring a change** for variety between beach and promenade

## Beach Photo Tips

- **Embrace the wind** — windblown hair creates dynamic shots
- **Timing the tide** — low tide reveals rock pools, high tide means bigger waves
- **Water shots** — wading in waves always produces crowd favorites
- **Bring a towel** if you want water shots

Beach photoshoots cost **€120-350**. [Find your photographer](/photographers) and filter by coastal locations.`,
  },
  {
    slug: "content-creator-photoshoot-portugal",
    title: "Content Creator Photoshoot in Portugal: Level Up Your Feed",
    excerpt: "Need professional content for Instagram, TikTok, or your blog? A Portugal photoshoot gives you months of content.",
    meta_title: "Content Creator Photoshoot in Portugal — Instagram & TikTok Guide",
    meta_description: "Plan a content creator photoshoot in Portugal. Best locations, briefing tips, how to get months of Instagram content.",
    target_keywords: "content creator photoshoot portugal, instagram photoshoot lisbon, influencer photography portugal",
    content: `## Why Content Creators Love Portugal

Portugal is an **Instagram goldmine**. Colorful streets, dramatic coastlines, stunning architecture, amazing food — every corner is content-ready. With a professional photographer, you get high-quality, original content that sets you apart.

## What You Get

A typical content creator session delivers:
- **50-150 edited photos** in 2 hours
- Multiple outfits and locations
- Mix of portrait, full-body, detail, and landscape shots
- Both vertical and horizontal formats
- Various styles — editorial, candid, flat-lay, action

## Best Locations for Content

### Lisbon
- **Pink Street** — iconic pink backdrop
- **LX Factory** — industrial-chic lifestyle content
- **Alfama** — colorful tiles and doors everywhere
- **Time Out Market** — food content paradise

### Porto
- **Livraria Lello** — most Instagrammed bookstore in the world
- **Ribeira** — colorful riverside facades
- **São Bento Station** — stunning blue tiles

## How to Brief Your Photographer

Share your brand aesthetic, example photos, content calendar, platform requirements, and any product placements.

## Tips for Maximum Content

- **Batch content** — one session can give you 4-6 weeks of posts
- **Bring props** — hats, sunglasses, coffee cups create variety
- **3-4 outfits** — casual, dressy, athleisure, night out
- **Film BTS** — "come with me to my photoshoot" reels perform well

Content creator packages range from **€150-400**. [Browse photographers](/photographers) and mention you're a content creator.`,
  },
  {
    slug: "rainy-day-photoshoot-portugal",
    title: "Rainy Day Photoshoot in Portugal: Amazing Photos in Bad Weather",
    excerpt: "Rain doesn't ruin your photoshoot. Some of the most atmospheric photos happen in moody weather.",
    meta_title: "Rainy Day Photoshoot in Portugal — Bad Weather Photography Tips",
    meta_description: "Don't cancel your Portugal photoshoot because of rain. Best indoor locations, outfit tips, and why rain photos are stunning.",
    target_keywords: "rainy day photoshoot portugal, bad weather photography lisbon, indoor photoshoot porto",
    content: `## Don't Cancel — Embrace It

Experienced photographers know that **overcast and rainy weather creates dramatic, atmospheric photos**. Before you reschedule, consider the magic of rain.

## Why Rainy Photos Can Be Better

- **No harsh shadows** — overcast sky is a giant softbox
- **Reflections everywhere** — wet cobblestones mirror lights and colors
- **Empty streets** — popular spots are all yours
- **Moody atmosphere** — adds emotion and drama
- **Unique content** — everyone has sunny photos, few have rainy ones

## Best Rainy Day Locations

### Lisbon
- **Alfama** — wet tiles create mirror-like reflections
- **Praça do Comércio** — reflections on the vast square
- **Under the arches** — shelter + framing in one
- **Trams** — shoot inside or as colorful backgrounds

### Porto
- **São Bento Station** — entirely indoor, beautiful tiles
- **Livraria Lello** — indoor and incredibly photogenic
- **Ribeira** — colors pop even more against grey skies

### Indoor Alternatives
- **Museums and palaces** — Pena Palace, National Tile Museum
- **Cafés** — Portuguese café culture is very photogenic
- **Covered markets** — Time Out Market, Bolhão Market

## What to Wear

- **Trench coat or stylish raincoat**
- **Clear umbrella** — a photographer's best friend
- **Boots** — stylish but waterproof
- **Bold colors** — red, yellow, blue pop against grey

On Photo Portugal, **weather rescheduling is always free**. But give light rain a chance — you might be surprised. [Book your session](/photographers).`,
  },
  {
    slug: "cascais-photoshoot-guide",
    title: "Cascais Photoshoot: The Portuguese Riviera in Photos",
    excerpt: "Cascais offers beach, town, and coastal scenery — all within 30 minutes from Lisbon.",
    meta_title: "Cascais Photoshoot Guide — Portuguese Riviera Photography",
    meta_description: "Plan a photoshoot in Cascais, Portugal. Best spots, timing tips, and how to combine with Sintra.",
    target_keywords: "cascais photoshoot, cascais photography, portuguese riviera photos",
    content: `## Why Cascais?

Just **30 minutes by train from Lisbon**, Cascais is the Portuguese Riviera — elegant, relaxed, and incredibly photogenic.

## Best Photo Spots

- **Cascais Marina** — colorful boats, blue water, town backdrop
- **Boca do Inferno** — dramatic cliff arch where waves crash
- **Casa da Guia** — clifftop gardens overlooking the ocean
- **Praia da Rainha** — tiny picturesque beach with turquoise water
- **Old Town Streets** — pastel buildings, flower-filled balconies
- **Coastal Path to Guincho** — dramatic cliff views and wildflowers

## Best Time for Photos

- **Morning (8-10am):** Soft light, empty streets and beaches
- **Late afternoon (5-7pm):** Golden light over the ocean
- **Avoid midday** in summer — crowded and harsh light

## Who Should Shoot in Cascais?

- **Families** — safer beaches and calmer vibes than Lisbon
- **Couples** — romantic seaside atmosphere
- **Solo travelers** — coastal elegance as your backdrop

## Combining with Sintra

Cascais and Sintra can be combined in a full-day session:
- **Morning:** Sintra palaces (fewer crowds)
- **Afternoon:** Cascais coastline (golden hour)

Photoshoots in Cascais cost **€120-300**. [Browse Cascais photographers](/photographers?location=cascais).`,
  },
  {
    slug: "anniversary-photoshoot-portugal",
    title: "Anniversary Photoshoot in Portugal: Celebrate Your Love Story",
    excerpt: "Mark your anniversary with a professional photoshoot in one of Europe's most romantic countries.",
    meta_title: "Anniversary Photoshoot in Portugal — Celebrate Your Love",
    meta_description: "Plan a romantic anniversary photoshoot in Portugal. Location ideas, session styles, and tips for couples.",
    target_keywords: "anniversary photoshoot portugal, couples anniversary photos lisbon, romantic photoshoot portugal",
    content: `## Why Portugal for Your Anniversary?

Whether it's your 1st or 25th, Portugal offers the perfect mix of romance, culture, and natural beauty.

## Anniversary Session Ideas

- **The Romantic Walk** — hand in hand through beautiful streets, stopping at cafés
- **The Golden Hour Experience** — sunset at a viewpoint with wine
- **The Adventure Session** — coastal hikes, beach walks, cliff-edge moments
- **The Cultural Experience** — historic palace, vibrant market, or Fado bar

## Best Locations by Vibe

### Classic Romance
- Alfama, Lisbon — sunset views from secret miradouros
- Sintra — fairy-tale palaces
- Ribeira, Porto — riverside dinner setting

### Beach Romance
- Cascais — elegant seaside town
- Comporta — secluded beach luxury
- Lagos — dramatic Algarve cliffs

### Wine & Dine
- Douro Valley — vineyard terraces at sunset
- Lisbon wine bars — intimate underground spaces

## Special Touches

- **Flowers** — a small bouquet adds color and romance
- **Champagne** — a toast at sunset is both genuine and photogenic
- **Outfit coordination** — match tones, not outfits

## When to Book

- **Spring (March-May):** Wildflowers, pleasant weather, fewer tourists
- **September-October:** Golden light, warm evenings
- **Valentine's week:** Book early — high demand

Anniversary photoshoots range from **€150-400**. [Browse our photographers](/photographers).`,
  },
  {
    slug: "spring-photoshoot-portugal",
    title: "Spring Photoshoot in Portugal: Why March-May Is Perfect",
    excerpt: "Spring is Portugal's best-kept secret for photography. Wildflowers, mild weather, and fewer crowds.",
    meta_title: "Spring Photoshoot in Portugal — Jacarandas, Flowers & Perfect Light",
    meta_description: "Why spring is the best time for a photoshoot in Portugal. Jacaranda season, wildflowers, weather tips.",
    target_keywords: "spring photoshoot portugal, jacaranda season lisbon photos, best time photography portugal",
    content: `## Why Spring Is the Best Season

While most tourists come in summer, **spring (March-May) is the real sweet spot**:

- **Wildflowers everywhere** — lavender, poppies, jacarandas
- **Pleasant temperatures** — 18-24°C, comfortable for outdoor sessions
- **Longer golden hours** — more shooting time
- **Fewer tourists** — popular spots are accessible
- **Green landscapes** — everything is lush after winter rain

## Spring Highlights by Month

### March
Almond blossoms in the Algarve and Douro Valley. Sintra's gardens at their greenest.

### April
Wisteria blooming on old buildings. Easter celebrations add cultural color. Perfect weather for all-day sessions.

### May
**Jacaranda season in Lisbon** — purple trees line entire streets. This is a global photography phenomenon.

## Jacaranda Season (Late April — Mid June)

**Best spots for jacaranda photos:**
- Praça do Comércio surroundings
- Jardim da Estrela
- Príncipe Real
- Graça neighborhood

**Tip:** Jacaranda petals on the ground are just as photogenic as the trees. After light rain, the purple carpet effect is stunning.

## What to Wear in Spring

- **Pastels** — blush, lavender, sage match the season
- **Light layers** — mornings can be cool, afternoons warm
- **Floral prints** — if there's ever a time for them, it's now

Spring is shoulder season — some photographers offer **lower rates** than summer. [Book your spring session](/photographers) — jacaranda season fills up fast!`,
  },
];

async function seed() {
  for (const post of posts) {
    try {
      await pool.query(
        `INSERT INTO blog_posts (slug, title, excerpt, content, meta_title, meta_description, target_keywords, author, is_published, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
         ON CONFLICT (slug) DO NOTHING`,
        [post.slug, post.title, post.excerpt, post.content, post.meta_title, post.meta_description, post.target_keywords, "Photo Portugal"]
      );
      console.log(`✓ ${post.slug}`);
    } catch (err) {
      console.error(`✗ ${post.slug}: ${err.message}`);
    }
  }
  await pool.end();
  console.log(`\nDone. ${posts.length} posts processed.`);
}

seed();
