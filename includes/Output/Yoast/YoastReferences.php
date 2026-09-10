<?php
/**
 * @id references into Yoast SEO's schema graph.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Output\Yoast;

use SchemaForge\Model\RenderContext;

final class YoastReferences {

	public static function id( string $entity, RenderContext $ctx ): ?string {
		$yoast = $ctx->yoast;
		if ( ! $yoast ) {
			return null;
		}
		$site_url  = rtrim( (string) ( $yoast->site_url ?? $ctx->site_url ), '/' ) . '/';
		$canonical = (string) ( $yoast->canonical ?? $ctx->canonical );
		$represents = (string) ( $yoast->site_represents ?? '' );

		switch ( $entity ) {
			case 'webpage':
				return (string) ( $yoast->main_schema_id ?? $canonical );
			case 'website':
				return $site_url . '#website';
			case 'organization':
				return $represents === 'company' ? $site_url . '#organization' : null;
			case 'person':
				return $represents === 'person' ? self::person_id( $yoast, (int) ( $yoast->site_user_id ?? 0 ) ) : null;
			case 'publisher':
				if ( $represents === 'company' ) {
					return $site_url . '#organization';
				}
				if ( $represents === 'person' ) {
					return self::person_id( $yoast, (int) ( $yoast->site_user_id ?? 0 ) );
				}
				return null;
			case 'primaryimage':
				return self::has_primary_image( $yoast, $ctx ) ? $canonical . '#primaryimage' : null;
			case 'breadcrumb':
				return $canonical . '#breadcrumb';
			case 'article':
				return ! empty( $yoast->has_article ) ? $canonical . '#article' : null;
			case 'author':
				$post = $yoast->post ?? null;
				return $post instanceof \WP_Post && $post->post_author ? self::person_id( $yoast, (int) $post->post_author ) : null;
		}
		return null;
	}

	/**
	 * Yoast only flips $context->has_image while generating its Main_Image piece,
	 * which runs after our pieces are collected, so mirror its detection here.
	 */
	public static function has_primary_image( object $yoast, RenderContext $ctx ): bool {
		if ( ! empty( $yoast->has_image ) ) {
			return true;
		}
		$post = $yoast->post ?? $ctx->post;
		if ( ! $post instanceof \WP_Post ) {
			return false;
		}
		if ( get_post_thumbnail_id( $post ) ) {
			return true;
		}
		try {
			if ( function_exists( 'YoastSEO' ) ) {
				$image_helper = YoastSEO()->helpers->image ?? null;
				if ( $image_helper && method_exists( $image_helper, 'get_post_content_image' ) ) {
					return (string) $image_helper->get_post_content_image( (int) $post->ID ) !== '';
				}
			}
		} catch ( \Throwable $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement
			// Fall through.
		}
		return false;
	}

	private static function person_id( object $yoast, int $user_id ): ?string {
		if ( $user_id <= 0 ) {
			return null;
		}
		try {
			if ( function_exists( 'YoastSEO' ) ) {
				$helper = YoastSEO()->helpers->schema->id ?? null;
				if ( $helper && method_exists( $helper, 'get_user_schema_id' ) ) {
					return (string) $helper->get_user_schema_id( $user_id, $yoast );
				}
			}
		} catch ( \Throwable $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement
			// Fall through to the documented format.
		}
		$site_url = rtrim( (string) ( $yoast->site_url ?? home_url( '/' ) ), '/' ) . '/';
		return $site_url . '#/schema/person/' . wp_hash( (string) $user_id );
	}
}
