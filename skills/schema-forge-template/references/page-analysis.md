# Reading a page to choose its schema

Work from the digest produced by `scripts/inspect-page.mjs`. The goal is two decisions: **what kind of page is this** (→ root type) and **which values vary per page** (→ tokens).

## Signals for the page kind

Check them in this order; the first strong signal usually wins.

| Signal (from the digest) | Suggests |
|---|---|
| `bodyClasses` contains `single-product`, `woocommerce-page`, `product-template-default` | Product (WooCommerce: meta keys `_price`, `_sku`, `_regular_price`, `_sale_price`, `_stock_status`) |
| `single-<cpt>` / `<cpt>-template-default` | The post type `<cpt>` — name the template after it |
| `og:type` = `article`, `single-post`, byline + date visible | Article / BlogPosting / NewsArticle. Yoast already emits Article on posts; only add a template if you need a *different* main entity or extra nodes (e.g. `VideoObject`, `Review`) |
| Existing JSON-LD on the page | Strongest hint of all: reuse its `@type` and the properties it fills; convert its literal values to tokens |
| Repeated question-style headings with answers, `<details>`, "FAQ" in title/URL, `faq` body class | FAQPage → repeat `Question`/`Answer` |
| Numbered steps, "How to…" title, materials/tools lists | HowTo → `HowToStep` repeat |
| Ingredients + instructions, prep/cook times | Recipe |
| A date range, venue, "tickets", "register" | Event |
| Address, phone, opening hours, map | LocalBusiness (pick the subtype: Restaurant, Store, Dentist, LegalService…) or Organization for an About page |
| Endpoint lists (`GET /…`), code blocks, "API", "reference", "SDK", parameters tables | APIReference (root) + a `WebAPI` node for the service; TechArticle for guides |
| Download/install buttons, OS/platform, version, "app" | SoftwareApplication / WebApplication / MobileApplication |
| Salary, "apply", employment type | JobPosting |
| Syllabus, lessons, "enroll" | Course |
| Embedded video as the main content | VideoObject (often alongside Article) |
| Author bio, headshot, social links | Person (ProfilePage override) |
| A service description with pricing/areas | Service |
| A list of similar items (category, archive) | CollectionPage override + `ItemList` of `ListItem` (repeat) |

When two kinds are both real (a product page with an FAQ section), produce two templates in one file — the site can assign them separately.

## What varies per page (→ tokens)

Ask, for each value on the page: *would this be different on another page of the same type?*

- Varies: title, description/excerpt, main image, dates, author, categories/tags, price, SKU, rating, duration, location, the list of FAQ items or steps → token.
- Constant across the type: brand (when single-brand), currency, availability default, organization/publisher, the `@type` itself, contact details on a one-off page → literal or `ref`.

Where does the varying value live in WordPress?

| Value on the page | Usual source | Token |
|---|---|---|
| Page/product title | post title | `{{post.title}}` |
| Intro paragraph / meta description | excerpt | `{{post.excerpt}}` |
| Body text | content | `{{post.content_text}}` or `{{post.content_text|words:120}}` |
| Hero/featured image | featured image | `{{post.featured_image_object}}` or `ref yoast:primaryimage` |
| Published / updated dates | post dates | `{{post.date}}`, `{{post.modified}}` (dataType `datetime`) |
| Author | post author | `ref yoast:author` (or `{{post.author.name}}` inside a Person node) |
| Categories, tags, product categories | taxonomy | `{{terms.category}}`, `{{terms.product_cat.first.name}}` |
| Price, SKU, rating, dates for events, venue… | custom field | `{{meta.<key>}}` — use WooCommerce keys when the body classes say WooCommerce (`_price`, `_sku`, `_stock_status`), else a plain descriptive key (`price`, `sku`, `event_start`) and **list it for confirmation** |
| Repeating FAQ / steps / gallery | ACF repeater or gallery | `repeat` over `{{acf.<field>}}` with `{{item.question}}` / `{{item.answer}}` etc. If ACF is not in use, note that the site needs a repeater (or a meta key holding a list) |
| Site name / URL / logo | site | `{{site.name}}`, `{{site.url}}`, `{{site.logo_object}}` |

## Reading the digest

`inspect-page.mjs` returns:

```
title, metaDescription, canonical, lang
og            – OpenGraph/Twitter tags (type, image, site_name, …)
bodyClasses   – WordPress body classes (post type, template, plugin hints)
generator     – <meta name="generator"> (WordPress version, WooCommerce, …)
jsonLd        – every existing ld+json block, parsed
headings      – ordered h1–h3 with text
faqPairs      – heading/paragraph pairs that look like Q&A, or <details>/<summary>
prices        – strings that look like money, with surrounding text
dates         – <time> elements and ISO-looking dates
images        – prominent images (src, alt, width/height when present)
lists         – ordered/unordered lists with their items (steps, ingredients, features)
tables        – small tables as arrays (spec sheets, parameter tables)
codeBlocks    – count and a few samples (API docs)
links         – counts of internal/external links, plus "apply/buy/register/download" style CTAs
textSample    – first ~1500 characters of main text
```

Use `headings`, `lists` and `tables` to find spec-like data worth expressing (e.g. `additionalProperty` PropertyValue pairs, `HowToStep`s). Use `prices`/`dates` to confirm a Product/Event reading and to name meta keys plausibly.

## WooCommerce products

When the digest reports `plugins: ['woocommerce']` or `postType: 'product'`:

- Meta keys: `_price` (current), `_regular_price`, `_sale_price`, `_sale_price_dates_to` (timestamp → `|date:Y-m-d`), `_sku`, `_global_unique_id` (GTIN, WooCommerce ≥ 9.2), `_weight`, `_length`/`_width`/`_height`, `_stock_status` (`instock`/`outofstock`/`onbackorder` → use the `map` filter to schema.org URLs), `_wc_average_rating` and `_wc_review_count` (both `0` when unrated → add `|nonzero` and `onEmpty: dropNode` so unrated products get no `aggregateRating`).
- Taxonomies: `product_cat`, `product_tag`, `product_brand` (core since WooCommerce 9.6; older sites use a plugin taxonomy such as `pwb-brand` or `product_brand`), attributes as `pa_<slug>` taxonomies (`{{terms.pa_colour|join:", "}}`) when they are global attributes; custom (non-global) attributes are serialized in `_product_attributes` and are not reliably token-addressable.
- Currency: `{{site.option.woocommerce_currency}}` (allow-listed) rather than a literal, unless the store sells in one currency and the user prefers a literal.
- Reviews are WordPress comments, which have no token provider — don't emit `review` nodes; `aggregateRating` is enough for the rich result.
- Gallery images (`_product_image_gallery`) are attachment IDs, not URLs — use the featured image only.
- WooCommerce core already prints its own `Product` JSON-LD (`woocommerce_structured_data_product`). Tell the user to disable it — `add_filter( 'woocommerce_structured_data_product', '__return_empty_array' );` — or the page will carry two Product entities.
