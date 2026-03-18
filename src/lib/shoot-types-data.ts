export interface ShootType {
  slug: string;
  name: string;
  title: string;
  metaDescription: string;
  h1: string;
  heroText: string;
  bestLocations: { slug: string; name: string; reason: string }[];
  faqs: { question: string; answer: string }[];
}

export const shootTypes: ShootType[] = [
  {
    slug: "couples",
    name: "Couples",
    title: "Couples Photoshoot in Portugal — Romantic Vacation Photography",
    metaDescription:
      "Book a professional couples photoshoot in Portugal. Romantic sessions in Lisbon, Porto, Sintra & Algarve. Capture your love story with a local photographer. From EUR150.",
    h1: "Couples Photoshoot in Portugal",
    heroText:
      "Portugal is one of Europe's most romantic destinations, and there's no better way to celebrate your relationship than with a professional couples photoshoot. Whether you're exploring Lisbon's golden-lit streets hand in hand, watching the sunset over Porto's Douro River, or strolling through Sintra's fairytale gardens, our photographers know exactly how to capture the magic between you. No awkward posing -- just natural, beautiful moments guided by someone who knows Portugal's most intimate and photogenic spots.",
    bestLocations: [
      { slug: "lisbon", name: "Lisbon", reason: "Golden light, Alfama's charming streets, romantic miradouro viewpoints" },
      { slug: "sintra", name: "Sintra", reason: "Fairytale palaces, enchanted forests, dreamy romantic atmosphere" },
      { slug: "porto", name: "Porto", reason: "Dramatic Douro River sunsets, Ribeira waterfront, baroque charm" },
      { slug: "algarve", name: "Algarve", reason: "Golden cliff beaches, hidden sea caves, stunning coastal walks" },
      { slug: "douro-valley", name: "Douro Valley", reason: "Vineyard terraces, wine estates, golden countryside light" },
    ],
    faqs: [
      { question: "How long is a typical couples photoshoot in Portugal?", answer: "Most couples sessions last 1-2 hours, which is enough time to visit 2-3 locations and capture a variety of natural, relaxed poses. Some photographers also offer 30-minute mini sessions for quick portrait shots." },
      { question: "What should we wear for a couples photoshoot?", answer: "Coordinate without matching -- choose complementary colors and classic styles. Solid colors photograph best. Your photographer can provide specific styling advice based on your chosen location and time of day." },
      { question: "When is the best time of day for a couples photoshoot?", answer: "Golden hour (the hour after sunrise or before sunset) provides the most flattering, warm light. In Lisbon and Porto, sunset shoots are especially popular. Your photographer will recommend the ideal timing." },
      { question: "Can we combine multiple locations in one session?", answer: "Yes! Many couples book a 2-hour session that covers 2-3 nearby locations. For example, in Lisbon you might start at a miradouro viewpoint, walk through Alfama, and finish at the waterfront." },
    ],
  },
  {
    slug: "family",
    name: "Family",
    title: "Family Photoshoot in Portugal — Vacation Photography with Kids",
    metaDescription:
      "Book a professional family photoshoot in Portugal. Kid-friendly locations in Lisbon, Porto, Algarve & more. Natural, fun family portraits. From EUR150.",
    h1: "Family Photoshoot in Portugal",
    heroText:
      "Family vacations in Portugal create memories that last a lifetime -- but only if you're actually in the photos. Our photographers specialize in natural, relaxed family photography that captures genuine moments of joy, laughter, and connection. They know the best kid-friendly locations, how to keep little ones engaged, and how to make the whole experience feel like an adventure rather than a chore. From building sandcastles on the Algarve to exploring Lisbon's colorful neighborhoods, your family photos will be ones you'll treasure forever.",
    bestLocations: [
      { slug: "lisbon", name: "Lisbon", reason: "Tram rides, colorful streets, waterfront parks -- endless fun for kids" },
      { slug: "algarve", name: "Algarve", reason: "Beautiful beaches, calm waters, and dramatic cliff backdrops" },
      { slug: "cascais", name: "Cascais", reason: "Sandy beaches, seaside promenade, relaxed coastal atmosphere" },
      { slug: "sintra", name: "Sintra", reason: "Castle explorations, magical gardens, fairytale atmosphere kids love" },
      { slug: "porto", name: "Porto", reason: "Riverside walks, garden parks, vibrant and colorful backdrops" },
    ],
    faqs: [
      { question: "What if my kids won't cooperate during the photoshoot?", answer: "Our photographers are experienced with children of all ages. They use games, jokes, and natural play to capture authentic moments. Some of the best family photos come from spontaneous, unscripted moments. Don't worry about perfection -- that's what makes family photos special." },
      { question: "What's the best age for a family photoshoot?", answer: "Every age is perfect! Photographers adapt their approach: for toddlers, they focus on natural play; for older kids, they make it fun and interactive. Even babies photograph beautifully in Portugal's warm, natural light." },
      { question: "How should we dress for a family photoshoot?", answer: "Choose a coordinated color palette (not matching outfits). Earth tones, pastels, and blues work well in Portugal. Comfortable shoes are important, especially for Lisbon's cobblestone hills. Your photographer can send a style guide." },
      { question: "Can we bring a stroller or baby carrier?", answer: "Absolutely. Your photographer will plan a route that's stroller-friendly if needed. For locations with stairs (like Alfama in Lisbon), they'll suggest accessible alternatives or spots where you can park the stroller briefly." },
    ],
  },
  {
    slug: "proposal",
    name: "Proposal",
    title: "Proposal Photographer in Portugal — Capture the Perfect Moment",
    metaDescription:
      "Plan a surprise proposal in Portugal with a professional photographer. Secret photoshoots in Lisbon, Porto, Sintra. We coordinate everything. From EUR200.",
    h1: "Surprise Proposal Photography in Portugal",
    heroText:
      "Planning to pop the question in Portugal? Our photographers are experts at capturing surprise proposals -- discreetly positioned to photograph every genuine reaction, tear of joy, and that unforgettable 'yes' moment. From choosing the perfect spot to coordinating timing, our team helps you plan every detail so you can focus on the most important question of your life. Portugal offers some of the most breathtaking proposal backdrops in Europe: Sintra's fairytale palaces, Lisbon's panoramic viewpoints, and the Algarve's dramatic cliffs.",
    bestLocations: [
      { slug: "sintra", name: "Sintra", reason: "Pena Palace gardens, Regaleira's romantic terraces -- fairy-tale worthy" },
      { slug: "lisbon", name: "Lisbon", reason: "Sunset at Miradouro da Graca, rooftop views, intimate Alfama streets" },
      { slug: "porto", name: "Porto", reason: "Dom Luis Bridge at sunset, Jardins do Palacio de Cristal viewpoint" },
      { slug: "algarve", name: "Algarve", reason: "Secluded cliff-top spots, golden beach sunsets, sea cave proposals" },
    ],
    faqs: [
      { question: "How do proposal photoshoots work?", answer: "You'll coordinate with your photographer in advance. They'll scout the location, position themselves discreetly (often pretending to photograph scenery), and capture the entire moment from the approach to the ring reveal to the celebration after. Most proposals include 30-60 minutes of couple photos afterward." },
      { question: "Will my partner know the photographer is there?", answer: "No -- our photographers are experts at blending in. They'll be positioned to look like a tourist or casual photographer. Your partner won't suspect a thing until you're ready to reveal the surprise." },
      { question: "What if the weather is bad on proposal day?", answer: "Your photographer will have backup indoor and covered locations ready. They'll communicate with you the day before to discuss weather alternatives. Free rescheduling is available if conditions are truly unfavorable." },
      { question: "Can the photographer help me choose a proposal spot?", answer: "Absolutely! Our photographers know the most romantic, private, and photogenic spots in their city. They'll recommend locations based on your preferences, the time of day, and crowd levels." },
    ],
  },
  {
    slug: "engagement",
    name: "Engagement",
    title: "Engagement Photographer in Portugal — Pre-Wedding Photoshoots",
    metaDescription:
      "Book a professional engagement photoshoot in Portugal. Beautiful pre-wedding sessions in Lisbon, Porto, Sintra & Algarve. Destination engagement photography.",
    h1: "Engagement Photoshoot in Portugal",
    heroText:
      "You said yes -- now it's time to celebrate with stunning engagement photos in one of Europe's most romantic countries. Portugal offers an incredible variety of backdrops for your pre-wedding photoshoot: from Lisbon's sun-drenched terraces and Porto's historic riverside to Sintra's enchanted palaces and the Algarve's dramatic coastline. Whether you're planning a destination wedding in Portugal or simply want engagement photos in a breathtaking setting, our photographers will create images that capture the joy and excitement of this special chapter.",
    bestLocations: [
      { slug: "lisbon", name: "Lisbon", reason: "Iconic trams, golden light, romantic rooftop terraces" },
      { slug: "sintra", name: "Sintra", reason: "Fairytale palaces, lush gardens, magical and romantic" },
      { slug: "douro-valley", name: "Douro Valley", reason: "Vineyard-covered hills, wine estates, editorial-quality settings" },
      { slug: "porto", name: "Porto", reason: "Colorful Ribeira district, historic bridges, artistic atmosphere" },
      { slug: "algarve", name: "Algarve", reason: "Dramatic cliffs, secret beaches, warm coastal light" },
    ],
    faqs: [
      { question: "How far in advance should we book our engagement photoshoot?", answer: "We recommend booking 2-4 weeks in advance, especially during peak season (May-September). However, some photographers accept bookings with shorter notice depending on availability." },
      { question: "Can we use engagement photos for our save-the-dates?", answer: "Yes! You'll receive high-resolution digital files that are perfect for save-the-dates, wedding websites, invitations, and social media announcements. Delivery time depends on the photographer and package you choose." },
      { question: "What's the difference between an engagement and couples session?", answer: "The shoot itself is similar, but engagement sessions often focus on creating formal photos for wedding-related stationery and announcements. Many couples also dress slightly more formally. The pricing and duration are typically the same." },
      { question: "Can we combine our engagement session with wedding scouting?", answer: "Absolutely! If you're planning a destination wedding in Portugal, your photographer can help you explore potential venues and ceremony locations during the session." },
    ],
  },
  {
    slug: "honeymoon",
    name: "Honeymoon",
    title: "Honeymoon Photographer in Portugal — Romantic Getaway Photos",
    metaDescription:
      "Book a honeymoon photoshoot in Portugal. Celebrate your new marriage with stunning photos in Lisbon, Algarve, Porto & more. Professional romantic photography.",
    h1: "Honeymoon Photoshoot in Portugal",
    heroText:
      "Your honeymoon in Portugal deserves to be remembered with more than phone photos. Our photographers capture the romance, joy, and adventure of your first trip as newlyweds. Imagine a sunrise session on the Algarve's golden cliffs, a golden hour stroll through Lisbon's most romantic neighborhoods, or a vineyard photoshoot in the Douro Valley with views that stretch for miles. These are the photos you'll frame, share, and look back on for decades. Relaxed, intimate, and beautifully natural.",
    bestLocations: [
      { slug: "algarve", name: "Algarve", reason: "Secluded beaches, sunset cliffs, ultimate romantic backdrop" },
      { slug: "douro-valley", name: "Douro Valley", reason: "Wine country romance, vineyard terraces, golden landscapes" },
      { slug: "lisbon", name: "Lisbon", reason: "City of light -- rooftop bars, tram rides, waterfront sunsets" },
      { slug: "madeira", name: "Madeira", reason: "Tropical gardens, dramatic cliffs, island paradise vibes" },
      { slug: "comporta", name: "Comporta", reason: "Bohemian luxury, pristine beaches, editorial-quality scenes" },
    ],
    faqs: [
      { question: "When should we schedule our honeymoon photoshoot?", answer: "Many couples book their photoshoot for the second or third day of their honeymoon, once they've settled in and explored a bit. This also gives you a buffer in case of weather issues." },
      { question: "What's included in a honeymoon photoshoot package?", answer: "Most packages include 1-2 hours of photography, 50-100+ professionally edited photos delivered digitally to your private gallery, and a pre-shoot consultation to plan locations and styling. Some photographers offer add-ons like photo books or prints. Delivery time is shown on each package." },
      { question: "Can we bring props like champagne or flowers?", answer: "Absolutely! Props add a personal touch. Popular honeymoon props include champagne, flower bouquets, 'Just Married' signs, and picnic setups. Your photographer can advise on what works best for your chosen location." },
      { question: "Do you offer sunrise sessions?", answer: "Yes! Sunrise sessions are stunning in Portugal and come with the bonus of having famous locations nearly to yourselves. In Lisbon, the sunrise light over the Tagus River is magical. Your photographer will meet you at the agreed time." },
    ],
  },
  {
    slug: "solo",
    name: "Solo Travel",
    title: "Solo Travel Photographer in Portugal — Photos of Your Adventure",
    metaDescription:
      "Book a solo travel photoshoot in Portugal. Professional portraits for solo travelers in Lisbon, Porto & beyond. Instagram-worthy vacation photos. From EUR150.",
    h1: "Solo Travel Photography in Portugal",
    heroText:
      "Traveling solo doesn't mean you should be absent from your own vacation photos. Our photographers help solo travelers capture confident, beautiful portraits that tell the story of your Portugal adventure. Whether you want Instagram-worthy shots at iconic landmarks, natural lifestyle photos exploring local neighborhoods, or a mix of both, your photographer will guide you through poses and help you feel relaxed and confident in front of the camera. You'll walk away with professional photos that capture your solo travel experience beautifully.",
    bestLocations: [
      { slug: "lisbon", name: "Lisbon", reason: "Colorful streets, iconic trams, endless Instagram-worthy backdrops" },
      { slug: "porto", name: "Porto", reason: "Dramatic riverfront, azulejo-covered churches, artistic vibes" },
      { slug: "sintra", name: "Sintra", reason: "Fairytale castles, lush forests -- incredible portrait settings" },
      { slug: "nazare", name: "Nazare", reason: "Dramatic ocean, clifftop fortress, raw Atlantic energy" },
    ],
    faqs: [
      { question: "I'm shy in front of the camera -- will I look awkward?", answer: "Not at all! Our photographers are experts at helping people feel comfortable. They'll guide you through natural movements and poses -- walking, looking away, laughing. Most solo travelers say they felt relaxed within the first 5 minutes." },
      { question: "How many photos will I receive?", answer: "For a 1-hour session, expect 40-60+ professionally edited photos. A 2-hour session typically yields 80-120+ photos. All images are delivered in high resolution, perfect for printing and social media." },
      { question: "Can I use the photos for my blog or social media?", answer: "Yes! All photos are yours to use however you'd like -- Instagram, blog, dating profiles, LinkedIn, or personal memories. You'll receive full digital rights with your package." },
      { question: "What if I want both portrait and landmark photos?", answer: "Our photographers are great at mixing portrait-style shots with wider environmental photos that show you in context. A 1-2 hour session gives plenty of time for both intimate portraits and iconic landmark shots." },
    ],
  },
  {
    slug: "elopement",
    name: "Elopement",
    title: "Elopement Photographer in Portugal — Intimate Wedding Photography",
    metaDescription:
      "Book an elopement photographer in Portugal. Intimate weddings and micro-ceremonies in Lisbon, Sintra, Algarve & more. Professional elopement photography packages.",
    h1: "Elopement Photography in Portugal",
    heroText:
      "Portugal has become one of Europe's most popular elopement destinations, and for good reason. Imagine exchanging vows in a fairytale palace garden in Sintra, on a dramatic Algarve clifftop overlooking the Atlantic, or in a centuries-old Lisbon courtyard bathed in golden light. Our elopement photographers don't just take photos -- they document the intimate, emotional journey of your most special day. From getting-ready moments to the first kiss and celebration dinner, every detail is captured with artistry and heart. Portugal's year-round sunshine, diverse landscapes, and welcoming culture make it the perfect elopement destination.",
    bestLocations: [
      { slug: "sintra", name: "Sintra", reason: "Pena Palace, Monserrate gardens -- fairy-tale ceremony settings" },
      { slug: "algarve", name: "Algarve", reason: "Clifftop ceremonies, beach vows, sunset celebrations" },
      { slug: "lisbon", name: "Lisbon", reason: "Historic venues, rooftop ceremonies, old-world romance" },
      { slug: "douro-valley", name: "Douro Valley", reason: "Vineyard wedding venues, wine country celebrations" },
      { slug: "evora", name: "Evora", reason: "Ancient Roman ruins, Alentejo countryside, rustic elegance" },
    ],
    faqs: [
      { question: "Do I need a permit to elope in Portugal?", answer: "For a symbolic ceremony (non-legal), you generally don't need permits for most outdoor locations, though some sites like Pena Palace may require advance booking. For legal ceremonies, you'll need to register at a local civil registry office. Your photographer can connect you with local wedding planners who handle all logistics." },
      { question: "How long does an elopement photography session last?", answer: "Elopement sessions typically last 2-4 hours, covering getting ready, the ceremony, couple portraits, and celebration moments. Full-day elopement packages (6-8 hours) are also available for couples who want comprehensive coverage." },
      { question: "Can our photographer recommend ceremony locations?", answer: "Yes! Our photographers have extensive knowledge of Portugal's most beautiful ceremony locations, including hidden spots that tourists rarely find. They'll suggest options based on your style, guest count, and time of year." },
      { question: "What about witnesses -- do we need them?", answer: "For a legal ceremony in Portugal, you need two witnesses. Many couples bring friends or family, but if you're eloping just the two of you, your photographer and a second shooter or wedding planner can often serve as official witnesses." },
    ],
  },
  {
    slug: "friends",
    name: "Friends Trip",
    title: "Friends Trip Photoshoot in Portugal — Group Vacation Photography",
    metaDescription:
      "Book a group photoshoot for your friends trip in Portugal. Bachelorette parties, birthday trips & group vacations. Fun, natural group photography. From EUR150.",
    h1: "Friends Trip Photoshoot in Portugal",
    heroText:
      "Traveling with friends to Portugal? Make it unforgettable with a professional group photoshoot. Whether it's a bachelorette weekend in Lisbon, a birthday celebration in Porto, or a reunion trip to the Algarve, our photographers know how to capture the energy, laughter, and connection of your group. From candid moments at a rooftop bar to group portraits with stunning backdrops, you'll leave with photos that everyone in the group will actually want to post. No more awkward group selfies or asking strangers to take your picture.",
    bestLocations: [
      { slug: "lisbon", name: "Lisbon", reason: "Vibrant nightlife areas, rooftop bars, colorful street art" },
      { slug: "porto", name: "Porto", reason: "Wine cellars, riverfront, Instagram-worthy spots everywhere" },
      { slug: "algarve", name: "Algarve", reason: "Beach days, boat trips, cliff-top group shots" },
      { slug: "cascais", name: "Cascais", reason: "Beach town charm, coastal walks, relaxed group vibes" },
    ],
    faqs: [
      { question: "How many people can be in a group photoshoot?", answer: "Most photographers accommodate groups of 2-10 people in their standard packages. For larger groups (10-20+), let us know in advance and we can pair you with photographers experienced in large group photography or arrange two photographers." },
      { question: "Can we do a photoshoot during a bachelorette party?", answer: "Absolutely! Bachelorette photoshoots are one of our most popular group bookings. Photographers can capture both fun, posed group shots and candid party moments. Props, matching outfits, and creative themes are all welcome." },
      { question: "What if some people in the group are camera-shy?", answer: "Our photographers are great at making everyone feel included and comfortable. They'll mix group shots with candid moments, so even camera-shy friends end up with natural, relaxed photos they love." },
      { question: "Can we combine a photoshoot with a food or wine tour?", answer: "Many photographers offer extended sessions that can incorporate stops at local restaurants, wine bars, or markets. This creates a natural, documentary-style set of photos that captures the full experience of your trip." },
    ],
  },
];

export function getShootTypeBySlug(slug: string): ShootType | undefined {
  return shootTypes.find((t) => t.slug === slug);
}
