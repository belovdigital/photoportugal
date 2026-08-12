# 🇮🇹 Photo Italy — факты рынка

Третий инстанс, поднят к 09.08.2026. Всё общее для рынков — деплой, бэкапы,
схема, Stripe-модель, OAuth, Telegram, проверка на утечки — живёт в
[MARKETS.md](MARKETS.md). Здесь только специфика Италии.

> Этот файл заведён 12.08.2026, задним числом. Италия проработала несколько дней
> вообще без документации: инструкция, по которой её поднимали, называлась
> «Photo Spain — runbook» и описывала мир из двух стран. Из-за этого я планировал
> деплой на два прода вместо трёх и не знал, что третий бокс существует.
> Данные ниже сняты с живого сервера, а не восстановлены по памяти.

---

## Инфраструктура

| | |
|---|---|
| IP | `167.235.139.73` |
| ssh | `hetzner-pi` |
| ОС | Ubuntu 24.04.4 LTS, Node 20.20.2, Postgres 16.14 |
| Домен | `photoitaly.co`, TLS выпущен |
| База | `photoitaly` |
| `COUNTRY` | `it` |
| Локали | `en, it, de, fr, es` |
| Каталоги | `/var/www/photoitaly{,-incoming,-blue,-green,-active}` |
| pm2 | `photoitaly-{blue,green}`, `photoitaly-ws` |

### R2

| | |
|---|---|
| Бакет | `photoitaly` |
| Публичный домен | `https://files.photoitaly.co` |

⚠️ CORS проверить отдельно — он ставится руками в дашборде и без него не
загрузится портфолио фотографа. См. [SPAIN.md](SPAIN.md) для образца политики.

### Почта

`info@photoitaly.co` на Migadu, `smtp.migadu.com:587` (не 465 — Hetzner блокирует
исходящие 465 и 25).

---

## Интеграции — состояние на 12.08.2026

Снято с `.env` живого бокса.

| | Статус |
|---|---|
| Stripe | ✅ `acct_1U1rZWK0drw4xFC5`, `charges_enabled: true` |
| Stripe webhook secret | ✅ задан |
| Каталог Stripe | ✅ свой: Pro `price_1U1rhCK0drw4xFC5t8yiknUl`, Premium `price_1U1rhDK0drw4xFC5cAolMfjG` |
| `business_profile.url` | ✅ уже `https://photoitaly.co` — грабли Испании не повторились |
| Google OAuth client | ✅ `323100968266-u1540prpvg5ckmfl2a69lf04k01sv9kv` |
| Telegram bot + topics | ✅ свои, чат `-1004321063064` |
| Бэкапы | ✅ `backup-db.sh` и `check-backups.sh` в кроне |
| Шифрование `.env` | ✅ `ENV_BACKUP_PASSPHRASE` задан |
| Intercom | — выключен (`INTERCOM_ACCESS_TOKEN` пуст), как и в Испании |

Крон: 15 задач, включая бэкап и сторож.

---

## Контент

Датасет локаций — `src/lib/locations-data-it.ts`, **24 локации**.

Как и в Испании, на итальянские слаги не перенесены `nearbyLocationsMap` и
`locationFaqs` (они в `locations-data.ts` только под португальские слаги), а
обложки `/images/locations/{slug}-cover.jpg` не залиты.

---

## Состояние базы на 12.08.2026

6 пользователей, 4 профиля фотографов, 1 бронь. Колонка рынка `country`
заведена.

Календарных подключений — ноль, поэтому баг с нулевыми интервалами Google
(см. [MARKETS.md](MARKETS.md) и память по `calendar_sync`) Италию не задел.

---

## Открыто

- [ ] Проверить CORS на бакете `photoitaly` — без него портфолио не грузится
- [ ] Верификация итальянского OAuth-приложения в Google (скоуп
      `calendar.readonly` sensitive; до верификации календарь подключают только
      аккаунты из Test users)
- [ ] DNS Migadu (MX / SPF / DKIM / DMARC) на photoitaly.co — проверить
- [ ] Подтверждение владения `photoitaly.co` в Google Search Console
- [ ] `REGION_CHILDREN` в `AdminBookingsList.tsx` — итальянского аналога нет,
      как и испанского; до первой blind-брони в Италии починить
- [ ] Обложки локаций и блог
