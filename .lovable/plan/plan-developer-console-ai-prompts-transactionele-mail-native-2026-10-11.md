# Plan: Developer Console, AI-prompts, transactionele mail & native OIDC-login

## Wat er al klopt (geen werk nodig)

- **Credentials**: `createClient` in `src/lib/oauth/provider.server.ts` genereert al een unieke `client_id` met `rout_`-prefix en een veilige `client_secret` (gehasht opgeslagen, eenmalig getoond bij aanmaken/rotatie). De AI-prompts injecteren al het echte `client_id`.
- **Native OIDC-provider**: ROUT heeft al eigen endpoints (`/oauth/authorize`, `/oauth/token`, userinfo, JWKS, discovery) die tokens uitgeven vanuit de eigen database.
- **Mail-infrastructuur**: `sendTransactionalEmail` + `src/emails/site-mails.ts` bestaan al (secret-rotatie, app-review, app-gekoppeld e.d.).

## Wat we gaan fixen

### 1. AI-prompts: echte credentials + officiële bunny-SVG

- `buildAiPrompt` en `buildHandleSyncPrompt` in `src/lib/oauth/integration-templates.ts` krijgen een nieuwe sectie **"Branding & UI"** met:
  - de exacte inline SVG van het officiële ROUT-konijn (uit `src/lib/brand/logo.ts`, de enige bron van waarheid), als kant-en-klare code in de prompt;
  - kleurrichtlijnen (paars `#7026E1`, mint `#41DB97`) en de regel dat de knop "Login with ROUT" het officiële logo moet tonen.
- De `client_secret` blijft bewust een env-var-verwijzing (`ROUT_CLIENT_SECRET`): de secret wordt om veiligheidsredenen maar eenmalig getoond en kan daarna nooit meer uit de database worden gelezen. Het echte `client_id` zit al in elke prompt.
- Bestaande tests in `integration-templates.test.ts` uitbreiden: assert dat elke gegenereerde prompt het echte `client_id` en de bunny-SVG bevat.

### 2. Transactionele e-mails aanvullen

Nieuwe mails via de bestaande `site-mail.server.ts`-infrastructuur (fire-and-forget, blokkeren nooit een actie):

- **App-registratiebevestiging**: bij `createClient` (nieuwe app in de console) krijgt de eigenaar een bevestigingsmail met app-naam en link naar de console.
- **Admin-melding bij verificatieverzoek**: bij `requestOAuthVerification` krijgt de platform-admin een melding dat er een nieuw verificatieverzoek klaarstaat.
- Nieuwe templates `appCreatedMail` en `verificationRequestedMail` in `src/emails/site-mails.ts` (bestaande stijl, meertalig via `MailLang`).

### 3. "Keycloak / Self-hosted OIDC" native maken

Nu vereist de `oidc`-loginmethode externe env-vars (`OIDC_CLIENT_ID/SECRET/DISCOVERY_URL`) en blijft de knop inactief zonder configuratie. Gewenst: werkt out-of-the-box tegen onze eigen provider.

- In `src/lib/better-auth.server.ts`: wanneer de `OIDC_*` env-vars **ontbreken**, valt de `oidc`-provider terug op onze eigen discovery URL (`https://rout.be/.well-known/openid-configuration`) met een ingebouwde first-party client.
- Nieuwe migratie `db/78_native_oidc_client.sql`: seed een first-party `oauth_clients`-rij (vaste `client_id` zoals `rout_native_self`, eigenaar = platform, redirect URI = eigen `/api/auth/oauth2/callback/oidc`, status active, PKCE vereist). Idempotent (`insert ... on conflict do nothing`).
- De `client_secret` voor deze first-party client komt uit een eigen env-var (`ROUT_NATIVE_OIDC_SECRET`, gegenereerd via de secrets-tool), zodat de token-uitwisseling server-side kan — geen externe sleutels nodig.
- Label in `ProviderKit.tsx` aanpassen van "Keycloak" naar "ROUT ID" (of "Keycloak / ROUT ID") zodat duidelijk is dat het onze eigen soevereine provider is; het bestaande Keycloak-icoon blijft.
- `IdentitiesPanel`-tekst bijwerken: koppelen via de native provider verloopt via het normale linkSocial-pad (`neon_auth.account`), zoals de andere providers.

## Technische details

- Gewijzigde bestanden: `src/lib/oauth/integration-templates.ts` (+ test), `src/emails/site-mails.ts`, `src/lib/oauth/console.functions.ts` (createClient + requestVerification mail-hooks), `src/lib/better-auth.server.ts` (oidc-fallback), `src/components/auth/ProviderKit.tsx`, `src/components/settings/IdentitiesPanel.tsx`, `ENVIRONMENT.md`, nieuwe `db/78_native_oidc_client.sql`.
- Conventies gevolgd: Neon-only, idempotente migraties, provider-config server-side afgedwongen, mails fire-and-forget, logo alleen uit `src/lib/brand/logo.ts`.
- Verificatie: `bunx vitest run` op de prompt-tests, `tsgo --noEmit`, build-check.

## Buiten scope

- Echte end-to-end test van de native OIDC-flow met een live database (Neon is nog niet aangesloten in deze sandbox).
- Brevo/Resend-sleutels: de mail-infrastructuur gebruikt de bestaande provider-configuratie; nieuwe API-sleutels zijn niet nodig.
