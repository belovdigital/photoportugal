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
    title: "Couples Photoshoot Portugal — Romantic Vacation Photography",
    metaDescription:
      "Book a couples photoshoot in Portugal. Professional photographers in Lisbon, Porto, Sintra & Algarve. Natural, relaxed sessions. From €150.",
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
    title: "Family Photographer Portugal — Vacation Photos with Kids",
    metaDescription:
      "Book a family photoshoot in Portugal. Kid-friendly sessions in Lisbon, Algarve, Porto & more. Relaxed, natural photos. From €150.",
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
    title: "Proposal Photographer Portugal — Capture the Perfect Moment",
    metaDescription:
      "Hire a surprise proposal photographer in Portugal. Discreet photography in Lisbon, Sintra, Porto & Algarve. Verified reviews. From €200.",
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
    title: "Engagement Photoshoot Portugal — Pre-Wedding Sessions",
    metaDescription:
      "Book an engagement photoshoot in Portugal. Professional pre-wedding photography in Lisbon, Porto, Sintra & Algarve. From €150.",
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
    title: "Honeymoon Photographer Portugal — Capture Your First Adventure",
    metaDescription:
      "Book a honeymoon photoshoot in Portugal. Romantic photography for newlyweds in Lisbon, Algarve, Douro Valley & Madeira. From €150.",
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
    title: "Solo Travel Photoshoot Portugal — Professional Portraits",
    metaDescription:
      "Book a solo travel photoshoot in Portugal. Confident portraits at iconic locations in Lisbon, Porto & beyond. From €150.",
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
    title: "Elopement Photographer Portugal — Intimate Ceremony Photography",
    metaDescription:
      "Hire an elopement photographer in Portugal. Intimate ceremonies in Sintra, Algarve, Lisbon & Douro Valley. From €300.",
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
    title: "Friends Trip Photoshoot Portugal — Group & Bachelorette Photos",
    metaDescription:
      "Book a friends trip photoshoot in Portugal. Bachelorette parties, birthdays & group vacations in Lisbon, Porto & Algarve. From €150.",
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
  {
    slug: "wedding",
    name: "Wedding",
    title: "Wedding Photographer Portugal — Destination Wedding Photography",
    metaDescription:
      "Hire a wedding photographer in Portugal. Destination weddings in Lisbon, Sintra, Algarve, Douro Valley & more. Verified professionals. From €500.",
    h1: "Wedding Photography in Portugal",
    heroText:
      "Portugal has become one of Europe's most sought-after destination wedding locations — and with good reason. From vineyard estates in the Douro Valley to oceanfront venues in the Algarve, historic palaces in Sintra to rooftop celebrations in Lisbon, every setting tells a unique story. Our wedding photographers combine documentary-style storytelling with fine-art portraits, capturing every emotion from the nervous excitement of getting ready to the last dance of the night. They know Portugal's best venues, light conditions, and hidden spots for stunning couple portraits between the celebrations.",
    bestLocations: [
      { slug: "sintra", name: "Sintra", reason: "Palace venues, fairytale gardens, magical ceremony backdrops" },
      { slug: "algarve", name: "Algarve", reason: "Clifftop venues, beach ceremonies, golden sunset receptions" },
      { slug: "douro-valley", name: "Douro Valley", reason: "Vineyard estates, wine country elegance, panoramic terraces" },
      { slug: "lisbon", name: "Lisbon", reason: "Historic palaces, rooftop venues, city-view celebrations" },
      { slug: "comporta", name: "Comporta", reason: "Bohemian beach weddings, rice paddies, barefoot luxury" },
    ],
    faqs: [
      { question: "How far in advance should we book a wedding photographer in Portugal?", answer: "For peak season (May-October), we recommend booking 6-12 months in advance. Popular photographers and dates fill up quickly, especially for Saturday weddings. Off-season weddings have more flexibility." },
      { question: "How many hours of coverage do we need?", answer: "Most couples book 8-12 hours of coverage to capture everything from getting ready through the first dance. For intimate weddings, 6 hours may be sufficient. Full-day packages (up to 16 hours) are available for extended celebrations." },
      { question: "Do photographers travel to any venue in Portugal?", answer: "Yes! Our photographers cover weddings across all of Portugal. Travel within the photographer's home region is typically included. For weddings in other regions, a small travel fee may apply — this is shown upfront in each package." },
      { question: "Can we book a second photographer?", answer: "Absolutely. For weddings with 80+ guests, we strongly recommend a second photographer to capture simultaneous moments (e.g., both getting-ready preparations, guest reactions during the ceremony). Many photographers offer second-shooter add-ons." },
    ],
  },
  {
    slug: "maternity",
    name: "Maternity",
    title: "Maternity Photographer Portugal — Beautiful Pregnancy Photos",
    metaDescription:
      "Book a maternity photoshoot in Portugal. Stunning pregnancy photography in Lisbon, Cascais, Sintra & Algarve. Natural, elegant sessions. From €150.",
    h1: "Maternity Photoshoot in Portugal",
    heroText:
      "Pregnancy is one of life's most beautiful chapters, and Portugal provides the perfect backdrop to celebrate it. Whether you're a local expecting parent or visiting Portugal during your pregnancy, our photographers specialize in creating elegant, natural maternity portraits that you'll cherish forever. From the golden beaches of Cascais to Lisbon's sun-drenched gardens, Sintra's romantic palaces to the Algarve's dramatic coastline — every location offers a unique atmosphere for capturing this special moment. Our photographers know how to make you feel comfortable, confident, and radiant.",
    bestLocations: [
      { slug: "cascais", name: "Cascais", reason: "Sandy beaches, soft coastal light, relaxed seaside atmosphere" },
      { slug: "lisbon", name: "Lisbon", reason: "Botanical gardens, golden hour rooftops, elegant urban backdrops" },
      { slug: "sintra", name: "Sintra", reason: "Romantic forest paths, palace gardens, dreamy natural settings" },
      { slug: "algarve", name: "Algarve", reason: "Golden cliffs, serene beaches, warm Mediterranean light" },
    ],
    faqs: [
      { question: "When is the best time for a maternity photoshoot?", answer: "Most photographers recommend scheduling between 28-34 weeks of pregnancy, when your bump is beautifully visible but you're still comfortable moving around. However, every pregnancy is different — earlier or later sessions work well too." },
      { question: "What should I wear for a maternity session?", answer: "Flowing dresses, form-fitting fabrics, and neutral or soft colors photograph beautifully. Many photographers have a small collection of maternity gowns and fabrics you can borrow. Your photographer will send a style guide before the session." },
      { question: "Can my partner and other children be included?", answer: "Absolutely! Family maternity sessions are wonderful. Your photographer will capture a mix of solo maternity portraits and beautiful family moments. Including siblings makes for especially heartwarming photos." },
      { question: "What if I'm not feeling well on the day of the shoot?", answer: "Your comfort is the top priority. Free rescheduling is available if you're not feeling up to it. Sessions are also paced gently with plenty of breaks. Photographers are experienced with pregnant clients and prioritize your wellbeing." },
    ],
  },
  {
    slug: "anniversary",
    name: "Anniversary",
    title: "Anniversary Photoshoot Portugal — Celebrate Your Love Story",
    metaDescription:
      "Book an anniversary photoshoot in Portugal. Romantic photography for couples celebrating milestones in Lisbon, Porto, Sintra & Algarve. From €150.",
    h1: "Anniversary Photoshoot in Portugal",
    heroText:
      "Whether it's your 1st or your 50th, an anniversary trip to Portugal deserves to be captured beautifully. Our photographers specialize in creating relaxed, romantic portraits that reflect the depth of your relationship. Imagine recreating the magic of your early days together against the backdrop of Lisbon's golden-lit streets, raising a toast in a Douro Valley vineyard, or walking hand-in-hand along the Algarve coast. Anniversary photoshoots are a celebration of where your love has been and where it's going — and Portugal is the perfect place to tell that story.",
    bestLocations: [
      { slug: "lisbon", name: "Lisbon", reason: "Romantic rooftop dinners, golden hour walks, intimate Alfama streets" },
      { slug: "douro-valley", name: "Douro Valley", reason: "Wine tasting sessions, vineyard views, luxurious countryside" },
      { slug: "sintra", name: "Sintra", reason: "Timeless palace settings, romantic gardens, fairytale atmosphere" },
      { slug: "porto", name: "Porto", reason: "Riverside romance, port wine cellars, sunset over the Douro" },
      { slug: "algarve", name: "Algarve", reason: "Beach walks, cliff-top moments, golden coastal light" },
    ],
    faqs: [
      { question: "Can we incorporate a special dinner or activity into the shoot?", answer: "Yes! Many couples combine their anniversary session with a sunset dinner, wine tasting, or boat ride. Extended sessions work perfectly for this — your photographer captures both the portrait session and the celebration naturally." },
      { question: "We're not used to being photographed — will it feel awkward?", answer: "Not at all. Anniversary sessions are the most relaxed of all — you already know each other perfectly. Your photographer will give gentle direction but mostly capture natural moments: walking together, laughing, sharing a drink. Most couples say it felt like a date, not a photoshoot." },
      { question: "Can we recreate our wedding photos or a special moment?", answer: "Absolutely! Bring along any meaningful props — your wedding veil, a photo from your wedding day, or even your original outfits if they still fit. Photographers love incorporating personal elements into anniversary sessions." },
      { question: "Is this a good gift idea?", answer: "Anniversary photoshoots are one of the most popular gift bookings on our platform. You can book and receive a gift voucher to present to your partner. Many couples say it was the most thoughtful anniversary gift they've ever received." },
    ],
  },
  {
    slug: "birthday",
    name: "Birthday",
    title: "Birthday Photoshoot Portugal — Celebrate in Style",
    metaDescription:
      "Book a birthday photoshoot in Portugal. Solo or group celebrations in Lisbon, Porto & Algarve. Fun, professional photography. From €150.",
    h1: "Birthday Photoshoot in Portugal",
    heroText:
      "What better way to celebrate your birthday than with a professional photoshoot in one of Europe's most beautiful countries? Whether you're marking a milestone birthday with a solo portrait session, celebrating with your best friends in Lisbon, or having a family birthday getaway in the Algarve, our photographers capture the joy and energy of the occasion. From chic urban settings and rooftop bars to sun-drenched beaches and colorful streets, Portugal offers endless backdrops for birthday photos you'll actually want to frame.",
    bestLocations: [
      { slug: "lisbon", name: "Lisbon", reason: "Rooftop bars, vibrant streets, colorful neighborhoods" },
      { slug: "porto", name: "Porto", reason: "Wine cellars, riverside charm, Instagram-worthy spots" },
      { slug: "algarve", name: "Algarve", reason: "Beach parties, sunset cliffs, resort celebrations" },
      { slug: "cascais", name: "Cascais", reason: "Coastal elegance, beachfront restaurants, relaxed vibes" },
    ],
    faqs: [
      { question: "Can we do a photoshoot during a birthday dinner or party?", answer: "Yes! Photographers can cover your birthday dinner, rooftop party, or any celebration. Extended sessions work best for event coverage — typically 2-3 hours to capture the full atmosphere, from arrival through cake and celebrations." },
      { question: "Is this good for milestone birthdays (30th, 40th, 50th)?", answer: "Milestone birthday photoshoots are among our most popular bookings. Many clients use these photos for social media announcements, party invitations, or simply as a personal celebration of the milestone. Your photographer will make you feel and look amazing." },
      { question: "Can we bring balloons, cake, or other props?", answer: "Absolutely! Birthday props add personality and fun to the photos. Popular choices include number balloons, confetti, a small cake, champagne, and birthday banners. Your photographer can suggest locations that work well with props." },
      { question: "Can we combine the photoshoot with a group activity?", answer: "Many birthday groups combine their photoshoot with a walking tour, wine tasting, or boat trip. Your photographer can join for part of the activity and capture candid moments alongside more posed group photos." },
    ],
  },
  {
    slug: "content-creator",
    name: "Content Creator",
    title: "Content Creator Photography Portugal — Professional Content Shoots",
    metaDescription:
      "Book a content creator photoshoot in Portugal. Instagram, TikTok & brand content in Lisbon, Porto & Algarve. Professional quality. From €150.",
    h1: "Content Creator Photography in Portugal",
    heroText:
      "Portugal is a content creator's dream — vibrant colors, incredible architecture, golden light, and endless variety within a small area. Our photographers understand the content creation world: they know which angles work for Instagram Reels vs. static posts, how to capture both vertical and horizontal compositions, and how to create a cohesive set of images that elevates your brand. Whether you need a batch of Instagram content, TikTok behind-the-scenes, LinkedIn headshots, or brand photography for your website, our photographers deliver scroll-stopping content that performs.",
    bestLocations: [
      { slug: "lisbon", name: "Lisbon", reason: "Colorful tiles, trams, pink streets — the most 'grammable city in Europe" },
      { slug: "porto", name: "Porto", reason: "Blue azulejos, Lello Bookshop, Ribeira — instantly recognizable backdrops" },
      { slug: "sintra", name: "Sintra", reason: "Fairytale castles, lush gardens — fantasy content that goes viral" },
      { slug: "algarve", name: "Algarve", reason: "Benagil Cave, golden cliffs, turquoise water — travel content gold" },
    ],
    faqs: [
      { question: "How many photos will I get for my content?", answer: "For a 1-hour session, expect 50-80+ photos optimized for social media. A 2-hour session yields 100-150+ images. Photographers deliver both original edits and can provide cropped versions for different platforms (Stories, Reels, feed posts)." },
      { question: "Can the photographer shoot video too?", answer: "Some photographers offer hybrid photo/video packages. When booking, look for photographers who list video in their services, or ask about adding short-form video clips to your session. This is great for Reels and TikTok content." },
      { question: "Can I get a mix of candid and posed content?", answer: "Absolutely — that's the standard approach. Your photographer will capture a mix of walking shots, laughing candids, and more styled poses. Many creators bring a shot list or mood board, which photographers love working from." },
      { question: "Do you work with brands and influencers?", answer: "Yes! Many of our photographers have experience with brand campaigns, sponsored content, and influencer collaborations. They understand brand guidelines, shot lists, and deliverable requirements. Contact us for custom brand partnership packages." },
    ],
  },
];

export function getShootTypeBySlug(slug: string): ShootType | undefined {
  return shootTypes.find((t) => t.slug === slug);
}
