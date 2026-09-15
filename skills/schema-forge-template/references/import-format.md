# Schema Forge import JSON format

The file pasted into **Schema → Templates → Import JSON**. One template per file is typical; to ship several, use a top-level array of these objects (each is imported separately).

```json
{
  "schemaForge": 1,
  "name": "Product (main entity)",
  "description": "Product schema for all WooCommerce products. Needs meta keys: price, sku.",
  "tree": { "version": 1, "root": { …Node } },
  "settings": {
    "yoast": { "suppressArticle": true, "webPageType": "ItemPage" },
    "standalone": { "includeCoreNodes": true }
  }
}
```

`name` and `description` are shown in the template list. `settings` is optional; unknown keys are ignored.

There is exactly **one root node** per template; there is no `tree.nodes` list. Every other node hangs off a property of some node as a `node`/`repeat` value. To give a nested node its own `@id` in the page's `@graph` (so it can be referenced elsewhere with `node:<id>`, or shared with other pages via `idOverride`), set `options.placement: "graph"` on that nested node — it is then emitted as a sibling graph node and the parent property becomes `{"@id": …}`.

## Node

```json
{
  "id": "n_product",
  "type": "Product",
  "options": {
    "isMainEntity": true,
    "idOverride": "",
    "placement": "graph",
    "extraTypes": []
  },
  "properties": [ …Property ]
}
```

| Field | Rules |
|---|---|
| `id` | `^[A-Za-z0-9_-]{1,40}$`, unique across the whole template (nodes, properties and values share one namespace). Missing or duplicate ids are regenerated on import, which breaks `node:` references — always set them. |
| `type` | schema.org type name, `^[A-Za-z0-9][A-Za-z0-9_]{0,80}$`. Unknown types import with a warning. |
| `options.isMainEntity` | Root only. Adds `mainEntityOfPage` and sets the page's `WebPage.mainEntity`. |
| `options.placement` | `inline` (nested object, default for nested nodes) or `graph` (emitted as its own `@graph` node with an `@id`; the parent property holds `{"@id"}`). The root is always `graph`. |
| `options.idOverride` | Optional `@id`. Tokens allowed. A `#fragment` is appended to the page URL; a full URL is used as-is. Default `@id`: `{page URL}#/schema/{type}/{template id}`. |
| `options.extraTypes` | Additional `@type` values, e.g. `["Store"]` on a `LocalBusiness`. |

Limits: depth ≤ 12 levels, ≤ 500 nodes, ≤ 200 repeat rows.

## Property

```json
{
  "id": "p_name",
  "name": "name",
  "dataType": "auto",
  "onEmpty": "dropNode",
  "fallback": "",
  "values": [ …Value ]
}
```

| Field | Rules |
|---|---|
| `name` | `^[a-z][A-Za-z0-9_-]{0,80}$` (lowerCamelCase; hyphens allowed for `query-input`). Never `@id`/`@type` — use node options. |
| `dataType` | `auto` (default), `text`, `url`, `number`, `integer`, `boolean`, `date` (`Y-m-d`), `datetime` (ISO 8601), `json`. Use `number` for prices/ratings, `url` for links and images given as URLs, `datetime` for post dates. |
| `onEmpty` | What happens when every value resolves empty on a page: `drop` (omit the property, default), `fallback` (use `fallback`, tokens allowed), `dropNode` (required — drop the whole containing node). |
| `values` | One or more. Multiple non-empty values become a JSON array. |

Repeating a property name on the same node is allowed (values merge into a list) but prefer one property with several values.

## Values

```json
{ "id": "v_1", "kind": "text",   "value": "{{post.title}}", "allowPartial": false }
{ "id": "v_2", "kind": "node",   "node": { …Node } }
{ "id": "v_3", "kind": "ref",    "target": "yoast:organization" }
{ "id": "v_4", "kind": "repeat", "source": "{{acf.faqs}}", "node": { …Node } }
```

- **text** — literal text, a token, or a mix (`{{post.title}} – {{site.name}}`). A mixed string is dropped entirely when any token is empty unless `allowPartial` is true. A text value that is exactly one token may resolve to a structured value: `{{post.featured_image_object}}` becomes a full `ImageObject`, `{{terms.category}}` becomes an array of names.
- **node** — a nested object. Nested nodes default to `placement: "inline"`.
- **ref** — `{"@id": …}` pointing at an existing entity:
  - `yoast:webpage`, `yoast:website`, `yoast:organization`, `yoast:person`, `yoast:publisher` (organization or person, whichever the site represents), `yoast:author` (post author), `yoast:primaryimage` (featured image node), `yoast:breadcrumb`, `yoast:article`. Without Yoast these map to the plugin's own core nodes (`breadcrumb` and `article` then resolve to nothing). `core:` is accepted as a synonym.
  - `node:<nodeId>` — another node in this template that has `placement: "graph"`.
  - `template:<postId>` — the root of another saved template (rarely useful in an import, since ids differ per site).
- **repeat** — resolves `source` to a list and renders `node` once per item with `{{item.<field>}}` / `{{item.value}}` / `{{item.index}}` available inside. Sources: `{{acf.<repeater>}}` (rows), `{{terms.<taxonomy>.objects}}` (rows with name/slug/link/description), `{{acf.<relationship>}}` (rows with name/url/excerpt), `{{acf.<gallery>}}` (ImageObjects), or any meta key holding a list.

## Tokens

Grammar: `{{namespace.path|filter|filter:"arg"}}`. Missing values resolve empty and trigger `onEmpty`.

| Namespace | Paths |
|---|---|
| `post` | `title`, `excerpt` (manual excerpt or first 55 words), `content_text`, `content` (HTML), `permalink`/`url`, `slug`, `id`, `type`, `type_label`, `date`, `modified` (ISO 8601), `featured_image` (URL), `featured_image_object` (ImageObject), `word_count`, `comment_count`, `author.name`, `author.url`, `author.website`, `author.description`, `author.avatar`, `parent.title`, `parent.permalink` |
| `site` | `name`, `url`, `description`, `language`, `logo`, `logo_object`, `icon`, `canonical`, `search_url` |
| `meta` | any post meta key: `{{meta.price}}`, dotted access into serialized arrays `{{meta.specs.weight}}` |
| `acf` | ACF / Secure Custom Fields: `{{acf.field}}`, group sub-fields `{{acf.group.sub}}`; images → ImageObject, post objects → `{name,url,excerpt}`, repeaters → rows |
| `terms` | `{{terms.category}}` (names), `.names`, `.slugs`, `.links`, `.objects`, `.count`, `.first.name`, `.first.link`; `{{terms.current.name|description|link}}` on term archives |
| `item` | inside a repeat: `{{item.value}}` (scalar rows), `{{item.<field>}}`, `{{item.index}}` |

Filters: `join:", "`, `first`, `last`, `count`, `date:Y-m-d` (any PHP date format), `upper`, `lower`, `trim`, `truncate:160`, `words:55`, `strip` (remove HTML), `default:"text"`, `key:name` (pick a key from an array), `nonzero` (treat `0` as empty — WooCommerce stores `0` ratings), `map:"a=b,c=d,*=fallback"` (translate stored values into schema.org URLs, e.g. `{{meta._stock_status|map:"instock=https://schema.org/InStock,outofstock=https://schema.org/OutOfStock,onbackorder=https://schema.org/BackOrder"}}`), `raw`.

`{{site.option.<name>}}` reads an allow-listed WordPress option: `woocommerce_currency`, `woocommerce_store_address`, `woocommerce_store_city`, `woocommerce_store_postcode`, `woocommerce_default_country`, `date_format`, `timezone_string` (sites can extend the list with the `schema_forge_site_option_tokens` filter).

## Settings

| Key | Effect |
|---|---|
| `yoast.webPageType` | Overrides the page node's `@type` while this template renders: `ItemPage` for products, `FAQPage`, `CollectionPage`, `ProfilePage`, `ContactPage`, `AboutPage`, `CheckoutPage`, `QAPage`… |
| `yoast.suppressArticle` | Drops Yoast's automatic `Article` node. Use when the template's root *is* the page's main entity and is not an Article subtype. |
| `standalone.includeCoreNodes` | Without Yoast: also emit WebSite/WebPage/Organization nodes (default true). |

## Minimal complete example

```json
{
  "schemaForge": 1,
  "name": "Event",
  "description": "Event schema for the `event` post type. Meta keys: start_date, end_date, venue_name, venue_address, ticket_url, price.",
  "tree": {
    "version": 1,
    "root": {
      "id": "n_event", "type": "Event",
      "options": { "isMainEntity": true, "idOverride": "", "placement": "graph", "extraTypes": [] },
      "properties": [
        { "id": "p_name", "name": "name", "dataType": "auto", "onEmpty": "dropNode", "fallback": "", "values": [ { "id": "v_name", "kind": "text", "value": "{{post.title}}" } ] },
        { "id": "p_start", "name": "startDate", "dataType": "datetime", "onEmpty": "dropNode", "fallback": "", "values": [ { "id": "v_start", "kind": "text", "value": "{{meta.start_date}}" } ] },
        { "id": "p_desc", "name": "description", "dataType": "auto", "onEmpty": "drop", "fallback": "", "values": [ { "id": "v_desc", "kind": "text", "value": "{{post.excerpt}}" } ] },
        { "id": "p_image", "name": "image", "dataType": "auto", "onEmpty": "drop", "fallback": "", "values": [ { "id": "v_image", "kind": "ref", "target": "yoast:primaryimage" } ] },
        { "id": "p_loc", "name": "location", "dataType": "auto", "onEmpty": "drop", "fallback": "", "values": [ { "id": "v_loc", "kind": "node", "node": {
          "id": "n_place", "type": "Place", "options": { "isMainEntity": false, "idOverride": "", "placement": "inline", "extraTypes": [] },
          "properties": [
            { "id": "p_pname", "name": "name", "dataType": "auto", "onEmpty": "dropNode", "fallback": "", "values": [ { "id": "v_pname", "kind": "text", "value": "{{meta.venue_name}}" } ] },
            { "id": "p_addr", "name": "address", "dataType": "auto", "onEmpty": "drop", "fallback": "", "values": [ { "id": "v_addr", "kind": "text", "value": "{{meta.venue_address}}" } ] }
          ] } } ] },
        { "id": "p_org", "name": "organizer", "dataType": "auto", "onEmpty": "drop", "fallback": "", "values": [ { "id": "v_org", "kind": "ref", "target": "yoast:organization" } ] }
      ]
    }
  },
  "settings": { "yoast": { "suppressArticle": true, "webPageType": "" }, "standalone": { "includeCoreNodes": true } }
}
```
