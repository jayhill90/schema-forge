<?php
/**
 * Idempotent sample content for the playground. Safe to re-run.
 */

if ( ! function_exists( 'sf_seed_post' ) ) {
	function sf_seed_post( array $args, array $meta = [], array $terms = [] ): int {
		$existing = get_page_by_path( $args['post_name'], OBJECT, $args['post_type'] );
		if ( $existing ) {
			$id = (int) $existing->ID;
		} else {
			$id = (int) wp_insert_post( array_merge( [ 'post_status' => 'publish', 'post_author' => 1 ], $args ), true );
		}
		foreach ( $meta as $key => $value ) {
			update_post_meta( $id, $key, $value );
		}
		foreach ( $terms as $taxonomy => $names ) {
			wp_set_object_terms( $id, $names, $taxonomy );
		}
		return $id;
	}
}

update_option( 'blogname', 'Forge Demo Store' );
update_option( 'blogdescription', 'Structured data, forged by hand.' );

// Yoast: site represents an organization.
// A tiny PNG attachment to act as the organization logo / featured image (no GD needed).
if ( ! function_exists( 'sf_seed_image' ) ) {
	function sf_seed_image( string $slug ): int {
		$existing = get_posts( [ 'post_type' => 'attachment', 'name' => $slug, 'post_status' => 'inherit', 'numberposts' => 1, 'fields' => 'ids' ] );
		if ( $existing ) {
			return (int) $existing[0];
		}
		$upload = wp_upload_dir();
		wp_mkdir_p( $upload['path'] );
		$file = trailingslashit( $upload['path'] ) . $slug . '.png';
		// 64x64 opaque PNG.
		$png = base64_decode( 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAKklEQVR4nO3BMQEAAADCoPVPbQhfoAAAAAAAAAAAAAAAAAAAAAAAAAAAeAMQQAABkq2tXQAAAABJRU5ErkJggg==' );
		file_put_contents( $file, $png );
		$id = wp_insert_attachment(
			[ 'post_title' => ucfirst( $slug ), 'post_name' => $slug, 'post_mime_type' => 'image/png', 'post_status' => 'inherit', 'post_excerpt' => 'Seeded ' . $slug ],
			$file
		);
		wp_update_attachment_metadata( $id, [ 'width' => 64, 'height' => 64, 'file' => _wp_relative_upload_path( $file ), 'sizes' => [], 'image_meta' => [] ] );
		return (int) $id;
	}
}
$logo_id = sf_seed_image( 'forge-logo' );

$titles = get_option( 'wpseo_titles', [] );
$titles = is_array( $titles ) ? $titles : [];
$titles['company_or_person'] = 'company';
$titles['company_name']      = 'Forge Demo Store';
$titles['company_logo_id']   = $logo_id;
$titles['company_logo']      = wp_get_attachment_url( $logo_id );
update_option( 'wpseo_titles', $titles );
if ( class_exists( 'WPSEO_Options' ) && method_exists( 'WPSEO_Options', 'clear_cache' ) ) {
	WPSEO_Options::clear_cache();
}

wp_insert_term( 'Shoes', 'product_cat', [ 'slug' => 'shoes', 'description' => 'Footwear for every terrain.' ] );
wp_insert_term( 'Hats', 'product_cat', [ 'slug' => 'hats' ] );
wp_insert_term( 'Recipes', 'category', [ 'slug' => 'recipes' ] );

$GLOBALS['sf_seed'] = [
	'product_trail' => sf_seed_post(
		[ 'post_type' => 'product', 'post_name' => 'trail-runner', 'post_title' => 'Trail Runner X1', 'post_excerpt' => 'A featherweight trail shoe.', 'post_content' => 'Built for long days on rocky singletrack. <strong>Vibram</strong> outsole.' ],
		[ 'price' => '129.00', 'sku' => 'TR-X1', 'currency' => 'USD', 'brand_name' => 'Forge Athletics' ],
		[ 'product_cat' => [ 'shoes' ] ]
	),
	'product_hat'   => sf_seed_post(
		[ 'post_type' => 'product', 'post_name' => 'sun-hat', 'post_title' => 'Wide Brim Sun Hat', 'post_content' => 'Keeps the sun off.' ],
		[ 'price' => '35.00', 'sku' => 'HAT-01', 'currency' => 'USD' ],
		[ 'product_cat' => [ 'hats' ] ]
	),
	'product_nosku' => sf_seed_post(
		[ 'post_type' => 'product', 'post_name' => 'mystery-box', 'post_title' => 'Mystery Box', 'post_content' => 'No SKU, no price.' ],
		[],
		[ 'product_cat' => [ 'hats' ] ]
	),
	'post_recipe'   => sf_seed_post(
		[ 'post_type' => 'post', 'post_name' => 'campfire-chili', 'post_title' => 'Campfire Chili', 'post_excerpt' => 'Slow, smoky, simple.', 'post_content' => 'Brown the beef. Add beans. Wait.' ],
		[ 'prep_time' => 'PT20M', 'cook_time' => 'PT2H' ],
		[ 'category' => [ 'recipes' ] ]
	),
	'post_api'      => sf_seed_post(
		[ 'post_type' => 'post', 'post_name' => 'orders-api', 'post_title' => 'Orders API v2', 'post_excerpt' => 'Create and query orders over HTTPS.', 'post_content' => 'GET /orders, POST /orders.' ],
		[ 'api_version' => '2.1.0', 'platform' => 'Web' ]
	),
	'post_plain'    => sf_seed_post(
		[ 'post_type' => 'post', 'post_name' => 'hello-forge', 'post_title' => 'Hello Forge', 'post_content' => 'A plain post with no special schema.' ]
	),
	'page_about'    => sf_seed_post(
		[ 'post_type' => 'page', 'post_name' => 'about', 'post_title' => 'About Forge Demo Store', 'post_content' => 'We make things.' ]
	),
	'page_home'     => sf_seed_post(
		[ 'post_type' => 'page', 'post_name' => 'home', 'post_title' => 'Home', 'post_content' => 'Welcome.' ]
	),
	'catalog_item'  => sf_seed_post(
		[ 'post_type' => 'catalog_item', 'post_name' => 'classic-widget', 'post_title' => 'Classic Widget', 'post_content' => 'Edited in the classic editor.' ]
	),
];

set_post_thumbnail( $GLOBALS['sf_seed']['post_recipe'], sf_seed_image( 'chili-photo' ) );
set_theme_mod( 'custom_logo', $logo_id );
update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $GLOBALS['sf_seed']['page_home'] );

$seed_templates = SCHEMA_FORGE_DIR . 'playground/seed-templates.php';
if ( file_exists( $seed_templates ) ) {
	require $seed_templates;
}

flush_rewrite_rules();
echo "Seeded.\n";
