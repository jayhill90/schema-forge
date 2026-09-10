<?php
/**
 * Merges Schema Forge templates into Yoast SEO's schema graph.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Output\Yoast;

use SchemaForge\Model\RenderContext;
use SchemaForge\Output\GraphBuilder;
use SchemaForge\Output\GraphResult;

final class Integration {

	/** Most recently built result (the page currently being generated). */
	private ?GraphResult $result = null;

	/** @var array<string, GraphResult> */
	private array $results = [];

	public function register(): void {
		add_filter( 'wpseo_schema_graph_pieces', [ $this, 'add_pieces' ], 20, 2 );
		add_filter( 'wpseo_schema_webpage', [ $this, 'filter_webpage' ], 20, 2 );
		add_filter( 'wpseo_schema_needs_article', [ $this, 'filter_needs_article' ], 20 );
		add_filter( 'wpseo_schema_webpage_type', [ $this, 'filter_webpage_type' ], 20 );
	}

	/**
	 * @param array  $pieces
	 * @param object $context Meta_Tags_Context
	 */
	public function add_pieces( $pieces, $context ): array {
		$pieces = is_array( $pieces ) ? $pieces : [];
		if ( ! is_object( $context ) || ! class_exists( '\Yoast\WP\SEO\Generators\Schema\Abstract_Schema_Piece' ) ) {
			return $pieces;
		}
		$result = $this->result_for( $context );
		foreach ( $result->template_ids as $template_id ) {
			$nodes = $result->nodes_by_template[ $template_id ] ?? [];
			if ( $nodes ) {
				$pieces[] = new TemplatePiece( $template_id, self::dedupe( $nodes, $result, $template_id ), $context );
			}
		}
		return $pieces;
	}

	/**
	 * @param array  $data    WebPage piece.
	 * @param object $context Meta_Tags_Context
	 */
	public function filter_webpage( $data, $context = null ): array {
		if ( ! is_array( $data ) ) {
			return $data;
		}
		$result = is_object( $context ) ? $this->result_for( $context ) : $this->result;
		if ( $result && $result->main_entity_id ) {
			$data['mainEntity'] = [ '@id' => $result->main_entity_id ];
		}
		return $data;
	}

	public function filter_needs_article( $is_needed ) {
		$result = $this->result ?? $this->result_for_current_page();
		return $result && $result->suppress_article ? false : $is_needed;
	}

	public function filter_webpage_type( $type ) {
		$result = $this->result ?? $this->result_for_current_page();
		if ( $result && $result->webpage_type !== '' ) {
			return $result->webpage_type;
		}
		return $type;
	}

	private function result_for( object $context ): GraphResult {
		$ctx = RenderContext::from_yoast( $context );
		$key = $ctx->query->kind . '|' . $ctx->query->post_id . '|' . $ctx->query->term_id . '|' . $ctx->canonical;
		if ( ! isset( $this->results[ $key ] ) ) {
			$this->results[ $key ] = GraphBuilder::for_context( $ctx );
		}
		$this->result = $this->results[ $key ];
		return $this->result;
	}

	private function result_for_current_page(): ?GraphResult {
		if ( is_admin() || ! did_action( 'wp' ) ) {
			return null;
		}
		return GraphBuilder::for_context( RenderContext::for_query() );
	}

	/**
	 * Drop nodes whose @id was already emitted by an earlier template.
	 */
	private static function dedupe( array $nodes, GraphResult $result, int $template_id ): array {
		$seen = [];
		foreach ( $result->template_ids as $id ) {
			if ( $id === $template_id ) {
				break;
			}
			foreach ( $result->nodes_by_template[ $id ] ?? [] as $node ) {
				if ( isset( $node['@id'] ) ) {
					$seen[ $node['@id'] ] = true;
				}
			}
		}
		return array_values( array_filter( $nodes, static fn( array $node ) => ! isset( $node['@id'] ) || ! isset( $seen[ $node['@id'] ] ) ) );
	}
}
