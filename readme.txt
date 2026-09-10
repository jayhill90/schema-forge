=== Schema Forge ===
Contributors: jayhill
Tags: schema, structured data, json-ld, seo, yoast
Requires at least: 6.6
Tested up to: 6.8
Requires PHP: 8.1
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Drag-and-drop schema.org template builder with Yoast SEO graph integration.

== Description ==

Schema Forge lets SEO managers build reusable schema.org templates visually and assign them to posts, post types, taxonomy terms and archive pages. Values can be literal text or dynamic tokens such as `{{post.title}}`, `{{meta.price}}`, `{{acf.faqs}}` or `{{terms.category}}`, so one template applies to any number of pages.

When Yoast SEO is active, template nodes are merged into Yoast's schema graph and can reference Yoast's entities (organization, person, primary image, breadcrumb). Without Yoast, Schema Forge outputs its own JSON-LD graph.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/schema-forge/` (with the `build/` and `assets/vocab/` folders present).
2. Activate the plugin.
3. Go to **Schema** in the admin menu to build templates and assign them.

== Changelog ==

= 0.1.0 =
* Initial release.
