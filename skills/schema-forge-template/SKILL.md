---
name: schema-forge-template
description: Examine a web page (a URL, saved HTML, or a description of a page type) and generate a Schema Forge import JSON file — a reusable schema.org template with dynamic {{tokens}} that a WordPress site imports via Schema → Import JSON in the Schema Forge plugin. Use this whenever someone wants structured data, schema markup, JSON-LD, rich results or "schema" for a WordPress page or page type, mentions Schema Forge, Yoast schema, a schema template, or wants to know what schema.org markup a page should carry — even if they don't say "import" or "JSON".
---

# Schema Forge template from a page

Schema Forge is a WordPress plugin whose templates are JSON trees of schema.org nodes. A template is not the JSON-LD for one page: it is a *pattern* that renders on every page it is assigned to, with `{{tokens}}` filled from each post (`{{post.title}}`, `{{meta.price}}`, `{{acf.faqs}}`…). So the job is to read one representative page, work out what kind of page it is and which values vary per page, and express that as a template the plugin can import and reuse across the whole post type.

## Workflow

1. **Inspect the page.** Run the bundled digest script so you work from structured facts rather than a summary:
   ```bash
   node <skill-dir>/scripts/inspect-page.mjs <url-or-html-file> > /tmp/page-digest.json
   ```
   It prints title, meta/OpenGraph tags, WordPress body classes (post type!), headings, existing JSON-LD, visible prices/dates/FAQ-like pairs, images and a text sample. If the user only *described* the page (no URL), skip this and work from the description — say so in the summary.

2. **Decide the page kind and root type.** Read `references/page-analysis.md` for the signals-to-type mapping. Pick one main entity for the page (Product, Article, FAQPage, HowTo, Recipe, Event, LocalBusiness, APIReference, SoftwareApplication, JobPosting, Course, Service, Person…). If the page carries two distinct things (a product *and* an FAQ), produce two templates in one file so they can be assigned independently.

3. **Map content to properties.** Open `references/rich-results.md` for the type: it lists what Google requires and recommends and the token that usually supplies it in WordPress. Cover every required property, the recommended ones the page actually has, and anything visible on the page that schema.org can express (specs, ratings, opening hours, authors, platforms). Skip properties the page has no data for — empty schema is worse than none.

4. **Choose tokens over literals** whenever a value would differ on another page of the same type. Title, description, images, dates, author, categories, prices and SKUs vary; brand name, currency, availability defaults, organization details and the page's `@type` usually don't. When the page shows a value that must live in a custom field (price, SKU, rating, event date), use `{{meta.<key>}}` with a sensible key and list those keys in the summary so the site owner can confirm them. Prefer existing JSON-LD on the page (from another plugin or a theme) as a hint for which fields exist.

5. **Write the JSON** in the exact import format described in `references/import-format.md`. Keep in mind:
   - `onEmpty: "dropNode"` on the one or two properties without which the node is meaningless (`name` on a Product, `headline` on an Article, `startDate` on an Event) so pages that lack the data output nothing rather than broken schema.
   - `isMainEntity: true` on the root when it describes what the page is about; set `settings.yoast.webPageType` (e.g. `ItemPage`, `FAQPage`, `CollectionPage`) and `suppressArticle: true` when the template replaces Yoast's automatic Article.
   - Use `ref` values (`yoast:organization`, `yoast:author`, `yoast:primaryimage`) instead of retyping site-level entities.
   - Use `repeat` for lists of similar items (FAQ questions, steps, offers) with `{{item.*}}` tokens.
   - Unique `id`s on every node/property/value (`n_…`, `p_…`, `v_…`).
   - One root per template; extra `@graph` nodes are nested nodes with `placement: "graph"`, never a separate list.
   - WooCommerce sites: follow the WooCommerce section of `references/page-analysis.md` (real meta keys, `|nonzero` on ratings, `|map` for stock status, currency from `{{site.option.woocommerce_currency}}`, and the note about disabling WooCommerce's own Product JSON-LD).

6. **Validate and save.** Write the file (e.g. `<slug>-schema-template.json`) and run:
   ```bash
   node <skill-dir>/scripts/validate.mjs <file>
   ```
   It applies the plugin's own sanitizer rules and checks types and properties against the schema.org vocabulary bundled with the skill. Fix errors; read warnings and keep only the deliberate ones (a custom property, a pending type).

7. **Report** briefly: the root type(s) chosen and why, the tokens used, the custom-field keys or ACF fields the site must provide, anything you assumed, and the import steps: *Schema → Templates → Import JSON → paste → Import*, then enable the template and assign it under *Assignment rules* (or on the post). Imported templates arrive disabled on purpose.

## Judgement calls

- **Yoast already outputs** WebSite, WebPage, Organization/Person, Breadcrumb and (for posts) Article. Don't duplicate them; reference them. Only replace Article when the page's real main entity is something else (Product, Recipe, Event, APIReference…).
- **A template is for a post type, not a URL.** If the page is one product, the template is "Product" for all products. Literal text is fine for things that are genuinely constant across the type (brand, currency, `https://schema.org/InStock`), and for "the site" (organization name, phone) when the template is meant for one page such as the contact page.
- **Nested vs graph placement.** Keep nested objects `inline` (default). Use `placement: "graph"` only when another node needs to reference it by `@id` (`node:<id>`), e.g. a `WebAPI` referenced from an `APIReference`'s `about`.
- **Don't invent data.** If the page doesn't show a rating, don't add `aggregateRating`. If it does but the source is unclear, use a `{{meta.*}}` token and flag the key.
- **Deprecated schema.org terms** are allowed but the validator warns and names the replacement; use the replacement unless the user insists.

Worked examples: `assets/example-product.json` (Product with Offer, brand fallback, ItemPage override) and `assets/example-faq.json` (FAQPage repeating over an ACF repeater). Read one before writing your first template so the shape is fresh.
