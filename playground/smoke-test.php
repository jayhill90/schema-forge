<?php
/**
 * Smoke tests executed inside Playground via a runPHP blueprint step.
 * Any failed assertion throws → non-zero exit → `npm run playground:test` fails.
 */

use SchemaForge\Assignment\AssignmentResolver;
use SchemaForge\Assignment\QueryContext;
use SchemaForge\Model\RenderContext;
use SchemaForge\Output\GraphBuilder;
use SchemaForge\Output\Standalone\Renderer;
use SchemaForge\Plugin;
use SchemaForge\Repository\TemplateRepository;

$GLOBALS['sf_failures'] = [];
$GLOBALS['sf_passes']   = 0;

function sf_assert( bool $condition, string $message ): void {
	if ( $condition ) {
		++$GLOBALS['sf_passes'];
		echo "  ok   $message\n";
	} else {
		$GLOBALS['sf_failures'][] = $message;
		echo "  FAIL $message\n";
	}
}

function sf_find_node( array $graph, string $type ): ?array {
	foreach ( $graph as $node ) {
		$types = (array) ( $node['@type'] ?? [] );
		if ( in_array( $type, $types, true ) ) {
			return $node;
		}
	}
	return null;
}

function sf_find_by_id( array $graph, string $id ): ?array {
	foreach ( $graph as $node ) {
		if ( ( $node['@id'] ?? null ) === $id ) {
			return $node;
		}
	}
	return null;
}

/**
 * Yoast derives the main image from the global query (is_singular()), so emulate a real
 * singular request while fetching the graph.
 */
function sf_graph_for_post( int $post_id ): array {
	if ( Plugin::yoast_active() ) {
		$previous            = $GLOBALS['wp_query'];
		$GLOBALS['wp_query'] = new WP_Query( [ 'p' => $post_id, 'post_type' => 'any' ] );
		$GLOBALS['wp_the_query'] = $GLOBALS['wp_query'];
		try {
			$schema = YoastSEO()->meta->for_post( $post_id )->schema;
		} finally {
			$GLOBALS['wp_query']     = $previous;
			$GLOBALS['wp_the_query'] = $previous;
		}
		return $schema['@graph'] ?? [];
	}
	$json = Renderer::render_for_post( $post_id );
	return $json === '' ? [] : ( json_decode( $json, true )['@graph'] ?? [] );
}

wp_set_current_user( 1 );
GraphBuilder::reset();

$seed = $GLOBALS['sf_seed'];
$tpl  = $GLOBALS['sf_seed_templates'];
$mode = Plugin::yoast_active() ? 'yoast' : 'standalone';
echo "\n== Schema Forge smoke test ($mode) ==\n";

// ---- Product page ----
$trail = $seed['product_trail'];
$graph = sf_graph_for_post( $trail );
$link  = get_permalink( $trail );
$prod  = sf_find_node( $graph, 'Product' );
sf_assert( $prod !== null, 'Product node present on product page' );
sf_assert( ( $prod['@id'] ?? '' ) === $link . '#/schema/product/' . $tpl['product'], 'Product @id follows {canonical}#/schema/product/{templateId}' );
sf_assert( ( $prod['name'] ?? '' ) === 'Trail Runner X1', 'name resolves {{post.title}}' );
sf_assert( ( $prod['sku'] ?? '' ) === 'TR-X1', 'sku resolves {{meta.sku}}' );
sf_assert( ( $prod['description'] ?? '' ) === 'A featherweight trail shoe.', 'description resolves {{post.excerpt}}' );
sf_assert( ( $prod['category'] ?? '' ) === 'Shoes', 'category resolves first product_cat term' );
sf_assert( ( $prod['keywords'] ?? '' ) === 'Shoes', 'keywords uses join filter' );
sf_assert( ! isset( $prod['image'] ), 'image dropped when no featured image' );
sf_assert( ( $prod['brand']['name'] ?? '' ) === 'Forge Athletics', 'nested Brand node from meta' );
sf_assert( ( $prod['offers']['@type'] ?? '' ) === 'Offer' && is_numeric( $prod['offers']['price'] ?? null ) && ! is_string( $prod['offers']['price'] ) && (float) $prod['offers']['price'] === 129.0, 'nested Offer with numeric price' );
sf_assert( ( $prod['offers']['priceCurrency'] ?? '' ) === 'USD', 'priceCurrency from meta' );
sf_assert( isset( $prod['mainEntityOfPage']['@id'] ) && $prod['mainEntityOfPage']['@id'] === $link, 'mainEntityOfPage points at WebPage @id' );

$webpage = sf_find_by_id( $graph, $link );
sf_assert( $webpage !== null, 'WebPage node present' );
sf_assert( ( $webpage['mainEntity']['@id'] ?? '' ) === ( $prod['@id'] ?? 'x' ), 'WebPage.mainEntity references the Product' );

if ( $mode === 'yoast' ) {
	sf_assert( sf_find_node( $graph, 'Article' ) === null, 'Article suppressed by template setting' );
	sf_assert( in_array( 'ItemPage', (array) $webpage['@type'], true ), 'WebPage @type overridden to ItemPage' );
	$org_id = home_url( '/' ) . '#organization';
	$yctx   = YoastSEO()->meta->for_post( $trail )->context;
	echo '       yoast site_represents=' . var_export( $yctx->site_represents, true ) . ' company_name=' . var_export( $yctx->company_name ?? null, true )
		. ' opt=' . var_export( class_exists( 'WPSEO_Options' ) ? WPSEO_Options::get( 'company_or_person' ) : null, true )
		. ' raw=' . var_export( get_option( 'wpseo_titles' )['company_or_person'] ?? null, true ) . "\n";
	sf_assert( ( $prod['manufacturer']['@id'] ?? '' ) === $org_id, 'yoast:organization reference resolves' );
	sf_assert( sf_find_by_id( $graph, $org_id ) !== null, 'Yoast Organization node exists for the reference' );
	$fired = false;
	add_filter( 'wpseo_schema_schema-forge-' . $tpl['product'], static function ( $piece ) use ( &$fired ) { $fired = true; return $piece; } );
	sf_graph_for_post( $seed['product_hat'] ); // a different post: Yoast memoizes per indexable.
	sf_assert( $fired, 'wpseo_schema_{identifier} filter fires per template piece' );
} else {
	sf_assert( ( $prod['manufacturer']['@id'] ?? '' ) === home_url( '/' ) . '#organization', 'core:organization reference in standalone mode' );
	sf_assert( sf_find_node( $graph, 'Organization' ) !== null, 'standalone Organization core node present' );
	sf_assert( sf_find_node( $graph, 'WebSite' ) !== null, 'standalone WebSite core node present' );
	sf_assert( in_array( 'ItemPage', (array) $webpage['@type'], true ), 'standalone WebPage @type honours webPageType' );
	$html = Renderer::render_for_post( $trail );
	sf_assert( str_contains( $html, '"@context":"https://schema.org"' ) || str_contains( $html, '"@context": "https://schema.org"' ), 'standalone JSON has @context' );
	sf_assert( ! str_contains( $html, '</script' ), 'standalone JSON is script-safe (HEX_TAG)' );
}

// ---- Product without SKU/price: Offer dropped (dropNode), Product kept ----
$nosku_graph = sf_graph_for_post( $seed['product_nosku'] );
sf_assert( sf_find_node( $nosku_graph, 'Product' ) === null, 'disableInherited removes the post-type template' );
sf_assert( sf_find_node( $nosku_graph, 'FAQPage' ) === null, 'FAQPage dropped when repeat source (acf.faqs) is empty (dropNode)' );

// Directly compile the product template against the no-sku product to test pruning.
$ctx      = RenderContext::for_post( $seed['product_nosku'] );
$compiled = GraphBuilder::build( [ $tpl['product'] ], $ctx );
$nodes    = $compiled->nodes();
$p2       = sf_find_node( $nodes, 'Product' );
sf_assert( $p2 !== null && ! isset( $p2['sku'] ), 'empty meta.sku property is dropped' );
sf_assert( $p2 !== null && ! isset( $p2['offers'] ), 'Offer node dropped when price empty (dropNode)' );
sf_assert( $p2 !== null && ( $p2['brand']['name'] ?? '' ) === 'Forge Demo Store', 'fallback {{site.name}} used for missing brand meta' );

// ---- Hat: term exclude removes product template, per-post add restores it ----
$hat_ids = AssignmentResolver::resolve( QueryContext::for_post( $seed['product_hat'] ) );
sf_assert( $hat_ids === [ $tpl['product'] ], 'precedence: term exclude then post add (hat)' );
$trail_ids = AssignmentResolver::resolve( QueryContext::for_post( $trail ) );
sf_assert( $trail_ids === [ $tpl['product'], $tpl['collection'] ], 'precedence: post type default + term add (trail), disabled template skipped' );

// ---- Recipe via category term rule ----
$recipe_graph = sf_graph_for_post( $seed['post_recipe'] );
$recipe       = sf_find_node( $recipe_graph, 'Recipe' );
sf_assert( $recipe !== null, 'Recipe template applied through category term rule' );
sf_assert( ( $recipe['prepTime'] ?? '' ) === 'PT20M', 'Recipe prepTime from meta' );
sf_assert( ( $recipe['recipeCategory'] ?? '' ) === 'Recipes', 'single-item term list collapses to scalar' );
sf_assert( ( $recipe['image']['@id'] ?? '' ) === get_permalink( $seed['post_recipe'] ) . '#primaryimage', 'yoast:primaryimage ref resolves to the featured image node' );
$has_primary = sf_find_by_id( $recipe_graph, get_permalink( $seed['post_recipe'] ) . '#primaryimage' ) !== null;
sf_assert( $has_primary, 'primary image node exists in the graph' );
if ( ! $has_primary ) {
	$rc = YoastSEO()->meta->for_post( $seed['post_recipe'] )->context;
	echo '       yoast main_image_id=' . var_export( $rc->main_image_id, true ) . ' main_image_url=' . var_export( $rc->main_image_url, true ) . ' has_image=' . var_export( $rc->has_image, true ) . ' indexable_id=' . var_export( $rc->indexable->object_id ?? null, true ) . "\n";
	echo '       thumb=' . get_post_thumbnail_id( $seed['post_recipe'] ) . ' is_image=' . var_export( wp_attachment_is_image( get_post_thumbnail_id( $seed['post_recipe'] ) ), true ) . ' src=' . var_export( wp_get_attachment_image_src( get_post_thumbnail_id( $seed['post_recipe'] ), 'full' ), true ) . "\n";
	foreach ( $recipe_graph as $n ) { echo '       node ' . wp_json_encode( $n['@type'] ) . ' ' . ( $n['@id'] ?? '' ) . "\n"; }
}
sf_assert( preg_match( '/^\d{4}-\d{2}-\d{2}T/', (string) ( $recipe['datePublished'] ?? '' ) ) === 1, 'datetime coercion' );
if ( $mode === 'yoast' ) {
	sf_assert( str_contains( (string) ( $recipe['author']['@id'] ?? '' ), '#/schema/person/' ), 'yoast:author reference resolves to Yoast person id' );
}

sf_assert( sf_find_node( sf_graph_for_post( $seed['post_plain'] ), 'Recipe' ) === null, 'plain post gets no Recipe' );

// ---- API reference page: every schema.org term incl. hyphenated query-input and pending WebAPI ----
$api_graph = sf_graph_for_post( $seed['post_api'] );
$api       = sf_find_node( $api_graph, 'APIReference' );
sf_assert( $api !== null, 'APIReference template renders' );
sf_assert( ( $api['programmingModel'] ?? '' ) === 'REST' && ( $api['assemblyVersion'] ?? '' ) === '2.1.0' && ( $api['targetPlatform'] ?? '' ) === 'Web', 'APIReference-specific properties resolve' );
$webapi = sf_find_node( $api_graph, 'WebAPI' );
sf_assert( $webapi !== null && ( $api['about']['@id'] ?? '' ) === $webapi['@id'], 'pending WebAPI node placed in graph and referenced via about' );
sf_assert( ( $webapi['documentation'] ?? '' ) === get_permalink( $seed['post_api'] ), 'WebAPI.documentation resolves' );
sf_assert( ( $api['potentialAction']['query-input'] ?? '' ) === 'required name=search_term_string', 'hyphenated query-input property survives sanitizer and compiler' );
sf_assert( \SchemaForge\Vocab\VocabLoader::type_has_property( 'SearchAction', 'query-input' ), 'vocab lists query-input on SearchAction' );
sf_assert( \SchemaForge\Vocab\VocabLoader::has_type( 'Season' ) && \SchemaForge\Vocab\VocabLoader::is_superseded_type( 'Season' ), 'superseded terms are present and flagged' );
sf_assert( \SchemaForge\Vocab\VocabLoader::has_type( 'APIReference' ) && \SchemaForge\Vocab\VocabLoader::has_type( 'WebAPI' ), 'API types available' );
$every = true;
foreach ( \SchemaForge\Vocab\VocabLoader::core()['props'] as $prop_name => $def ) {
	if ( ! preg_match( \SchemaForge\Support\TemplateSanitizer::PROPERTY_PATTERN, $prop_name ) ) {
		$every = false;
		echo "       rejected property name: $prop_name\n";
	}
}
foreach ( \SchemaForge\Vocab\VocabLoader::core()['types'] as $type_name => $def ) {
	if ( ! preg_match( \SchemaForge\Support\TemplateSanitizer::TYPE_PATTERN, $type_name ) ) {
		$every = false;
		echo "       rejected type name: $type_name\n";
	}
}
sf_assert( $every, 'every vocabulary type and property name passes the sanitizer' );

// ---- Collection template pulls in the organization template via template: ref exactly once ----
$trail_nodes = GraphBuilder::build( $trail_ids, RenderContext::for_post( $trail ) )->nodes();
$lb          = array_values( array_filter( $trail_nodes, static fn( $n ) => in_array( 'LocalBusiness', (array) $n['@type'], true ) ) );
sf_assert( count( $lb ) === 1, 'template: reference pulls the dependency in exactly once' );
sf_assert( in_array( 'Store', (array) $lb[0]['@type'], true ), 'extraTypes produce a multi-type @type' );
$collection = sf_find_node( $trail_nodes, 'CollectionPage' );
sf_assert( ( $collection['publisher']['@id'] ?? '' ) === ( $lb[0]['@id'] ?? 'x' ), 'template: ref @id matches the dependency root @id' );
sf_assert( is_array( $lb[0]['sameAs'] ?? null ) && count( $lb[0]['sameAs'] ) === 2, 'multiple values become an array' );
$contact = sf_find_node( $trail_nodes, 'ContactPoint' );
sf_assert( $contact !== null && isset( $contact['@id'] ) && ( $lb[0]['contactPoint']['@id'] ?? '' ) === $contact['@id'], 'graph-placed nested node is referenced by @id' );
sf_assert( is_array( $lb[0]['contactPoint'] ) && isset( $lb[0]['contactPoint']['@id'] ), 'node: ref + graph placement collapse to one reference' );

// ---- Archives ----
sf_assert( AssignmentResolver::resolve( QueryContext::for_archive( 'post_type_archive', 'product' ) ) === [ $tpl['collection'] ], 'post type archive rule' );
$shoes = get_term_by( 'slug', 'shoes', 'product_cat' );
sf_assert( AssignmentResolver::resolve( QueryContext::for_archive( 'term_archive', '', (int) $shoes->term_id ) ) === [ $tpl['collection'] ], 'term archive falls back to taxonomy rule' );
sf_assert( AssignmentResolver::resolve( QueryContext::for_archive( 'search' ) ) === [], 'search has no templates' );
sf_assert( AssignmentResolver::resolve( QueryContext::for_post( $seed['page_home'] ) ) === [ $tpl['org'] ], 'static front page receives front_page archive rule' );
sf_assert( AssignmentResolver::resolve( QueryContext::for_post( $seed['page_about'] ) ) === [ $tpl['org'] ], 'per-post add on a page' );

// Real front-end query for the term archive.
$q = new WP_Query( [ 'product_cat' => 'shoes' ] );
$GLOBALS['wp_query'] = $q;
$qc = QueryContext::from_query( $q );
sf_assert( $qc->kind === 'term_archive' && $qc->term_id === (int) $shoes->term_id, 'QueryContext::from_query detects term archives' );
$archive_ctx = RenderContext::for_query( $q );
sf_assert( $archive_ctx->canonical === get_term_link( $shoes ), 'archive canonical is the term link' );
$archive_nodes = GraphBuilder::build( AssignmentResolver::resolve( $qc ), $archive_ctx )->nodes();
$cp = sf_find_node( $archive_nodes, 'CollectionPage' );
sf_assert( $cp !== null && str_starts_with( $cp['@id'], get_term_link( $shoes ) ), 'archive node @id uses the term link' );
wp_reset_query();

// ---- REST ----
$rest = static function ( string $method, string $route, ?array $body = null ) {
	$query = [];
	if ( str_contains( $route, '?' ) ) {
		[ $route, $qs ] = explode( '?', $route, 2 );
		parse_str( $qs, $query );
	}
	$request = new WP_REST_Request( $method, '/schema-forge/v1' . $route );
	$request->set_query_params( $query );
	if ( $body !== null ) {
		$request->set_header( 'Content-Type', 'application/json' );
		$request->set_body( wp_json_encode( $body ) );
	}
	return rest_do_request( $request );
};

$list = $rest( 'GET', '/templates' );
sf_assert( $list->get_status() === 200 && count( $list->get_data() ) >= 5, 'GET /templates lists templates' );
$first = $list->get_data()[0];
sf_assert( isset( $first['assignedTo'] ) && isset( $first['rootType'] ), 'template list rows carry rootType + assignedTo' );

$show = $rest( 'GET', '/templates/' . $tpl['product'] );
$tree = $show->get_data()['tree'];
$create = $rest( 'POST', '/templates', [ 'name' => 'REST copy', 'enabled' => false, 'tree' => $tree, 'settings' => $show->get_data()['settings'] ] );
sf_assert( $create->get_status() === 201, 'POST /templates creates' );
$new_id = (int) $create->get_data()['id'];
$again  = $rest( 'GET', '/templates/' . $new_id )->get_data();
sf_assert( wp_json_encode( $again['tree'] ) === wp_json_encode( $tree ), 'tree survives a round-trip byte-for-byte' );

$bad = $rest( 'POST', '/templates', [ 'name' => 'bad', 'tree' => [ 'root' => [ 'type' => 'Product', 'properties' => [ [ 'name' => 'Bad Name!', 'values' => [] ] ] ] ] ] );
sf_assert( $bad->get_status() === 400, 'invalid property name rejected with 400' );
$warn = $rest( 'POST', '/templates', [ 'name' => 'warn', 'tree' => [ 'root' => [ 'type' => 'MadeUpType', 'properties' => [ [ 'name' => 'name', 'values' => [ [ 'kind' => 'text', 'value' => 'x' ] ] ] ] ] ] ] );
sf_assert( $warn->get_status() === 201 && ! empty( $warn->get_data()['warnings'] ), 'unknown type saves with a warning' );
$rest( 'DELETE', '/templates/' . $warn->get_data()['id'] );

$preview = $rest( 'POST', '/preview', [ 'tree' => $tree, 'settings' => [], 'context' => [ 'postId' => $trail ] ] );
$pdata   = $preview->get_data();
sf_assert( $preview->get_status() === 200 && sf_find_node( $pdata['graph']['@graph'], 'Product' ) !== null, 'POST /preview compiles against a post' );
sf_assert( ( $pdata['tokens']['{{post.title}}'] ?? '' ) === 'Trail Runner X1', 'preview returns resolved token values' );

$tokens = $rest( 'GET', '/tokens?post_id=' . $trail )->get_data();
$namespaces = array_column( $tokens, 'namespace' );
sf_assert( in_array( 'post', $namespaces, true ) && in_array( 'meta', $namespaces, true ) && in_array( 'terms', $namespaces, true ), 'token catalog has post/meta/terms groups' );
$meta_group = array_values( array_filter( $tokens, static fn( $g ) => $g['namespace'] === 'meta' ) )[0];
sf_assert( in_array( '{{meta.sku}}', array_column( $meta_group['tokens'], 'token' ), true ), 'meta catalog discovers sku key' );

$resolve = $rest( 'GET', '/resolve?post_id=' . $seed['product_hat'] )->get_data();
sf_assert( ( $resolve['resolved'][0]['source'] ?? '' ) === 'post', 'GET /resolve explains the source (post override)' );

$del = $rest( 'DELETE', '/templates/' . $new_id );
sf_assert( $del->get_status() === 200 && TemplateRepository::instance()->find( $new_id ) === null, 'DELETE /templates removes the template' );

// Subscriber is refused.
$sub = wp_insert_user( [ 'user_login' => 'sf_subscriber', 'user_pass' => wp_generate_password(), 'role' => 'subscriber' ] );
wp_set_current_user( is_wp_error( $sub ) ? get_user_by( 'login', 'sf_subscriber' )->ID : $sub );
sf_assert( $rest( 'GET', '/templates' )->get_status() === 403, 'subscriber gets 403 from /templates' );
sf_assert( $rest( 'POST', '/preview', [ 'tree' => $tree, 'context' => [ 'postId' => $trail ] ] )->get_status() === 403, 'subscriber gets 403 from /preview' );
wp_set_current_user( 1 );

// ---- Front-end output of a real request ----
$html = wp_remote_retrieve_body( wp_remote_get( $link ) );
if ( $html !== '' ) {
	$ok = str_contains( str_replace( '\\/', '/', $html ), '#/schema/product/' . $tpl['product'] );
	sf_assert( $ok, 'rendered product page HTML contains the Product node' );
	if ( ! $ok ) {
		preg_match( '#<script type="application/ld\+json"[^>]*>(.*?)</script>#s', $html, $m );
		echo '       html length ' . strlen( $html ) . ', title: ' . ( preg_match( '#<title>(.*?)</title>#', $html, $t ) ? $t[1] : '?' ) . "\n";
		echo '       ld+json: ' . substr( $m[1] ?? '(none)', 0, 600 ) . "\n";
	}
} else {
	echo "  skip HTTP self-request unavailable\n";
}

$failed  = count( $GLOBALS['sf_failures'] );
$summary = "{$GLOBALS['sf_passes']} passed, $failed failed";
echo "\n$summary\n";
// run-blueprint only prints output on failure, so persist a summary for the host.
$log_dir = SCHEMA_FORGE_DIR . 'playground/.cache';
if ( wp_mkdir_p( $log_dir ) ) {
	file_put_contents( $log_dir . '/smoke-' . $mode . '.log', gmdate( 'c' ) . " $summary\n" . ( $failed ? " - " . implode( "\n - ", $GLOBALS['sf_failures'] ) . "\n" : '' ) );
}
if ( $failed ) {
	throw new RuntimeException( "Smoke test failed:\n - " . implode( "\n - ", $GLOBALS['sf_failures'] ) );
}
