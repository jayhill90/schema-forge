# Schema Forge

Drag-and-drop **schema.org template builder** for WordPress with first-class **Yoast SEO** integration.

SEO managers build reusable structured-data templates visually (Product, LocalBusiness, FAQPage, Event, Recipe, … the full schema.org vocabulary), fill them with dynamic tokens, and assign them per post, per post type, per taxonomy/term, or to archive pages. When Yoast SEO is active the nodes are merged into Yoast's `@graph`; otherwise Schema Forge emits its own JSON-LD.

## Features

- **Visual builder** – searchable palette of every schema.org type and property (compiled from the official release, including pending and deprecated terms, which are flagged, plus the `query-input` extension used by sitelinks search boxes), nested nodes, references, repeat-over-list values, live JSON-LD preview against a real post, validation panel, undo/redo, keyboard-accessible drag and drop with screen-reader announcements.
- **Dynamic tokens** – `{{post.title}}`, `{{post.excerpt}}`, `{{post.featured_image_object}}`, `{{site.name}}`, `{{meta.sku}}`, `{{acf.field}}`, `{{terms.category}}`, `{{item.field}}` (inside repeats), with filters like `|join:", "`, `|date:Y-m-d`, `|upper`, `|default:"n/a"`, `|nonzero`, `|map:"instock=https://schema.org/InStock"`.
- **Empty handling** – per property: omit, use a fallback, or drop the whole node (required).
- **Assignment rules** – post type defaults → taxonomy → term add/exclude → per-post overrides (block editor sidebar or classic meta box), plus front page, blog, search, 404, author, date, post-type and term archives.
- **Yoast SEO integration** – one graph piece per template via `wpseo_schema_graph_pieces`; references to `#organization`, person, `#primaryimage`, `#breadcrumb`, `#article`; set the page's `mainEntity`; override the WebPage `@type` (e.g. `ItemPage`, `FAQPage`); suppress Yoast's Article node.
- **Standalone mode** – without Yoast, outputs WebSite/WebPage/Organization core nodes plus your templates in `wp_head`.
- **Import/export** templates as JSON.

## Claude skill: generate a template from a page

`skills/schema-forge-template/` is a [Claude Code skill](https://docs.claude.com/en/docs/claude-code/skills) that inspects a page (URL or saved HTML), decides the schema.org type it should carry, and writes an import-ready template JSON with dynamic tokens. Install it by copying or symlinking the folder into `~/.claude/skills/`, then ask Claude something like *"build a Schema Forge template for https://example.com/product/x"*. It bundles `scripts/inspect-page.mjs` (page digest) and `scripts/validate.mjs` (checks a JSON file against the plugin's sanitizer rules and the schema.org vocabulary) — both are plain Node scripts you can also run by hand.

## Requirements

PHP 8.1+, WordPress 6.6+. Node 24 LTS for development (`nvm use` picks it up from `.nvmrc`; Node 22.22.2+ also works). See [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) for dependency overrides and install-script approvals.

## Development

```bash
npm install
npm run vocab            # download + compile the schema.org vocabulary into assets/vocab
npm run build            # or `npm start` for watch mode
npm run playground       # WordPress Playground with Yoast SEO + SCF + sample content on http://127.0.0.1:9400
```

Tests (no local PHP needed — everything runs inside Playground):

```bash
npm run test:unit                 # Vitest: vocab compiler, token parser, tree reducer, vocab helpers
npm run lint:js                   # ESLint (WordPress rules) on all JS, including the Claude skill scripts
npm run lint:php                  # syntax-check every PHP file with Playground's PHP
npm run playground:test           # Yoast-mode smoke tests (playground/smoke-test.php)
npm run playground:test:standalone
npm run verify                    # all of the above
npm run i18n                      # regenerate languages/schema-forge.pot
```

Smoke-test summaries are written to `playground/.cache/smoke-*.log`.

## Hooks

| Hook | Purpose |
|---|---|
| `schema_forge_capability` | Capability required to manage templates (default `manage_schema_forge`). |
| `schema_forge_capability_roles` | Roles granted the capability on activation. |
| `schema_forge_token_providers` | Register additional token providers (`SchemaForge\Tokens\ProviderInterface`). |
| `schema_forge_resolved_token` | Filter any resolved token value. |
| `schema_forge_token_filter_{name}` | Implement a custom token filter, e.g. `{{post.title|myfilter}}`. |
| `schema_forge_resolved_templates` | Change which templates apply to a page. |
| `schema_forge_compiled_nodes` | Filter the nodes compiled for a template. |
| `schema_forge_standalone_graph` | Filter the standalone JSON-LD graph. |
| `schema_forge_site_option_tokens` | Allow-list options readable via `{{site.option.key}}`. |

Yoast's own filters keep working: each template piece is filterable via `wpseo_schema_schema-forge-{template id}`.

## Template JSON

```json
{
  "version": 1,
  "root": {
    "id": "n_1", "type": "Product",
    "options": { "isMainEntity": true, "placement": "graph", "idOverride": "", "extraTypes": [] },
    "properties": [
      { "id": "p_1", "name": "name", "dataType": "auto", "onEmpty": "dropNode", "fallback": "",
        "values": [ { "id": "v_1", "kind": "text", "value": "{{post.title}}" } ] },
      { "id": "p_2", "name": "offers", "values": [ { "id": "v_2", "kind": "node", "node": { "type": "Offer", "properties": [] } } ] },
      { "id": "p_3", "name": "brand", "values": [ { "id": "v_3", "kind": "ref", "target": "yoast:organization" } ] },
      { "id": "p_4", "name": "mainEntity", "values": [ { "id": "v_4", "kind": "repeat", "source": "{{acf.faqs}}", "node": { "type": "Question", "properties": [] } } ] }
    ]
  }
}
```
