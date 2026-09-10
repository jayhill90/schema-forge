<?php
/**
 * {{terms.taxonomy}} tokens.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens\Providers;

use SchemaForge\Model\RenderContext;
use SchemaForge\Tokens\ProviderInterface;

final class TermsProvider implements ProviderInterface {

	public function namespace(): string {
		return 'terms';
	}

	public function label(): string {
		return __( 'Taxonomy terms', 'schema-forge' );
	}

	/**
	 * Paths:
	 *  terms.{taxonomy}            → list of names
	 *  terms.{taxonomy}.names      → list of names
	 *  terms.{taxonomy}.slugs      → list of slugs
	 *  terms.{taxonomy}.links      → list of URLs
	 *  terms.{taxonomy}.objects    → list of rows {id,name,slug,link,description} (for repeat)
	 *  terms.{taxonomy}.first.name → first term's field
	 *  terms.current.*             → the term of the current archive page
	 */
	public function resolve( string $path, RenderContext $ctx ): mixed {
		$segments = explode( '.', $path );
		$taxonomy = array_shift( $segments );
		if ( $taxonomy === '' ) {
			return null;
		}

		if ( $taxonomy === 'current' ) {
			if ( ! $ctx->term ) {
				return null;
			}
			$row = self::row( $ctx->term );
			return $segments ? ( $row[ $segments[0] ] ?? null ) : $row['name'];
		}

		if ( ! $ctx->post || ! taxonomy_exists( $taxonomy ) ) {
			return null;
		}
		$terms = get_the_terms( $ctx->post, $taxonomy );
		if ( ! is_array( $terms ) || ! $terms ) {
			return null;
		}
		$rows = array_map( [ self::class, 'row' ], array_values( $terms ) );

		$field = $segments[0] ?? 'names';
		switch ( $field ) {
			case 'names':
				return array_column( $rows, 'name' );
			case 'slugs':
				return array_column( $rows, 'slug' );
			case 'links':
				return array_column( $rows, 'link' );
			case 'objects':
				return $rows;
			case 'count':
				return count( $rows );
			case 'first':
				return isset( $segments[1] ) ? ( $rows[0][ $segments[1] ] ?? null ) : $rows[0]['name'];
		}
		return null;
	}

	/**
	 * @return array{id:int,name:string,slug:string,link:string,description:string,taxonomy:string}
	 */
	public static function row( \WP_Term $term ): array {
		$link = get_term_link( $term );
		return [
			'id'          => (int) $term->term_id,
			'name'        => wp_specialchars_decode( $term->name, ENT_QUOTES ),
			'slug'        => $term->slug,
			'link'        => is_wp_error( $link ) ? '' : (string) $link,
			'description' => trim( wp_strip_all_tags( $term->description ) ),
			'taxonomy'    => $term->taxonomy,
		];
	}

	public function catalog( RenderContext $ctx ): array {
		$post_type = $ctx->post ? $ctx->post->post_type : $ctx->query->post_type;
		$out       = [];
		if ( $ctx->query->kind === 'term_archive' || $ctx->term ) {
			$out[] = [ 'token' => '{{terms.current.name}}', 'label' => __( 'Current term name', 'schema-forge' ), 'type' => 'text' ];
			$out[] = [ 'token' => '{{terms.current.description}}', 'label' => __( 'Current term description', 'schema-forge' ), 'type' => 'text' ];
			$out[] = [ 'token' => '{{terms.current.link}}', 'label' => __( 'Current term URL', 'schema-forge' ), 'type' => 'url' ];
		}
		if ( ! $post_type ) {
			return $out;
		}
		foreach ( get_object_taxonomies( $post_type, 'objects' ) as $tax ) {
			if ( ! $tax->public ) {
				continue;
			}
			$label = $tax->labels->name;
			$out[] = [ 'token' => "{{terms.{$tax->name}}}", 'label' => $label, 'type' => 'list', 'description' => __( 'All term names (comma separated in text).', 'schema-forge' ) ];
			$out[] = [ 'token' => "{{terms.{$tax->name}.first.name}}", 'label' => sprintf( /* translators: %s taxonomy label */ __( '%s (first term)', 'schema-forge' ), $label ), 'type' => 'text' ];
			$out[] = [ 'token' => "{{terms.{$tax->name}.objects}}", 'label' => sprintf( /* translators: %s taxonomy label */ __( '%s (rows for repeat)', 'schema-forge' ), $label ), 'type' => 'rows' ];
		}
		return $out;
	}
}
