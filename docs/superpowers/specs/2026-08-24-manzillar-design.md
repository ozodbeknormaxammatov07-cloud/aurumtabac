# Manzillar: replacing the Sotuvchilar retailer directory with a two-store locator

Date: 2026-08-24
Status: awaiting review

## Problem

The site carries a `Sotuvchilar` ("Retailers") section inherited from the Warped
Cigars template it was built on. The section is built for a US reseller network:
it asks visitors to register as authorised retailers, and promises a retailer
list that will never arrive. Aurum Tabac is a two-shop business in Yangiyer, so
the section describes something that does not exist.

It should become `Manzillar` ("Addresses") — the two shops, on a map, with
directions.

## Current state

Established by reading the repo, not assumed:

- `retailers.html` already contains the **full locator DOM skeleton**:
  `retailers__wrapper`, `__top`, `__input`, `__submit`, `__close`,
  `__retailers`, `__list`, `__map`, `__map__inner`, `__map__inner__wrapper`,
  `__register`.
- The **CSS is complete**, inlined per page: `.retailers__wrapper{display:flex}`
  with list `flex:9` and map `flex:11`, the map `position:fixed`, `45.76vw`
  wide, full height, black ground. Custom info-window styling exists for
  `__name`, `__address`, `__phone`, `__phone__text`, `__directions`,
  `__directions__text`, `__close`, `__arrow`, `__bottom`.
- `.retailers__map{display:none}` applies **only** inside
  `@media(max-width:768px)`. The map is desktop-only today.
- `main.js` (217KB, minified) holds a complete **Google Maps** locator:
  `Marker`, `InfoWindow`, `LatLngBounds`, `Geocoder`, `GeocoderStatus`.
- No `maps.googleapis.com` script tag exists on any of the 20 pages, so that
  code never runs.
- The locator's data source is `fetch("/php/ajax.php")` with
  `request=retailers-items`, feeding `addMarkers()`. This is WordPress AJAX from
  the original site. On a static Vercel deployment it 404s and the `.catch`
  swallows the error — which is why the panel is permanently empty.
- The SPA router is generic: it fetches a URL, reads `.content` and `.wrapper`,
  and switches on a `data-template` attribute. There is no hardcoded route
  table, so renaming a route is safe provided the file exists at the new path.

The reusable asset is therefore the **visual design** — DOM and CSS — not the
map code. The Google path cannot be revived; its backend is gone.

## Store data

Resolved from two Yandex short links supplied by the owner.

| Field | Store 1 | Store 2 |
| --- | --- | --- |
| Street | Sh. Rashidov koʻchasi | Gulshan koʻchasi |
| Locality | Yangiyer, Sirdaryo viloyati | Yangiyer, Sirdaryo viloyati |
| Latitude | 40.270080 | 40.272420 |
| Longitude | 68.816300 | 68.816341 |
| Yandex org | `168062899959` | none (dropped pin) |

The shops are roughly 260 m apart on different streets.

Assumptions, to be corrected if wrong:

- Both shops share the site-wide phone `+998 90 255 27 76` and hours
  `Har kuni 7:00 dan 23:00 gacha`. Store 1's Yandex listing confirms the phone
  and a 23:00 closing time; store 2 has no listing.
- Neither address carries a house number, because neither source provides one.
  No number will be invented.

## Design

### Content changes

| Element | Now | Becomes |
| --- | --- | --- |
| Nav item | `Sotuvchilar` → `/retailers` | `Manzillar` → `/manzillar` |
| `<title>`, `<h1>` | Sotuvchilar | Manzillar |
| Sub-CTA | "Aurum Tabac rasmiy sotuvchisi boʻling" + register link | removed |
| Body copy | "Sotuvchilar roʻyxati tez orada eʼlon qilinadi." | two store entries |
| Search box | geocode + POST to dead PHP | removed |
| Nav CTA | "Sotuvchini toping" | `Manzillar` |
| Nav CTA | "Sotuvchi boʻling" | removed (see Open question) |
| Footer | "Bizni qayerdan topasiz" → Sotuvchilar | → Manzillar |
| `contact.html` | "Sotuvchilar [email manzili]" row | **kept** — see below |

The search box goes because it has no backend and, over two locations, is
friction with no payoff.

### Map module

A new standalone `manzillar.js`, plus one surgical edit to `main.js`.

An earlier draft of this spec claimed `main.js` needed no edit because its
locator code would be "inert once the page no longer matches". That was wrong.
`data-template` indexes a page-class map — `this.page = this.pages[this.template];
this.page.create()` — so an unrecognised value yields `undefined.create()` and
breaks **all** JS on the page: preloader, nav, and age gate. The attribute is
read from `<body>` on a cold load and from `.content` on SPA navigation, so both
must agree.

Two further consequences of reading that class (`Va`):

- It hard-depends on the search form: `this.form = querySelector(".retailers__top form")`
  followed immediately by `this.form.querySelector(...)`. Removing the search box
  while keeping the `retailers` template would throw.
- It carries a hardcoded **Google Maps API key** (`AIzaSyCigp...`, redacted here
  — a static deploy serves this file too) — the template author's, shipped in
  this site's public bundle and billed to their account on every visit to the
  page. Removed from `main.js` on 2026-09-02; only the template author can
  revoke it.

So the page gets its own template name, `manzillar`, and `main.js` gains a
matching entry delegating to the module:

```js
manzillar:{create(){window.__aurumManzillar&&window.__aurumManzillar.create()},
           destroy(){window.__aurumManzillar&&window.__aurumManzillar.destroy()},
           show(){}},
```

`create`/`destroy`/`show` are called unguarded; `onResize`/`onUpdate` are guarded
with `&&` and may be omitted. Naming a distinct template also means `Va` is never
instantiated, so the third-party Google key is never used.

**The reveal must move with it.** Every page starts at `opacity:0` in CSS and is
revealed by its page class — `Va.createAnimations()` did that here. A no-op entry
would render a blank page, so `manzillar.js` performs the reveal itself via the
global `window.gsap`, with a direct style fallback if GSAP is absent.

The module holds the store data as a literal, so there is no geocoding, no
search, and no network dependency beyond the map tiles:

```js
const STORES = [
  {
    name: "Sh. Rashidov koʻchasi",
    locality: "Yangiyer, Sirdaryo viloyati",
    phone: "+998 90 255 27 76",
    hours: "Har kuni 7:00 dan 23:00 gacha",
    lat: 40.270080,
    lng: 68.816300,
  },
  {
    name: "Gulshan koʻchasi",
    locality: "Yangiyer, Sirdaryo viloyati",
    phone: "+998 90 255 27 76",
    hours: "Har kuni 7:00 dan 23:00 gacha",
    lat: 40.272420,
    lng: 68.816341,
  },
];
```

Neither shop has a trading name distinct from "Aurum Tabac", so each entry is
headed by **its street** — the one label that actually distinguishes them for
someone deciding which shop to walk to. The brand name is already the page's
context and would be identical on both entries, carrying no information.

Behaviour:

1. Initialise a Yandex JS API v3 map into `.retailers__map__inner__wrapper`.
2. Place one marker per store; fit the viewport to both.
3. On marker click, build an info-window from the **existing**
   `.retailers__map__infowindow__*` classes, so it inherits the site's
   typography and black ground without new CSS.
4. Each list entry and info-window carries a "Yoʻl koʻrsatish" link opening
   Yandex Maps directions to that store's coordinates.

**Coordinate order is the main correctness trap.** Yandex expresses coordinates
as `[longitude, latitude]`, the reverse of Google's `[lat, lng]`, and the two
shops differ far more in latitude than longitude — so a swap yields markers that
are plausibly placed but wrong. The literal above stores named `lat`/`lng`
fields and converts at the single point of use, rather than passing bare pairs
around.

### API key

Yandex JS API v3 requires an `apikey` on the script URL. The key ships in page
source and is therefore public; it must be restricted to the `aurum-tabac.uz`
referrer in the Yandex console, or it will be scraped and spent against the
project's quota.

The key lives in exactly one place. Until it is supplied the map cannot
function, so the page degrades: the two store entries, addresses, phone, hours
and directions links all render and work from static HTML, and only the map
panel is absent. The list is the load-bearing content; the map is enhancement.

### Routing

`retailers.html` → `manzillar.html`, with all 77 `/retailers` references
updated across the 20 pages, plus a permanent redirect so the already-indexed
URL does not 404:

```json
"redirects": [
  { "source": "/retailers", "destination": "/manzillar", "permanent": true }
]
```

### Mobile

`.retailers__map` is hidden below 768px today. For a store-locations page, where
most traffic is a phone looking for directions, the map is the point. The
override stacks it above the list at a fixed height instead of hiding it.

## Verification

- Both `/manzillar` and the `/retailers` redirect resolve on `localhost:8000`.
- All 20 pages still return 200.
- `grep -ri sotuvchi` returns nothing across the 20 pages.
- Two markers render at the coordinates above — checked against the source
  links, specifically that latitude and longitude are not transposed.
- Info-window opens and closes; directions links open the correct coordinates.
- No console errors, including no failed `/php/ajax.php` request.

The map assertions require the API key. Without it, only the list, routing, and
label changes are verifiable, and the map will be reported as untested rather
than working.

## Reseller path

Removing "Sotuvchi boʻling" from the nav would otherwise delete the site's only
reseller-signup path, and that question was never answered. So the contact
page's "Sotuvchilar" email row **stays**: it sits outside the section being
renamed, and it keeps a wholesale channel open. `story.html` likewise keeps its
paragraph about long-term partners — editorial copy, not part of this section.

If Aurum has no interest in wholesale partners, both can go in a follow-up.
