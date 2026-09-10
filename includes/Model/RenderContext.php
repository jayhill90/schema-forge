<?php
/**
 * Everything a compile needs to know about the page being rendered.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Model;

use SchemaForge\Assignment\QueryContext;
use SchemaForge\Plugin;

final class RenderContext {

	public ?\WP_Post $post = null;

	public string $canonical = '';

	public string $site_name = '';

	public string $site_url = '';

	public string $site_description = '';

	public int $site_logo_id = 0;

	public int $main_image_id = 0;

	public ?\WP_Term $term = null;

	/** Yoast Meta_Tags_Context when available. */
	public ?object $yoast = null;

	/** Current repeat scope (row) for {{item.*}} tokens. */
	public mixed $scope = null;

	/** Id of the template currently being compiled. */
	public int $template_id = 0;

	public QueryContext $query;

	private function __construct( QueryContext $query ) {
		$this->query            = $query;
		$this->site_name        = wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES );
		$this->site_description = wp_specialchars_decode( (string) get_bloginfo( 'description' ), ENT_QUOTES );
		$this->site_url         = home_url( '/' );
		$this->site_logo_id     = (int) get_theme_mod( 'custom_logo' );
	}

	public static function for_post( int $post_id ): self {
		$ctx  = new self( QueryContext::for_post( $post_id ) );
		$post = get_post( $post_id );
		if ( $post instanceof \WP_Post ) {
			$ctx->post          = $post;
			$ctx->canonical     = (string) get_permalink( $post );
			$ctx->main_image_id = (int) get_post_thumbnail_id( $post );
		}
		$ctx->attach_yoast_for_post( $post_id );
		return $ctx;
	}

	public static function for_query( ?\WP_Query $query = null ): self {
		$query = $query ?? $GLOBALS['wp_query'] ?? null;
		$qc    = QueryContext::from_query( $query );
		if ( $qc->is_singular() ) {
			return self::for_post( $qc->post_id );
		}
		$ctx = new self( $qc );
		$ctx->canonical = self::current_url( $qc );
		if ( $qc->term_id ) {
			$term = get_term( $qc->term_id );
			if ( $term instanceof \WP_Term ) {
				$ctx->term      = $term;
				$ctx->canonical = (string) get_term_link( $term );
			}
		} elseif ( $qc->kind === QueryContext::POST_TYPE_ARCHIVE && $qc->post_type ) {
			$link = get_post_type_archive_link( $qc->post_type );
			if ( $link ) {
				$ctx->canonical = $link;
			}
		}
		return $ctx;
	}

	public static function for_archive( string $kind, string $post_type = '', int $term_id = 0 ): self {
		$qc  = QueryContext::for_archive( $kind, $post_type, $term_id );
		$ctx = new self( $qc );
		$ctx->canonical = $ctx->site_url;
		if ( $qc->term_id ) {
			$term = get_term( $qc->term_id );
			if ( $term instanceof \WP_Term ) {
				$ctx->term      = $term;
				$ctx->canonical = (string) get_term_link( $term );
			}
		} elseif ( $qc->kind === QueryContext::POST_TYPE_ARCHIVE && $qc->post_type ) {
			$ctx->canonical = (string) ( get_post_type_archive_link( $qc->post_type ) ?: $ctx->site_url );
		} elseif ( $qc->kind === QueryContext::BLOG ) {
			$page_for_posts = (int) get_option( 'page_for_posts' );
			$ctx->canonical = $page_for_posts ? (string) get_permalink( $page_for_posts ) : $ctx->site_url;
		}
		return $ctx;
	}

	/**
	 * Build from Yoast's Meta_Tags_Context (inside the schema pipeline).
	 */
	public static function from_yoast( object $yoast_context ): self {
		$post = $yoast_context->post ?? null;
		if ( $post instanceof \WP_Post ) {
			$ctx = new self( QueryContext::for_post( (int) $post->ID ) );
			$ctx->post          = $post;
			$ctx->main_image_id = (int) get_post_thumbnail_id( $post );
		} else {
			$ctx = new self( QueryContext::from_query() );
			if ( $ctx->query->term_id ) {
				$term = get_term( $ctx->query->term_id );
				if ( $term instanceof \WP_Term ) {
					$ctx->term = $term;
				}
			}
		}
		$ctx->canonical = (string) ( $yoast_context->canonical ?? '' );
		if ( $ctx->canonical === '' ) {
			$ctx->canonical = $ctx->post ? (string) get_permalink( $ctx->post ) : self::current_url( $ctx->query );
		}
		if ( ! empty( $yoast_context->main_image_id ) ) {
			$ctx->main_image_id = (int) $yoast_context->main_image_id;
		}
		$ctx->yoast = $yoast_context;
		return $ctx;
	}

	private function attach_yoast_for_post( int $post_id ): void {
		if ( ! Plugin::yoast_active() || ! function_exists( 'YoastSEO' ) ) {
			return;
		}
		try {
			$meta = YoastSEO()->meta->for_post( $post_id );
			if ( $meta && isset( $meta->context ) ) {
				$this->yoast = $meta->context;
				if ( ! empty( $this->yoast->canonical ) ) {
					$this->canonical = (string) $this->yoast->canonical;
				}
			}
		} catch ( \Throwable $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement
			// Yoast context unavailable; fall back to core data.
		}
	}

	private static function current_url( QueryContext $qc ): string {
		if ( $qc->kind === QueryContext::FRONT_PAGE || $qc->kind === QueryContext::NOT_FOUND ) {
			return home_url( '/' );
		}
		if ( $qc->kind === QueryContext::BLOG ) {
			$page_for_posts = (int) get_option( 'page_for_posts' );
			return $page_for_posts ? (string) get_permalink( $page_for_posts ) : home_url( '/' );
		}
		$request = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( (string) $_SERVER['REQUEST_URI'] ) : '/'; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		return home_url( strtok( $request, '?' ) ?: '/' );
	}

	public function with_scope( mixed $scope ): self {
		$clone        = clone $this;
		$clone->scope = $scope;
		return $clone;
	}

	public function for_template( int $template_id ): self {
		$clone              = clone $this;
		$clone->template_id = $template_id;
		return $clone;
	}

	public function post_id(): int {
		return $this->post ? (int) $this->post->ID : 0;
	}

	/**
	 * @id of the WebPage node for this page.
	 */
	public function webpage_id(): string {
		if ( $this->yoast && ! empty( $this->yoast->main_schema_id ) ) {
			return (string) $this->yoast->main_schema_id;
		}
		return $this->canonical;
	}

	public function website_id(): string {
		return $this->site_url . '#website';
	}

	public function has_image(): bool {
		if ( $this->yoast ) {
			return \SchemaForge\Output\Yoast\YoastReferences::has_primary_image( $this->yoast, $this );
		}
		return $this->main_image_id > 0;
	}
}
