# ROUT oplevering + hybride identiteitsverificatie

## Fase 1 — Gezondheid (Taak A)
- `tsgo --noEmit` en `bunx vitest run` draaien; alle fouten oplossen, extra aandacht voor `ProtonMark.tsx` en `ShortLinksPanel.tsx`.
- Scan op hardcoded kleuren (`bg-[#`, `text-white`, `text-black`) en vervangen door tokens.

## Fase 2 — Opruimen van bestanden (Taak B)
- `api_.public.cron.cleanup-assets.ts` uitbreiden: verlopen `user_assets` én `shared_files` in batches; per object S3-delete in try/catch, DB-rij alleen wissen na geslaagde (of 404) delete; resultaat `{deleted, failed}`.
- Cron-schema documenteren in `ENVIRONMENT.md` + `vercel.json` crons (Vercel-preset) en een voorbeeld voor externe cron (Bearer `CRON_SECRET`).
- Tests voor fail-safe batchgedrag.

## Fase 3 — Opera/Chromium (Taak C)
- Alle `localStorage`/`sessionStorage`-lezingen in render/useState-initializers verplaatsen naar `useEffect`/`useHydrated`, met try/catch (geblokkeerde opslag).
- QR- en avatarframe-SVG: unieke `useId()`-ids voor filter/clipPath-defs (botsende ids veroorzaken glitches), geen `url(#..)` met relatieve base-href.

## Fase 4 — Eigen domein DNS (Taak D)
- Dashboardstap met te kopiëren TXT- (`_rout-verify`) en CNAME-records, status bezig/geslaagd/fout, knop "Opnieuw controleren" + polling elke 15s.
- Server-check via bestaande `email-trust.ts` (DNS-over-HTTPS), hergebruik door `cron.check-dns`; domein wordt ongeldig als TXT verdwijnt (takeover-bescherming).

## Fase 5 — Telegram (Taak E)
- Bestaand webhook valideren: `X-Telegram-Bot-Api-Secret-Token` check, contactbericht alleen geaccepteerd als `contact.user_id === from.id` en gekoppeld aan openstaande verificatie, 6-cijferige code via `phone-otp.server.ts`.
- Bij succes: `user_phone_numbers.phone_verified = true`, nummer AES-GCM versleuteld.
- Admin-only server-functie + script `scripts/telegram-set-webhook.ts` om de webhook (met secret token) te registreren. Nieuwe secret `TELEGRAM_WEBHOOK_SECRET`.

## Fase 6 — Hybride identiteitsverificatie (nieuw)
### Database — `db/81_identity_verification.sql` (idempotent)
- Tabel `identity_verifications`: `user_id` (uniek), `is_verified`, `verified_real_name`, `verification_provider` (enum `w_identity|didit|manual`), `unique_human_id` (UNIQUE, HMAC-SHA256 met server-secret `IDENTITY_HASH_PEPPER`, nooit ruwe ID), `verified_at`.
- Trigger die `verified_real_name` en `unique_human_id` onwijzigbaar maakt zodra `is_verified = true` (alleen DB-eigenaar kan resetten).
- Tabel `didit_monthly_usage` (`month`, `success_count`) met atomische increment.
- Runtime-vangnet via `runSchemaEnsure`.

### Server
- `identity.functions.ts`: `getMyIdentityStatus` (status + Didit-beschikbaarheid), `startIdentityVerification({provider})`.
- Didit-limiet: start geweigerd als maandteller ≥ 500; teller verhoogd alleen bij geslaagde verificatie in dezelfde transactie.
- Callbacks: `/api/public/identity/w-callback` (OIDC, pairwise `sub`) en `/api/public/identity/didit-webhook` (handtekening verifiëren). Dubbele `unique_human_id` -> fout "Deze persoon heeft al een geverifieerd account".
- Profielnaam: bij verificatie wordt weergavenaam overschreven; profielupdate-functies weigeren naamwijziging als geverifieerd (server-side).
- Providers niet geconfigureerd -> knop toont melding (zelfde patroon als sign-in tegels).

### UI — Instellingen: "Verifieer Identiteit"
- Twee knoppen: "Via W Identity (Gratis & Snel)" en "Via Paspoortscan (Didit)".
- Didit uitgeschakeld bij limiet met tekst: "De maandelijkse limiet voor deze verificatiemethode is bereikt. Gebruik W Identity of probeer het volgende maand opnieuw."
- Na verificatie: badge + naamveld alleen-lezen met uitleg.

## Technische details / benodigd
- Nieuwe secrets (door jou in te vullen): `W_IDENTITY_CLIENT_ID`, `W_IDENTITY_CLIENT_SECRET`, `W_IDENTITY_ISSUER`, `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `TELEGRAM_WEBHOOK_SECRET`; `IDENTITY_HASH_PEPPER` wordt gegenereerd. Alles in `ENVIRONMENT.md`.
- Migratie db/81 moet met `MIGRATION_URL` via `scripts/migrate.ts` worden toegepast.
- Nieuwe tests: Didit-limiet, unieke persoon, onwijzigbare naam, cleanup-batch, Telegram-codevalidatie.
- AGENTS.md-regels toevoegen voor identiteitsverificatie.
