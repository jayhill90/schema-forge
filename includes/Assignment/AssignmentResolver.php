<?php
/**
 * Decides which templates apply to a page, in graph order.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Assignment;

use SchemaForge\Repository\TemplateRepository;

final class AssignmentResolver {

	/**
	 * @return int[] Enabled template ids, deduplicated, in output order.
	 */
	public static function resolve( QueryContext $qc ): array {
		$sources = self::resolve_with_sources( $qc );
		return array_values( array_unique( array_map( static fn( array $s ) => $s['id'], $sources ) ) );
	}

	/**
	 * Same as resolve() but each entry explains where it came from.
	 *
	 * @return array<int, array{id:int, source:string, label:string, disabled?:bool}>
	 */
	public static function resolve_with_sources( QueryContext $qc ): array {
		$rules = RulesStore::get();
		$list  = [];
		$add   = static function ( array $ids, string $source, string $label ) use ( &$list ): void {
			foreach ( $ids as $id ) {
				$list[] = [ 'id' => (int) $id, 'source' => $source, 'label' => $label ];
			}
		};
		$remove = static function ( array $ids ) use ( &$list ): void {
			$list = array_values( array_filter( $list, static fn( array $entry ) => ! in_array( $entry['id'], $ids, true ) ) );
		};

		if ( $qc->is_singular() ) {
			$post_type_obj = get_post_type_object( $qc->post_type );
			$pt_label      = $post_type_obj ? $post_type_obj->labels->singular_name : $qc->post_type;
			$add( $rules['post_types'][ $qc->post_type ] ?? [], 'post_type', sprintf( /* translators: %s post type */ __( 'Post type: %s', 'schema-forge' ), $pt_label ) );

			$excluded = [];
			foreach ( get_object_taxonomies( $qc->post_type, 'objects' ) as $taxonomy ) {
				$conf = $rules['taxonomies'][ $taxonomy->name ] ?? null;
				if ( ! $conf ) {
					continue;
				}
				$terms = get_the_terms( $qc->post_id, $taxonomy->name );
				if ( ! is_array( $terms ) || ! $terms ) {
					continue;
				}
				$add( $conf['templates'], 'taxonomy', sprintf( /* translators: %s taxonomy */ __( 'Taxonomy: %s', 'schema-forge' ), $taxonomy->labels->name ) );
				usort( $terms, static fn( \WP_Term $a, \WP_Term $b ) => $a->term_id <=> $b->term_id );
				foreach ( $terms as $term ) {
					$term_conf = $conf['terms'][ $term->term_id ] ?? null;
					if ( ! $term_conf ) {
						continue;
					}
					$add( $term_conf['add'], 'term', sprintf( /* translators: %s term */ __( 'Term: %s', 'schema-forge' ), $term->name ) );
					$excluded = array_merge( $excluded, $term_conf['exclude'] );
				}
			}
			if ( $excluded ) {
				$remove( $excluded );
			}

			if ( $qc->is_static_front ) {
				$add( $rules['archives']['front_page'], 'front_page', __( 'Front page', 'schema-forge' ) );
			}

			$post = PostAssignments::get( $qc->post_id );
			if ( $post['disableInherited'] ) {
				$list = [];
			}
			if ( $post['disable'] ) {
				$remove( $post['disable'] );
			}
			$add( $post['add'], 'post', __( 'This post', 'schema-forge' ) );
		} else {
			switch ( $qc->kind ) {
				case QueryContext::FRONT_PAGE:
					$add( $rules['archives']['front_page'], 'front_page', __( 'Front page', 'schema-forge' ) );
					$add( $rules['archives']['blog'], 'blog', __( 'Blog index', 'schema-forge' ) );
					break;
				case QueryContext::BLOG:
					$add( $rules['archives']['blog'], 'blog', __( 'Blog index', 'schema-forge' ) );
					break;
				case QueryContext::POST_TYPE_ARCHIVE:
					$add( $rules['archives']['post_type'][ $qc->post_type ] ?? [], 'post_type_archive', __( 'Post type archive', 'schema-forge' ) );
					break;
				case QueryContext::TERM_ARCHIVE:
					$add( $rules['archives']['taxonomy'][ 'term:' . $qc->term_id ] ?? [], 'term_archive', __( 'Term archive', 'schema-forge' ) );
					$add( $rules['archives']['taxonomy'][ $qc->taxonomy ] ?? [], 'taxonomy_archive', __( 'Taxonomy archive', 'schema-forge' ) );
					break;
				case QueryContext::SEARCH:
				case QueryContext::NOT_FOUND:
				case QueryContext::AUTHOR:
				case QueryContext::DATE:
					$add( $rules['archives'][ $qc->kind ] ?? [], $qc->kind, __( 'Archive', 'schema-forge' ) );
					break;
			}
		}

		// Keep first occurrence only, drop disabled / missing templates.
		$seen      = [];
		$resolved  = [];
		$templates = TemplateRepository::instance();
		foreach ( $list as $entry ) {
			if ( isset( $seen[ $entry['id'] ] ) ) {
				continue;
			}
			$template = $templates->find( $entry['id'] );
			if ( ! $template || ! $template->enabled ) {
				continue;
			}
			$seen[ $entry['id'] ] = true;
			$resolved[]           = $entry;
		}

		/**
		 * Filter the resolved template entries for a page.
		 *
		 * @param array        $resolved Entries with id/source/label.
		 * @param QueryContext $qc
		 */
		return (array) apply_filters( 'schema_forge_resolved_templates', $resolved, $qc );
	}
}
