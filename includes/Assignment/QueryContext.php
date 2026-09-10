<?php
/**
 * Describes what kind of page is being rendered, for assignment resolution.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Assignment;

final class QueryContext {

	public const SINGULAR          = 'singular';
	public const FRONT_PAGE        = 'front_page';
	public const BLOG              = 'blog';
	public const POST_TYPE_ARCHIVE = 'post_type_archive';
	public const TERM_ARCHIVE      = 'term_archive';
	public const SEARCH            = 'search';
	public const NOT_FOUND         = 'not_found';
	public const AUTHOR            = 'author';
	public const DATE              = 'date';

	public const KINDS = [
		self::SINGULAR,
		self::FRONT_PAGE,
		self::BLOG,
		self::POST_TYPE_ARCHIVE,
		self::TERM_ARCHIVE,
		self::SEARCH,
		self::NOT_FOUND,
		self::AUTHOR,
		self::DATE,
	];

	public function __construct(
		public string $kind,
		public int $post_id = 0,
		public string $post_type = '',
		public int $term_id = 0,
		public string $taxonomy = '',
		public bool $is_static_front = false,
	) {}

	public static function for_post( int $post_id ): self {
		$post = get_post( $post_id );
		if ( ! $post ) {
			return new self( self::NOT_FOUND );
		}
		$is_front = get_option( 'show_on_front' ) === 'page' && (int) get_option( 'page_on_front' ) === $post_id;
		return new self( self::SINGULAR, $post_id, $post->post_type, 0, '', $is_front );
	}

	public static function from_query( ?\WP_Query $query = null ): self {
		$query = $query ?? $GLOBALS['wp_query'] ?? null;
		if ( ! $query instanceof \WP_Query ) {
			return new self( self::NOT_FOUND );
		}

		if ( $query->is_404() ) {
			return new self( self::NOT_FOUND );
		}
		if ( $query->is_singular() ) {
			$post = $query->get_queried_object();
			if ( $post instanceof \WP_Post ) {
				$is_front = $query->is_front_page();
				return new self( self::SINGULAR, (int) $post->ID, $post->post_type, 0, '', $is_front );
			}
		}
		if ( $query->is_front_page() ) {
			return new self( self::FRONT_PAGE );
		}
		if ( $query->is_home() ) {
			return new self( self::BLOG );
		}
		if ( $query->is_post_type_archive() ) {
			$pt = $query->get( 'post_type' );
			$pt = is_array( $pt ) ? (string) reset( $pt ) : (string) $pt;
			return new self( self::POST_TYPE_ARCHIVE, 0, $pt );
		}
		if ( $query->is_category() || $query->is_tag() || $query->is_tax() ) {
			$term = $query->get_queried_object();
			if ( $term instanceof \WP_Term ) {
				return new self( self::TERM_ARCHIVE, 0, '', (int) $term->term_id, $term->taxonomy );
			}
		}
		if ( $query->is_search() ) {
			return new self( self::SEARCH );
		}
		if ( $query->is_author() ) {
			return new self( self::AUTHOR );
		}
		if ( $query->is_date() ) {
			return new self( self::DATE );
		}
		return new self( self::NOT_FOUND );
	}

	/**
	 * Build from a preview request: { kind, postType?, termId? }.
	 */
	public static function for_archive( string $kind, string $post_type = '', int $term_id = 0 ): self {
		if ( ! in_array( $kind, self::KINDS, true ) || $kind === self::SINGULAR ) {
			return new self( self::NOT_FOUND );
		}
		$taxonomy = '';
		if ( $kind === self::TERM_ARCHIVE && $term_id ) {
			$term     = get_term( $term_id );
			$taxonomy = $term instanceof \WP_Term ? $term->taxonomy : '';
		}
		return new self( $kind, 0, $post_type, $term_id, $taxonomy );
	}

	public function is_singular(): bool {
		return $this->kind === self::SINGULAR;
	}
}
