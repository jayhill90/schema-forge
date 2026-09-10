<?php
/**
 * Assignment rules (option: schema_forge_rules).
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Assignment;

final class RulesStore {

	public const OPTION = 'schema_forge_rules';

	public const ARCHIVE_KEYS = [ 'front_page', 'blog', 'search', 'not_found', 'author', 'date' ];

	public static function defaults(): array {
		return [
			'version'    => 1,
			'post_types' => [],
			'taxonomies' => [],
			'archives'   => [
				'front_page' => [],
				'blog'       => [],
				'search'     => [],
				'not_found'  => [],
				'author'     => [],
				'date'       => [],
				'post_type'  => [],
				'taxonomy'   => [],
			],
		];
	}

	public static function get(): array {
		$stored = get_option( self::OPTION, [] );
		return self::sanitize( is_array( $stored ) ? $stored : [] );
	}

	public static function update( array $rules ): array {
		$clean = self::sanitize( $rules );
		update_option( self::OPTION, $clean, false );
		return $clean;
	}

	/**
	 * Remove a template id from every rule (on delete).
	 */
	public static function forget_template( int $template_id ): void {
		$rules = self::get();
		$strip = static function ( array $ids ) use ( $template_id ): array {
			return array_values( array_filter( $ids, static fn( $id ) => (int) $id !== $template_id ) );
		};
		foreach ( $rules['post_types'] as $pt => $ids ) {
			$rules['post_types'][ $pt ] = $strip( $ids );
		}
		foreach ( $rules['taxonomies'] as $tax => $conf ) {
			$rules['taxonomies'][ $tax ]['templates'] = $strip( $conf['templates'] );
			foreach ( $conf['terms'] as $term_id => $term_conf ) {
				$rules['taxonomies'][ $tax ]['terms'][ $term_id ] = [
					'add'     => $strip( $term_conf['add'] ),
					'exclude' => $strip( $term_conf['exclude'] ),
				];
			}
		}
		foreach ( self::ARCHIVE_KEYS as $key ) {
			$rules['archives'][ $key ] = $strip( $rules['archives'][ $key ] );
		}
		foreach ( $rules['archives']['post_type'] as $pt => $ids ) {
			$rules['archives']['post_type'][ $pt ] = $strip( $ids );
		}
		foreach ( $rules['archives']['taxonomy'] as $key => $ids ) {
			$rules['archives']['taxonomy'][ $key ] = $strip( $ids );
		}
		update_option( self::OPTION, $rules, false );
	}

	public static function sanitize( array $rules ): array {
		$out = self::defaults();

		foreach ( (array) ( $rules['post_types'] ?? [] ) as $post_type => $ids ) {
			$post_type = sanitize_key( (string) $post_type );
			if ( $post_type !== '' ) {
				$out['post_types'][ $post_type ] = self::ids( $ids );
			}
		}

		foreach ( (array) ( $rules['taxonomies'] ?? [] ) as $taxonomy => $conf ) {
			$taxonomy = sanitize_key( (string) $taxonomy );
			if ( $taxonomy === '' || ! is_array( $conf ) ) {
				continue;
			}
			$terms = [];
			foreach ( (array) ( $conf['terms'] ?? [] ) as $term_id => $term_conf ) {
				$term_id = (int) $term_id;
				if ( $term_id <= 0 || ! is_array( $term_conf ) ) {
					continue;
				}
				$terms[ $term_id ] = [
					'add'     => self::ids( $term_conf['add'] ?? [] ),
					'exclude' => self::ids( $term_conf['exclude'] ?? [] ),
				];
			}
			$out['taxonomies'][ $taxonomy ] = [
				'templates' => self::ids( $conf['templates'] ?? [] ),
				'terms'     => $terms,
			];
		}

		$archives = (array) ( $rules['archives'] ?? [] );
		foreach ( self::ARCHIVE_KEYS as $key ) {
			$out['archives'][ $key ] = self::ids( $archives[ $key ] ?? [] );
		}
		foreach ( (array) ( $archives['post_type'] ?? [] ) as $post_type => $ids ) {
			$post_type = sanitize_key( (string) $post_type );
			if ( $post_type !== '' ) {
				$out['archives']['post_type'][ $post_type ] = self::ids( $ids );
			}
		}
		foreach ( (array) ( $archives['taxonomy'] ?? [] ) as $key => $ids ) {
			$key = (string) $key;
			if ( preg_match( '/^term:\d+$/', $key ) || preg_match( '/^[a-z0-9_-]+$/', $key ) ) {
				$out['archives']['taxonomy'][ $key ] = self::ids( $ids );
			}
		}

		return $out;
	}

	/**
	 * @return int[]
	 */
	private static function ids( mixed $ids ): array {
		if ( ! is_array( $ids ) ) {
			return [];
		}
		$clean = [];
		foreach ( $ids as $id ) {
			$id = (int) $id;
			if ( $id > 0 && ! in_array( $id, $clean, true ) ) {
				$clean[] = $id;
			}
		}
		return $clean;
	}
}
