<?php
/**
 * Outputs a JSON-LD graph in wp_head when Yoast SEO is not active.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Output\Standalone;

use SchemaForge\Model\RenderContext;
use SchemaForge\Output\GraphBuilder;
use SchemaForge\Output\GraphResult;
use SchemaForge\Support\Json;
use SchemaForge\Support\Settings;

final class Renderer {

	public function register(): void {
		add_action( 'wp_head', [ $this, 'output' ], 1 );
	}

	public function output(): void {
		if ( is_admin() || is_feed() || is_embed() || is_robots() || is_trackback() ) {
			return;
		}
		$ctx    = RenderContext::for_query();
		$result = GraphBuilder::for_context( $ctx );
		$graph  = self::graph( $result, $ctx );
		if ( ! $graph ) {
			return;
		}
		echo "\n<script type=\"application/ld+json\" class=\"schema-forge-graph\">" . Json::encode_for_script( $graph ) . "</script>\n"; // phpcs:ignore WordPress.Security.EscapeOutput -- JSON encoded with HEX_TAG.
	}

	/**
	 * Build the full JSON-LD document (core nodes + template nodes). Empty array when nothing applies.
	 */
	public static function graph( GraphResult $result, RenderContext $ctx ): array {
		$template_nodes = $result->nodes();
		if ( ! $template_nodes ) {
			return [];
		}
		$include_core = (bool) Settings::value( 'includeCoreNodes' );
		$nodes        = $include_core
			? array_merge( CoreNodes::build( $ctx, $result->main_entity_id, $result->webpage_type ), $template_nodes )
			: $template_nodes;

		/**
		 * Filter the standalone JSON-LD graph nodes.
		 *
		 * @param array[]       $nodes
		 * @param RenderContext $ctx
		 */
		$nodes = (array) apply_filters( 'schema_forge_standalone_graph', $nodes, $ctx );

		return [
			'@context' => 'https://schema.org',
			'@graph'   => array_values( $nodes ),
		];
	}

	/**
	 * Render the JSON-LD for a given post (used by smoke tests / previews).
	 */
	public static function render_for_post( int $post_id ): string {
		$ctx    = RenderContext::for_post( $post_id );
		$result = GraphBuilder::build( \SchemaForge\Assignment\AssignmentResolver::resolve( $ctx->query ), $ctx );
		$graph  = self::graph( $result, $ctx );
		return $graph ? Json::encode_for_script( $graph ) : '';
	}
}
