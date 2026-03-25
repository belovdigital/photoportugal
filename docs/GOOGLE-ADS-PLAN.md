# Google Ads Plan — Photo Portugal

## Цель

Получить первых платящих клиентов через Google Search Ads. Целевая цена лида (booking request): €5-15.

---

## Структура аккаунта

### Кампания 1: Lisbon (приоритет — максимальный объём запросов)

| Ad Group | Keywords (phrase/exact match) | Лендинг |
|----------|-------------------------------|---------|
| Vacation photographer | `photographer in lisbon`, `vacation photographer lisbon`, `photoshoot in lisbon` | /locations/lisbon |
| Couples | `couples photoshoot lisbon`, `couple photographer lisbon`, `romantic photoshoot lisbon` | /photoshoots/couples |
| Family | `family photographer lisbon`, `family photoshoot lisbon` | /photoshoots/family |
| Proposal | `proposal photographer lisbon`, `surprise proposal lisbon` | /photoshoots/proposal |
| Solo/Portrait | `solo photoshoot lisbon`, `portrait photographer lisbon for tourists` | /photoshoots/solo-portrait |

### Кампания 2: Porto

| Ad Group | Keywords | Лендинг |
|----------|----------|---------|
| Vacation photographer | `photographer in porto`, `vacation photographer porto`, `photoshoot in porto` | /locations/porto |
| Couples | `couples photoshoot porto`, `couple photographer porto` | /photoshoots/couples |
| Proposal | `proposal photographer porto`, `where to propose porto` | /photoshoots/proposal |

### Кампания 3: Algarve + Sintra

| Ad Group | Keywords | Лендинг |
|----------|----------|---------|
| Algarve general | `photographer algarve`, `vacation photoshoot algarve`, `lagos photographer` | /locations/algarve |
| Sintra | `photographer sintra`, `photoshoot sintra`, `proposal photographer sintra` | /locations/sintra |

### Кампания 4: Brand-generic Portugal

| Ad Group | Keywords | Лендинг |
|----------|----------|---------|
| Vacation photographer | `vacation photographer portugal`, `hire photographer portugal`, `book photographer portugal` | / (homepage) |
| Elopement | `elopement photographer portugal`, `elope in portugal` | /photoshoots/elopement |
| Honeymoon | `honeymoon photographer portugal`, `honeymoon photoshoot portugal` | /photoshoots/honeymoon |
| Wedding | `wedding photographer portugal for tourists`, `destination wedding photographer portugal` | /photoshoots/wedding |

### Кампания 5: Competitors

| Ad Group | Keywords | Лендинг |
|----------|----------|---------|
| Flytographer | `flytographer portugal`, `flytographer lisbon`, `flytographer alternative` | /blog/flytographer-alternative-portugal |
| Other | `localens portugal`, `shoott lisbon`, `perfocal portugal` | / |

---

## Объявления (шаблоны)

### Vacation Photographer Lisbon (пример)

**Headlines (15 вариантов, Google миксует):**
1. Photographer in Lisbon
2. Book a Vacation Photoshoot
3. Professional Photos from €90
4. Lisbon's Best Photo Spots
5. 48-Hour Photo Delivery
6. Local Photographers in Lisbon
7. Couples, Family & Solo Shoots
8. 100% Payment Protection
9. Free Cancellation 7+ Days
10. Browse Portfolios & Book Online
11. Capture Your Lisbon Memories
12. Trusted by Tourists Since 2026
13. Compare Prices & Styles
14. Golden Hour Sessions Available
15. Rated 5★ by Travelers

**Descriptions (4 варианта):**
1. Book a professional local photographer in Lisbon. Browse portfolios, compare packages from €90, and book online. Photos delivered within 48 hours.
2. Capture your vacation in Lisbon with a professional photoshoot. Couples, family, proposal & solo sessions at the city's most iconic spots.
3. 100% payment protection with Stripe escrow. Free cancellation 7+ days before. No risk — pay only when you love your photos.
4. Professional vacation photography in Lisbon. Choose your photographer, pick a date, and get stunning photos at Alfama, Belém, and more.

**Sitelinks:**
- Couples Photoshoot → /photoshoots/couples
- Family Photoshoot → /photoshoots/family
- Proposal Photography → /photoshoots/proposal
- View Pricing → /pricing
- Our Photographers → /photographers
- How It Works → /#how-it-works

**Callouts:**
- 100% Payment Protection
- Photos in 48 Hours
- Free Cancellation
- From €90/Session
- Local Photographers

**Structured Snippets:**
- Types: Couples, Family, Solo, Proposal, Wedding, Elopement, Honeymoon

---

## Настройки кампаний

- **Bid strategy:** Maximize Conversions (после 30 конверсий → Target CPA)
- **Match types:** Phrase + Exact (без Broad на старте)
- **Geo-targeting:** Worldwide, exclude Portugal (местным не нужен vacation photographer)
- **Language targeting:** English (primary), потом добавить German, French, Spanish
- **Device:** All, без корректировок на старте
- **Schedule:** All day (туристы в разных часовых поясах)
- **Daily budget:** €10-15 на кампанию Lisbon, €5-10 на остальные
- **Negative keywords:** см. ниже

---

## Negative Keywords (общий список)

```
free
cheap
course
tutorial
how to become
photography school
camera
lens
stock photo
wedding planner
real estate
product photography
food photography
model
casting
job
salary
instagram filter
photoshop
lightroom
DIY
self portrait
```

---

## Конверсии (трекинг)

### Primary conversions (для оптимизации):
1. **booking_request** — клиент отправил запрос на бронирование (begin_checkout event)
2. **payment_completed** — клиент оплатил (purchase event)

### Secondary conversions (для наблюдения):
3. **contact_form** — отправка формы на /contact
4. **message_sent** — сообщение фотографу
5. **view_photographer** — просмотр профиля (view_item event)

---

## Что сделать ДО создания Google Ads аккаунта

### 1. Конверсии в GA4 ✅ → нужно проверить/доработать
- [ ] Убедиться что `begin_checkout` (booking request) корректно пробрасывается с value
- [ ] Убедиться что `purchase` (payment) передаёт реальную сумму
- [ ] Пометить оба как "key events" в GA4

### 2. Лендинги — оптимизация под рекламу
- [ ] Добавить на страницы локаций блок "How It Works" (3 шага: Browse → Book → Get Photos)
- [ ] Добавить trust signals: "100% Payment Protection", "Free Cancellation", "48h Delivery"
- [ ] Добавить CTA-кнопку "Browse Photographers" выше на странице (above the fold)
- [ ] Проверить mobile UX — 70%+ трафика будет мобильный
- [ ] Page speed: убедиться LCP < 2.5s на всех лендинг-страницах

### 3. Structured data
- [ ] Добавить Organization schema на homepage с aggregateRating (когда будут отзывы)
- [ ] Проверить что все страницы имеют корректные og:title, og:description, og:image

### 4. Google Tag Manager / gtag
- [ ] Установить Google Ads conversion tag (gtag snippet или GTM)
- [ ] Настроить Enhanced Conversions (передача email при конверсии)
- [ ] Подготовить remarketing tag (для будущего ретаргетинга)

### 5. Тексты объявлений
- [x] Headlines и descriptions подготовлены (см. выше)
- [ ] Адаптировать под Porto, Algarve, Sintra (заменить город + spots)
- [ ] Подготовить ad copy для каждого shoot type

### 6. Конкурентный анализ
- [ ] Проверить какие объявления крутят Flytographer, Localens, Shoott в Portugal
- [ ] Записать их headlines/descriptions/лендинги для референса
- [ ] Определить их примерные ставки через Keyword Planner (нужен Google Ads аккаунт)

---

## Бюджет и прогноз

| Фаза | Период | Бюджет/день | Цель |
|-------|--------|-------------|------|
| Тест | Неделя 1-2 | €15-20 | Собрать данные, найти работающие ключевики |
| Оптимизация | Неделя 3-4 | €15-20 | Отключить плохое, масштабировать хорошее |
| Масштаб | Месяц 2+ | €30-50 | Target CPA, добавить новые кампании |

**Ожидания (консервативно):**
- CPC: €0.50-2.00 (зависит от ключевика)
- CTR: 5-10% (Search)
- Conversion rate (лендинг → booking request): 3-5%
- Стоимость лида: €10-30 на старте → €5-15 после оптимизации
- Первый месяц: 20-50 booking requests при бюджете €500

---

## Последовательность запуска

1. ⬜ Настроить конверсии в GA4 + пометить как key events
2. ⬜ Оптимизировать лендинги (trust signals, CTA, speed)
3. ⬜ Создать Google Ads аккаунт + связать с GA4
4. ⬜ Импортировать конверсии из GA4
5. ⬜ Создать Кампанию 1 (Lisbon) — самый большой объём
6. ⬜ Запустить на €15/день, подождать 5-7 дней
7. ⬜ Анализ: CTR, CPC, конверсии, качество лидов
8. ⬜ Добавить Кампанию 4 (Portugal generic)
9. ⬜ Добавить Porto, Algarve
10. ⬜ Добавить Competitors кампанию
