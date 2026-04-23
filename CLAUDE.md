# CLAUDE.md

Tento soubor slouží jako stručný návod pro Claude Code (claude.ai/code) při práci s tímto repozitářem.

## Příkazy

```bash
npm install      # Nainstaluje závislosti
npm run dev      # Spustí dev server (Next.js, hot reload)
npm run build    # Produkční build — často odhalí TS chyby
npm run start    # Spustí produkční build

node scripts/updateData.js   # Ruční refresh reálných dat z Google Sheets
```

V projektu nejsou nakonfigurované linter ani testy.

## Architektura

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts, NextAuth 5, Radix UI.

### Tok dat

```
Google Sheets (CSV)
       ↓  scripts/updateData.js  (denně v 06:00 via Windows Task Scheduler)
data/realDataCZ.ts + realDataSK.ts + productData* + marginData* + hourlyData* +
crossSellData* + retentionData* + orderValueData* + shippingPaymentData*
       ↓
data/mockGenerator.ts  →  export const mockData: DailyRecord[]
                       →  getDailyMarketingData() + getMarketingSourceData()
       ↓
hooks/useDashboardData.ts  (filters + aggregates → KpiData, chartData, YoY)
       ↓
app/(dashboard|orders|marketing|products|margin|analytics|behavior|crosssell|retention|shipping)/page.tsx
```

### Stránky

| Stránka | Popis |
|---------|-------|
| `/dashboard` | **Klíčové ukazatele (KPI)** — 13 metrik vč. marže a hrubého zisku; 6 spojnicových grafů: Tržby bez DPH, Počet objednávek, Náklady, PNO %, AOV, CPA (všechny YoY); DailyTable |
| `/orders` | Objednávky — tržby vs počet, distribuce hodnot košíku (histogram), rozložení CZ/SK |
| `/marketing` | Marketingové investice — CPC per channel (FB/Google), trend kliky+CPC |
| `/products` | Prodejnost produktů — ABC analýza (A/B/C segmenty), sortovatelná tabulka, YoY, CSV export |
| `/margin` | Maržový report — marže %, hrubý zisk, grafy |
| `/analytics` | GA4 integrace — sessions, CVR, sources tabulka (Sessions/Nákupy/CVR/Tržby bez DPH + YoY), devices, vstupní stránky; zatím jen CZ |
| `/behavior` | Nákupní chování — týdenní srovnání, hourly grid (all-time agregace) |
| `/crosssell` | Cross-sell potenciál — top 100 produktových párů (platební/dopravní metody vyloučeny) |
| `/retention` | Retenční analýza — RFM segmentace, LTV, AOV, repeat purchase rate; tabulky s dopočítanými součty Celkem |
| `/shipping` | Doprava a platby — KPI vč. zisku/ztráty dopravy, pie charty (doručení/platby), tabulky vedle sebe, ceník dopravců |
| `/main` | **Hlavní Dashboard** — 8 měsíčních sloupcových grafů YoY (Tržby, Hrubý zisk, Počet obj., Investice, PNO%, AOV, Marže%, CPA); grid 2 sloupce; selektory Vše/CZ/SK a rok v TopBaru; default Vše |
| `/meta` | Meta Ads — KPI boxy s barevným pozadím + YoY, grafy CPC/CPA/Nákupy/ROAS, tabulka kreativ s color-coded CPA/ROAS; filtrace dle kampaně a sady reklam |
| `/login` | Přihlášení (NextAuth) |
| `/admin/users` | Správa uživatelů (admin only) |

### Práce s měnami

- CZ data jsou v **CZK**. SK data jsou v **EUR**.
- `getDisplayCurrency(countries)` v `data/types.ts`: vrací `'EUR'` pouze tehdy, když je vybrané jen SK; jinak `'CZK'`.
- Při kombinaci CZ+SK se SK hodnoty násobí `eurToCzk` (live rate z frankfurter.app, fallback `EUR_TO_CZK = 25`) uvnitř `useDashboardData` a `getMarketingSourceData` před agregací.
- Všechny money formattery berou `currency: 'CZK' | 'EUR'`.

### Meziroční srovnání (YoY)

- **CZ nemá YoY** — e-shop běží od května 2025. `hasPrevData` bude `false` kdykoliv je ve filtru CZ a nejsou dostupné záznamy z předchozího roku.
- **SK má YoY** — reálná data od března 2024; mock SK data (seeded RNG) doplňují leden–únor 2024 jako základ pro YoY.
- `hasPrevData` předávej do `KpiCard`, `RevenueOrdersChart` a `CostPnoChart`, aby šlo podmíněně skrýt YoY badge a "minulý rok" řady v grafech.

### Klíčové soubory

| Soubor | Účel |
|--------|------|
| `data/types.ts` | `DailyRecord`, `KpiData`, `FilterState`, `TimePeriod`, `EUR_TO_CZK`, `getDisplayCurrency` |
| `data/mockGenerator.ts` | Kombinuje reálná + mock data; `getDailyMarketingData()` + `getMarketingSourceData()` |
| `data/realDataCZ.ts` | Auto-gen reálná CZ data (CZK) — **needitovat ručně** |
| `data/realDataSK.ts` | Auto-gen reálná SK data (EUR) — **needitovat ručně** |
| `data/productDataCZ.ts` / `productDataSK.ts` | Prodej produktů (počet kusů, tržby) — auto-gen |
| `data/marginDataCZ.ts` / `marginDataSK.ts` | Marže (nákupní cena vs tržby bez DPH) — auto-gen |
| `data/hourlyDataCZ.ts` / `hourlyDataSK.ts` | Nákupní chování 7×24 grid — auto-gen, all-time |
| `data/crossSellDataCZ.ts` / `crossSellDataSK.ts` | Top 100 produktových párů — auto-gen |
| `data/retentionDataCZ.ts` / `retentionDataSK.ts` | Per-customer retence `{ dates, revenues, revsVat }[]` — auto-gen |
| `data/orderValueDataCZ.ts` / `orderValueDataSK.ts` | Per-order košík bez DPH `{ date, value }[]` — auto-gen |
| `data/shippingPaymentDataCZ.ts` / `shippingPaymentDataSK.ts` | Doprava+platby po dnech — auto-gen |
| `lib/retentionUtils.ts` | Všechny výpočty pro `/retention` (KPI, YoY, RFM segmentace, distribuce) |
| `components/kpi/StatCard.tsx` | Sdílená KPI karta (border-2 border-blue-800, icon vpravo); prop `negative` = rose varianta; props `yoy`, `hasPrevData`, `invertYoy` pro YoY badge |
| `components/kpi/KpiCard.tsx` | KPI karta se sparkline a YoY badge; prop `variant: 'default' \| 'green' \| 'red'` mění barvu rámečku, ikony a hodnoty |
| `hooks/useFilters.ts` | `FiltersProvider` + `useFilters()` + `getDateRange()` + live EUR rate |
| `hooks/useDashboardData.ts` | Filtruje, agreguje, normalizuje měny, počítá KPI + chartData + YoY |
| `scripts/updateData.js` | Čistý Node.js — stáhne CSV z Google Sheets, generuje všechny data/*.ts soubory |

### KPI komponenty

Dva typy KPI karet — **neměnit vzájemně**:
- **`StatCard`** — používají `/margin`, `/retention`, `/crosssell`. Prop `negative` = rose border/barva. Props `yoy`, `hasPrevData`, `invertYoy` pro YoY badge.
- **`KpiCard`** — používají `/dashboard`, `/orders`, `/marketing`, `/products`, `/shipping`. Podporuje sparkline, YoY badge a `variant`:
  - `'default'` — modrý rámeček (výchozí)
  - `'green'` — tmavě zelený rámeček + zelená hodnota (Hrubý zisk)
  - `'red'` — červený rámeček + červená hodnota (ztráta dopravy)

### `/dashboard` — Klíčové ukazatele (KPI)

KPI boxy (13 celkem) v tomto pořadí: Tržby s DPH, Tržby bez DPH, Počet obj., AOV, Marketingové investice, PNO, Cena za objednávku, Marže, Marže %, Cena za nového zákazníka, Hrubý zisk na objednávku, **Hrubý zisk, Hrubý zisk %**.

Marže a Hrubý zisk se počítají z `marginDataCZ` / `marginDataSK`:
- `margin = marginRev - purchaseCost`
- `marginPct = margin / marginRev × 100`
- `grossProfit = margin - kpi.cost`
- `grossPct = grossProfit / marginRev × 100`

Karta **Hrubý zisk** a **Hrubý zisk %** mají `variant='green'`.

### `/dashboard` — Grafy

6 spojnicových grafů (LineChart, YoY přerušovaná čára), rozložení 2×3 grid (`xl:grid-cols-2`):
- **Řada 1**: Tržby bez DPH (`RevenueOrdersChart`) + Počet objednávek
- **Řada 2**: Náklady + PNO %
- **Řada 3**: AOV + CPA

`CostPnoChart` component je zachován pro `/marketing` stránku (používá ComposedChart s bary+liniemi).

### `/dashboard` — Distribuce podle země (`CountryDistribution`)

Zobrazuje se pouze při výběru obou zemí (`filters.countries.length > 1`).

**Tabulka** (10 sloupců): Země, Objednávky, Tržby bez DPH, Tržby s DPH, Náklady, PNO, CPA, Marže, Hrubý zisk, Hrubý zisk %

- **Všechny hodnoty v Kč** — SK data (nativně EUR) se přepočítávají live kurzem `eurToCzk` z frankfurter.app
- **YoY srovnání** pod každou hodnotou (zelená/červená %) — zobrazuje se pouze pokud `hasPrevData`
- **Marže, Hrubý zisk, Hrubý zisk %** — počítají se z `marginCurrent`/`marginPrev` props (per-country, nativní měna → konverze)
- Props: `data`, `prevData`, `hasPrevData`, `eurToCzk`, `marginCurrent`, `marginPrev`
- `marginCurrent`/`marginPrev` jsou `Partial<Record<Country, CountryMargin>>` kde `CountryMargin = { purchaseCost, marginRev }` v nativní měně
- Dashboard předává per-country margin z rozšířeného `marginTotals` useMemo (vrací `perCountryCur`, `perCountryPrev`)

### `/shipping` — Doprava a platby

**KPI boxy** (8 celkem):
- `Doprava zákazník` — příjmy od zákazníků za dopravu
- `Doprava e-shop` — náklady e-shopu dle ceníku dopravců
- `Doprava zisk / ztráta` — rozdíl; `variant='green'` nebo `'red'`; zobrazuje `'--'` pokud ceník není vyplněn

**Ceník dopravců** — editovatelná tabulka uložená v `localStorage` (`carrierCosts_v1`):
- Rozdělena na CZ (Kč) a SK (€) sekce
- Zobrazuje pouze panely odpovídající aktivním selektorům CZ/SK
- Struktura: `Record<carrierName, { cz: string, sk: string, note: string }>`

**Tabulka Zisk / ztráta per dopravce** — zobrazí se pouze pokud je vyplněn ceník:
- Sloupce: Dopravce, Obj., Zákazník platí, E-shop platí, Zisk/ztráta, Na objednávku
- Zákazník platí = z `shippingRows` (agregace za období)
- E-shop platí = `czCount[name] × costs[name].cz + skCount[name] × costs[name].sk × skMult`

### ABC analýza produktů (`/products`)

Produkty se klasifikují dle kumulativního podílu na tržbách bez DPH (seřazeno sestupně):
- **A** — top produkty → 0–80 % tržeb (zelené)
- **B** — střední produkty → 80–95 % tržeb (žluté)
- **C** — slabé produkty → 95–100 % tržeb (červené)

Klasifikace se vždy počítá ze všech dat (sort dle revenue desc), nezávisle na aktuálním řazení tabulky.

### Distribuce hodnot objednávek (`/orders`)

`orderValueData*` = per-order košík bez DPH (bez dopravy a platby), extrahovaný z col[56] Shoptet exportu.
- CZK buckety: 0–500, 500–1k, 1k–2k, 2k–5k, 5k+
- EUR buckety: 0–20, 20–40, 40–80, 80–200, 200+
- Při kombinaci CZ+SK se SK hodnoty převádí na CZK přes `eurToCzk`.
- Histogram zobrazuje peak bucket (tmavě modrý) + amber tip na dopravu zdarma.

### Marketing — CPC (`/marketing`)

Data z `getDailyMarketingData()` — každý den má `clicks_facebook`, `clicks_google`, `clicks_seznam`, `clicks_heureka`, `cost_facebook`, `cost_google`, `cost_seznam`, `cost_heureka`, `revenue`.
- **CPC** = cost_channel / clicks_channel (per den), zobrazeno na 2 desetinná místa
- **ROAS byl odstraněn** ze všech přehledů
- Grafy: ComposedChart (stacked bars kliky + lines CPC)
- Výkon per channel obsahuje YoY srovnání (FB, Google, Seznam, Heureka — náklady, kliky, CPC)
- **Kanálové karty se zobrazují podmíněně** — Seznam karta jen pokud `sz.cost > 0 || sz.clicks > 0`, Heureka karta analogicky
- **Barvy kanálů** (`lib/chartColors.ts`): Facebook = blue-600/800, Google = emerald-600/800, Seznam = orange-500/700, Heureka = violet-700/900
- `buildSourceBreakdown()` filtruje zdroje s `cost === 0 && clicks === 0` — nezobrazí se prázdné kanály
- `scripts/updateData.js` mapuje CSV `source` sloupec: `facebook` → `cost_facebook`, `google` → `cost_google`, `seznam` → `cost_seznam`, `heureka` → `cost_heureka`

### ABC analýza — filtrování slev (`/products`)

Funkce `isDiscount(name)` v `app/products/page.tsx` filtruje slevy a slevové kupony z analýzy prodejnosti:
- Regex `/^slev|^zľav/i` — pokryje CZ (`Sleva`, `Slevový kupon č. …`) i SK (`Zľava`, `Zľavový kupón č. …`)
- Filtr aplikovaný v `aggregateByName()` pro obě země před agregací

### RFM segmentace zákazníků (`/retention`)

Výpočet v `lib/retentionUtils.ts` → `computeRfmSegments()`. Referenční datum = nejnovější objednávka v datasetu.

| Segment | Podmínka (priority pořadí) |
|---------|---------------------------|
| Ztracení | R > 365 dní |
| Šampioni | F ≥ 3 AND R ≤ 90 dní |
| Věrní zákazníci | F ≥ 2 AND R ≤ 180 dní |
| Ohrožení | F ≥ 2 AND R > 180 dní |
| Noví zákazníci | F = 1 AND R ≤ 90 dní |
| Jednorázové | F = 1, ostatní |

### RFM segmenty po měsících (`/retention`)

`computeMonthlyRfmSegments()` v `lib/retentionUtils.ts` — pro každý měsíc přepočítá RFM stav každého zákazníka k poslednímu dni toho měsíce a vrátí počty per segment.
- Graf: 100% stacked BarChart (`stackOffset="expand"`), Y-osa v %, tooltip zobrazuje počet zákazníků i podíl
- Pořadí vrstev (spodek→vršek): Ztracení → Jednorázové → Ohrožení → Noví zákazníci → Věrní zákazníci → Šampioni
- Umístění: hned pod RFM boxy, před grafy LTV/AOV

### Definice Noví vs. Stávající zákazníci (`/retention`)

- **Noví** = zákazník, jehož úplně první nákup je v daném roce
- **Stávající** = zákazník, který měl v daném roce svůj 2.+ nákup vůbec (zahrnuje i opakované nákupy ve stejném roce)
- Jeden zákazník **může být v obou kategoriích** v jednom roce (poprvé koupil a vrátil se ve stejném roce)

### Konstanta `TODAY` (defaulty pro datum)

`hooks/useFilters.ts` používá aktuální datum dynamicky:
```ts
const TODAY = new Date();
```

Pokud řešíš funkce závislé na čase (např. "posledních 7 dní"), drž logiku dat na jednom místě (`hooks/useFilters.ts` / `getDateRange()`) a počítej s hraničními efekty časových pásem při groupingu po dnech.

### Vzorec PNO

`PNO = Marketingové investice / Tržby bez DPH × 100`

(marketingové náklady dělené tržbami bez DPH; v jmenovateli není DPH)

### Hourly data

Hourly grid na stránce `/behavior` je **all-time agregace** — nezohledňuje vybrané časové období filtrů. Jde o záměrné rozhodnutí pro zachycení dlouhodobého vzorce chování.

### SK marže

SK marže se dopočítávají spojením margin sheetu (`margin_cz`) s orders exportem přes kód objednávky — SK objednávky jsou identifikované měnou `EUR` v orders exportu. `marginDataSK` obsahuje hodnoty v EUR stejně jako ostatní SK data.

### GA4

GA4 je napojeno pouze pro **CZ**. SK bude řešeno samostatně v budoucnu.

Na stránce `/analytics` jsou v TopBaru skryty selektory **Vše** a **SK** — zobrazuje se pouze CZ (viz `components/layout/TopBar.tsx`, podmínka `isAnalytics`).

**`app/api/analytics/route.ts`** — vrací:
- `daily`, `dailyPrev` — denní sessions/users/conversions/bounceRate/avgDuration
- `totals` — agregáty za aktuální + předchozí rok (dva dateRanges v jednom requestu)
- `sources`, `sourcesPrev` — zdroje návštěvnosti (source/medium, top 20)
- `devices`, `devicesPrev` — rozpad na deviceCategory
- `landingPages` — vstupní stránky (top 20)
- `funnel` — checkout trychtýř agregát: begin_checkout → add_shipping_info → add_payment_info → purchase, rozpad desktop/mobile/tablet
- `funnelTrend` — denní průchodnost košíkem; každý řádek má klíče `${step}_${device}` a `${step}_all`

**`app/analytics/page.tsx`**:
- KPI boxy: Sessions, Unikátní uživatelé, Konverze, Konverzní poměr, Bounce rate, Prům. délka — grid `grid-cols-2 sm:grid-cols-3`
- Grafy v čase: Sessions YoY, Konverzní poměr YoY, Bounce rate YoY, Délka návštěvy YoY
- Zdroje návštěvnosti (progress bary, YoY badge) + Zařízení (PieChart + YoY badge)
- **Graf CVR trychtýře v čase** (`funnelTrendPct`): zobrazuje jedinou křivku — `purchase / begin_checkout × 100 %` — jak se vyvíjí CVR celého trychtýře v čase; selektor zařízení (Vše / Desktop / Mobil / Tablet); Y-osa 0–100 %, každý bod počítán relativně k `begin_checkout_${device}` daného dne
- **Trychtýř průchodnosti košíkem** (statický): stacked bar per krok, % z 1. kroku, odpad mezi kroky, rozpad desktop/mobile/tablet

### `/dashboard` — AOV a CPA grafy

Pod stávajícími grafy (Tržby bez DPH + Náklady/PNO) jsou dva nové grafy:
- **AOV – Průměrná hodnota objednávky** — `revenue / orders` per den, indigo čára, YoY přerušovaná
- **Cena za objednávku** — `cost / orders` per den, červená čára, YoY přerušovaná
- YoY série se zobrazí pouze pokud `hasPrevData === true`

### `/analytics` — Zdroje návštěvnosti

Tabulka (full-width, tmavě modrá hlavička) s 9 sloupci: Zdroj/Médium, Sessions, YoY sessions, Nákupy, YoY nákupy, CVR (%), YoY CVR, Tržby bez DPH, YoY tržby.
- API (`app/api/analytics/route.ts`) vrací `purchaseRevenue` a `cvr` v každém source řádku
- YoY badge: zelená/červená, `–` pokud předchozí rok nemá data

### `/main` — Hlavní Dashboard

- Hook: `hooks/useMainDashboard.ts` → `useMainDashboard(country, year): MonthlyPoint[]`
- Komponenta: `components/charts/YearCompareBarChart.tsx` — generický seskupený BarChart (aktuální rok + předchozí rok)
- **Selektory Vše/CZ/SK a rok** jsou v TopBaru, předávají se přes URL search params (`?country=all&year=2025`)
- **Rok selektor** — pill tlačítka (stejný styl jako Vše/CZ/SK), roky 2022–aktuální rok sestupně; vpravo label `vs. {rok-1}`
- Stránka čte `useSearchParams()` — žádný lokální state; `TopBarInner` a `MainDashboardContent` obaleny `<Suspense>` (nutné pro Next.js prerender)
- **`MainCountry = 'cz' | 'sk' | 'all'`** — při `'all'` se CZ a SK data mergují (SK EUR → CZK přes `EUR_TO_CZK`)
- **Default: `'all'`** — při první návštěvě bez URL params se zobrazí CZ + SK kombinovaně
- **8 grafů** (grid `md:grid-cols-2`): Tržby bez DPH, Hrubý zisk, Počet objednávek, Marketingové investice, PNO (%), AOV, Marže (%), CPA
- **Hrubý zisk** = (marginRev − purchaseCost) − marketingové náklady; zelená barva (#16a34a)
- Při `'all'` nebo `'cz'` se zobrazuje CZK, při `'sk'` EUR

### `/meta` — Meta Ads

- **KPI boxy** (`MetaKpiBox`): barevné pozadí (rose/blue/slate/emerald/amber) + rámeček + YoY badge (▲/▼ %); **CPC je formátováno na 2 desetinná místa** (`fmt(val, 2)` + ` Kč`, ne `fmtCzk`)
- **Tabulka kreativ**: tmavě modrá hlavička, bez sloupce "Tržby z reklam", CPA color-coded (zelená < 200 Kč, oranžová 200–400 Kč, červená > 400 Kč), ROAS color-coded (zelená ≥ 3×, oranžová 1–3×, červená < 1×)
- **Filtrace nad tabulkou**: dropdown "Kampaň" + dropdown "Sada reklam" (filtruje se na základě vybrané kampaně); tlačítko "Zrušit filtry"; počet zobrazených reklam vpravo

### `/shipping` — rozložení

Pie charty (doručení + platby) jsou v samostatném řádku nad tabulkami. Tabulky jsou v dalším řádku vedle sebe — vždy na stejné výšce.

### Cross-sell — vyloučení platebních metod

`isPaymentName()` v `scripts/updateData.js` nově vylučuje i **Převodem** (dříve se mohlo objevit jako produkt v párech).

### Pre-existing TS chyby

`app/shipping/page.tsx` má ~8 TS chyb (Recharts PieLabel + Tooltip typy). Jsou **pre-existující**, nezpůsobené nedávnými změnami — neřešit, pokud se nerefaktoruje shipping stránka.

`app/marketing/page.tsx` — `labelFormatter` na `<Tooltip>` musí být `(l: unknown) => string`, ne přímý odkaz na `formatShortDate: (s: string) => string` (Recharts očekává `ReactNode` jako parametr label).

### Autentizace

NextAuth 5 (beta). Uživatelé jsou uloženi v **Neon PostgreSQL** (tabulka `users`, bcrypt hesla). Admin stránka `/admin/users` vyžaduje `role: 'admin'`.

- `lib/db.ts` — singleton `pg.Pool`, připojuje se přes `DATABASE_URL`
- `lib/users.ts` — CRUD funkce přes SQL dotazy (nahrazuje původní `fs.readFileSync` z `users.json`)
- Migrace: `scripts/migrateUsers.js` (jednorázový skript)

### Rate limiting přihlášení

Max **5 neúspěšných pokusů za 30 minut** per email. Implementováno přes Neon PostgreSQL (tabulka `login_attempts`).

- `lib/rateLimit.ts` — `isRateLimited()`, `recordFailedAttempt()`, `clearAttempts()`
- `auth.ts` — kontrola před každým pokusem; záznam při neúspěchu; smazání po úspěchu
- `app/api/auth/is-locked/route.ts` — GET endpoint `?email=...` → `{ limited, retryAfterMs }`
- `app/login/page.tsx` — po zamítnutí se dotáže `/api/auth/is-locked` a zobrazí „Zkuste za X min"
- Neexistující email se také zaznamená (prevence user enumeration)
- Tabulka se vytvoří přes `scripts/migrate.js`

### Automatická aktualizace dat

`.github/workflows/update-data.yml` — GitHub Actions spouští `node scripts/updateData.js` každý den, cron nastaven na **3:00 UTC** (kompenzace za typické 2–4h zpoždění GitHub Actions u méně aktivních repozitářů; cíl je doručení cca v 6:00 SELČ). Commituje změněné soubory v `data/`, pushuje do `main` a poté volá **Vercel Deploy Hook** přes `curl -X POST` — bez tohoto kroku Vercel nespustí deploy z github-actions[bot] commitů.

`scripts/updateAndPush.ps1` — lokální záloha pro Windows Task Scheduler (spouštět v `06:00`). Stáhne data, commitne, provede `git pull --rebase origin main` (aby nevznikl konflikt s GitHub Actions) a pushne. Logy zapisuje v **UTF-8** (`Add-Content -Encoding UTF8`). Pokud počítač není zapnutý, data i tak přijdou přes GitHub Actions.

Ruční spuštění: GitHub → Actions → "Aktualizace dat" → Run workflow.

Script při každém spuštění:
1. Fetchuje live **EUR→CZK kurz** z `frankfurter.app` (fallback 25)
2. Stahuje Google Sheets (orders, cost, margin, stock)
3. SK marže dopočítává spojením margin sheetu s orders exportem přes kód objednávky (SK = měna EUR)

### Line endings (CRLF / LF)

`.gitattributes` nastavuje `data/*.ts text eol=lf` — zabraňuje tomu, aby `git add` na Windows (kde je `core.autocrlf = true`) konvertoval LF→CRLF a tím způsoboval falešné "žádné změny" při porovnání s HEAD. GitHub Actions (Linux) zapisuje LF, lokální Node.js také — bez tohoto nastavení by lokální PS1 skript nikdy nedetekoval změny a nepushnul.

### TopBar

Tlačítko **Aktualizovat data** bylo odstraněno (`components/layout/TopBar.tsx`) — data se aktualizují automaticky přes GitHub Actions, ruční refresh není potřeba.

`app/marketing/page.tsx` — `labelFormatter` na `<Tooltip>` musí být `(l: unknown) => string`, ne přímý odkaz na `formatShortDate: (s: string) => string` (Recharts očekává `ReactNode` jako parametr).

### Timezone fix

`hooks/useFilters.ts` — `getDateRange()` používá `Date.UTC()` pro všechny datumy (UTC půlnoc). Zabraňuje posunu o 1 den při `.toISOString().split('T')[0]` v časovém pásmu CET/CEST (+1/+2).

Exportovaný helper `localIsoDate(d: Date)` pro případ, kde je potřeba lokální datum jako string.
