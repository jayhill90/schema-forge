<?php
/**
 * {{meta.key}} tokens (post meta).
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens\Providers;

use SchemaForge\Model\RenderContext;
use SchemaForge\Tokens\ProviderInterface;

final class MetaProvider implements ProviderInterface {

	public function namespace(): string {
		return 'meta';
	}

	public function label(): string {
		return __( 'Custom fields', 'schema-forge' );
	}

	public function resolve( string $path, RenderContext $ctx ): mixed {
		$post_id = $ctx->post_id();
		if ( ! $post_id ) {
			return null;
		}
		$segments = explode( '.', $path );
		$key      = array_shift( $segments );
		if ( $key === '' ) {
			return null;
		}
		if ( ! metadata_exists( 'post', $post_id, $key ) ) {
			return null;
		}
		$value = get_post_meta( $post_id, $key, true );
		foreach ( $segments as $segment ) {
			if ( ! is_array( $value ) || ! array_key_exists( $segment, $value ) ) {
				return null;
			}
			$value = $value[ $segment ];
		}
		if ( is_object( $value ) ) {
			return null;
		}
		return $value;
	}

	public function catalog( RenderContext $ctx ): array {
		$post_type = $ctx->post ? $ctx->post->post_type : $ctx->query->post_type;
		if ( ! $post_type ) {
			return [];
		}
		$keys = self::keys_for_post_type( $post_type );
		return array_map(
			static fn( string $key ) => [
				'token' => "{{meta.$key}}",
				'label' => $key,
				'type'  => 'text',
			],
			$keys
		);
	}

	/**
	 * Distinct, non-protected meta keys used by a post type (cached).
	 *
	 * @return string[]
	 */
	public static function keys_for_post_type( string $post_type ): array {
		$cache_key = 'schema_forge_meta_keys_' . md5( $post_type );
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		global $wpdb;
		$keys = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT pm.meta_key FROM {$wpdb->postmeta} pm
				 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
				 WHERE p.post_type = %s AND pm.meta_key NOT LIKE %s
				 ORDER BY pm.meta_key ASC LIMIT 300",
				$post_type,
				$wpdb->esc_like( '_' ) . '%'
			)
		);
		$keys = array_values( array_filter( array_map( 'strval', (array) $keys ) ) );
		set_transient( $cache_key, $keys, 5 * MINUTE_IN_SECONDS );
		return $keys;
	}
}
