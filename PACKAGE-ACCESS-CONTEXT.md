# GateGuard Package Access — Build Context

**Owner:** Russel Feldman (rfeldman@gateguard.co)  
**Created:** 2026-04-29  
**Goal:** Build a ButterflyMX competitor natively inside GateGuard, using existing Brivo + EEN infrastructure — no $200/mo SaaS fee, AI-powered, integrated into portal.gateguard.co.

---

## The Problem We're Solving

ButterflyMX charges ~$2,400/yr ($200/mo) for a managed package room access system. Their core workflow:

1. Delivery driver enters company code at a door kiosk
2. Selects which residents are receiving packages
3. System photos the driver, timestamps, unlocks the door
4. Notifies residents a package arrived

We can build this — and make it significantly better — using hardware and APIs we already have.

---

## Our Stack (Already Built)

| Layer | Technology | Status |
|---|---|---|
| App framework | Next.js (App Router), TypeScript, React 19 | Live |
| Auth | Clerk | Live |
| Database | Supabase (Postgres + realtime) | Live |
| Access control | Brivo API — full OAuth, unlock, door inventory | **Fully integrated** |
| Cameras | Eagle Eye Networks (EEN) — live feeds, snapshots, clips | **Fully integrated** |
| AI | Claude via Anthropic SDK | Live |
| Comms | Twilio (calls), Resend (email) | Live |
| UI | Tailwind CSS v4, dark theme | Live |
| Physical hardware | Brivo readers + Ubiquiti for access control | Deployed at properties |

The Brivo unlock API (`POST /access-points/{id}/activate`) and EEN snapshot API are already wired. The core delivery flow is primarily a UI + workflow layer on top of existing infrastructure.

---

## Three Interfaces to Build

### 1. Delivery Kiosk (iPad, mounted at package room door)

**Flow:**
1. Welcome screen — "Making a delivery?" / "Tenant entry"
2. Driver enters company code (numpad) → AI auto-detects carrier (Amazon, UPS, FedEx, USPS, etc.)
3. Resident directory — driver selects who's receiving packages (searchable list)
4. AI identity verification — EEN camera snapshots driver, Claude scores confidence (uniform check, delivery window check, face scan)
5. Door unlock via Brivo API — 60-second timed access
6. Push notifications sent to selected residents with driver photo + timestamp

**Hardware:** iPad (any model) mounted with a standard wall mount. No proprietary hardware needed.

**AI differentiators over ButterflyMX:**
- Real-time confidence score on driver identity
- Delivery window anomaly detection ("Amazon doesn't deliver at 10 PM")
- Uniform/package visual confirmation
- Auto-carrier detection from code prefix

### 2. Tenant Portal (Mobile-first web app)

- Package arrival notifications with driver photo
- Access methods: QR code, phone tap (NFC/BLE via Brivo mobile credential), PIN
- Guest pass creation with time limits and expiration
- Full access history log
- AI-written delivery summaries ("Standard Amazon delivery, no anomalies")

**Lives at:** portal.gateguard.co (extend existing app)

### 3. Property Manager Dashboard (Web, extends existing GateGuard UI)

- Tenant roster with move-in/move-out date scheduling (Brivo credentials auto-activate/revoke)
- AI anomaly alerts (unusual delivery times, repeated failed entries, unrecognized visitors)
- Delivery analytics (packages per carrier, per unit, per week)
- Carrier code management (add/remove Amazon, UPS, FedEx codes)
- Live access log with camera thumbnails

---

## Design System — Match GateGuard Exactly

The package access UI must look and feel like the existing GateGuard app. Do not use a different design language.

| Token | Value |
|---|---|
| Background | `#030406` |
| Surface | `#0a0c10` |
| Surface elevated | `#11141a` |
| Card bg | `#0d0f14` |
| Primary accent | `#6366f1` (indigo-500) |
| Success | `#10b981` (emerald-500) |
| Warning | `#f59e0b` (amber-500) |
| Danger | `#ef4444` (red-500) |
| Text primary | `#e2e8f0` (slate-200) |
| Text secondary | `#64748b` (slate-500) |
| Border | `rgba(255,255,255,0.05)` |
| Font | Inter |
| Panel radius | `2.5rem` (40px) |
| Card radius | `1.5rem` (24px) |
| Button radius | `1rem` |

**Visual style:** Dark OLED, dot-grid background on content areas, thin white/5 borders, indigo accent, emerald for success/live states. Matches the SOC dispatch UI aesthetic — clean, high-contrast, functional.

---

## Key API Endpoints to Wire

### Brivo (already authenticated, token refresh built)
- `GET /v1/access-points` — list all doors/readers → identify package room door ID
- `POST /v1/access-points/{id}/activate` — unlock door
- `POST /v1/credentials` — create tenant/carrier credentials
- `GET /v1/activity-lh` — access log (for delivery history, anomaly detection)
- `GET /v1/users` — tenant roster

### EEN (already authenticated)
- Snapshot API — capture driver photo on entry event
- Clip API — save 30s clip of each delivery for audit trail
- Camera feed — live view inside package room for manager dashboard

### New endpoints to build (`/api/package-access/`)
- `POST /api/package-access/delivery` — core delivery flow (validate carrier code, log delivery, trigger Brivo unlock, send notifications, save EEN snapshot)
- `GET /api/package-access/carriers` — list carrier codes per property
- `POST /api/package-access/carriers` — add/remove carrier
- `GET /api/package-access/deliveries` — delivery log with photos
- `POST /api/package-access/tenants/notify` — push notification to resident(s)
- `GET /api/package-access/tenant-portal/[unitId]` — tenant portal data

### New Supabase tables needed
- `package_deliveries` — delivery events (carrier, recipients, driver_photo_url, timestamp, brivo_event_id, ai_confidence, anomaly_flag)
- `carrier_codes` — per-property carrier credentials (carrier_name, code, brivo_credential_id)
- `package_notifications` — resident notification log
- `tenant_access_schedule` — move-in/move-out dates linked to Brivo credential IDs for auto-activation

---

## Competitive Advantages Over ButterflyMX

| Feature | ButterflyMX | GateGuard Package Access |
|---|---|---|
| Monthly fee | $200/mo | $0 (included in GateGuard) |
| AI verification | No | Yes — Claude confidence scoring |
| Anomaly detection | No | Yes — time-window, behavior analysis |
| Camera integration | Basic intercom camera | Full EEN integration, clip recording |
| Unified with gate/alarms | No | Yes — same GateGuard platform |
| Tenant app | Proprietary app | Mobile web (no app download needed) |
| Carrier management | Basic | Full admin UI with Brivo sync |
| Move-in/out automation | Manual | Auto-activate/revoke via scheduled jobs |

---

## Build Order (Suggested)

1. **Supabase schema** — `package_deliveries`, `carrier_codes`, `tenant_access_schedule` tables
2. **Carrier code validation** — add carrier codes to Brivo, build `/api/package-access/carriers`
3. **Core delivery API** — `/api/package-access/delivery` endpoint (the brain of the whole system)
4. **iPad kiosk UI** — new route `/kiosk/[propertyId]` — full-screen, touch-optimized, GateGuard dark theme
5. **EEN snapshot integration** — trigger photo capture on delivery event, store URL in Supabase
6. **Push notifications** — resident alerts via Twilio SMS + optionally Resend email
7. **Tenant portal** — new route `/portal/[unitId]` — mobile-first, package history, QR/PIN access
8. **Manager dashboard module** — add "Package Access" tab to existing GateGuard sidebar

---

## Open Questions for Tomorrow

- [ ] Which property are we piloting this at first?
- [ ] Do we need a native iOS app for the tenant portal or is mobile web sufficient?
- [ ] Are we using Brivo mobile credentials for phone-based tenant entry, or a separate QR/PIN flow?
- [ ] Is the package room door already on Brivo, or does hardware need to be added?
- [ ] Notification preference: SMS (Twilio), email (Resend), or in-app push?
- [ ] Should carrier codes be shared across properties or per-property?
