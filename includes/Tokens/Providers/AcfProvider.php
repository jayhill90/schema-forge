<?php
/**
 * {{acf.field}} tokens (Advanced Custom Fields / Secure Custom Fields).
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens\Providers;

use SchemaForge\Model\RenderContext;
use SchemaForge\Support\Images;
use SchemaForge\Tokens\ProviderInterface;

final class AcfProvider implements ProviderInterface {

	public function namespace(): string {
		return 'acf';
	}

	public function label(): string {
		return __( 'ACF fields', 'schema-forge' );
	}

	public function resolve( string $path, RenderContext $ctx ): mixed {
		if ( ! function_exists( 'get_field' ) ) {
			return null;
		}
		$segments = explode( '.', $path );
		$name     = array_shift( $segments );
		if ( $name === '' ) {
			return null;
		}

		if ( $ctx->term ) {
			$target = $ctx->term;
		} elseif ( $ctx->post ) {
			$target = $ctx->post->ID;
		} else {
			return null;
		}

		$value = get_field( $name, $target );
		$value = self::normalize( $value );
		foreach ( $segments as $segment ) {
			if ( ! is_array( $value ) || ! array_key_exists( $segment, $value ) ) {
				return null;
			}
			$value = $value[ $segment ];
		}
		return $value;
	}

	/**
	 * Convert ACF return formats into plain, schema-friendly values.
	 */
	public static function normalize( mixed $value ): mixed {
		if ( $value instanceof \WP_Post ) {
			return self::post_row( $value );
		}
		if ( $value instanceof \WP_Term ) {
			return TermsProvider::row( $value );
		}
		if ( $value instanceof \WP_User ) {
			return [
				'id'   => (int) $value->ID,
				'name' => $value->display_name,
				'url'  => get_author_posts_url( (int) $value->ID ),
			];
		}
		if ( is_array( $value ) ) {
			// ACF image array.
			if ( isset( $value['ID'], $value['url'] ) && isset( $value['mime_type'] ) && str_starts_with( (string) $value['mime_type'], 'image/' ) ) {
				return Images::object_from_attachment( (int) $value['ID'] ) ?? $value['url'];
			}
			// Attachment id? Leave scalars alone.
			$out = [];
			$i   = 0;
			foreach ( $value as $k => $v ) {
				$norm = self::normalize( $v );
				if ( is_int( $k ) && is_array( $norm ) && ! isset( $norm['@type'] ) ) {
					$norm['__index'] = ++$i;
				}
				$out[ $k ] = $norm;
			}
			return $out;
		}
		return $value;
	}

	private static function post_row( \WP_Post $post ): array {
		return [
			'id'        => (int) $post->ID,
			'name'      => wp_specialchars_decode( (string) get_the_title( $post ), ENT_QUOTES ),
			'title'     => wp_specialchars_decode( (string) get_the_title( $post ), ENT_QUOTES ),
			'url'       => (string) get_permalink( $post ),
			'permalink' => (string) get_permalink( $post ),
			'excerpt'   => PostProvider::excerpt( $post ),
			'type'      => $post->post_type,
		];
	}

	public function catalog( RenderContext $ctx ): array {
		if ( ! function_exists( 'acf_get_field_groups' ) || ! function_exists( 'acf_get_fields' ) ) {
			return [];
		}
		$post_type = $ctx->post ? $ctx->post->post_type : $ctx->query->post_type;
		$args      = $post_type ? [ 'post_type' => $post_type ] : [];
		if ( $ctx->term ) {
			$args = [ 'taxonomy' => $ctx->term->taxonomy ];
		}
		$out = [];
		foreach ( (array) acf_get_field_groups( $args ) as $group ) {
			foreach ( (array) acf_get_fields( $group ) as $field ) {
				self::catalog_field( $out, $field, 'acf.' . $field['name'], (string) ( $group['title'] ?? '' ) );
			}
		}
		return $out;
	}

	private static function catalog_field( array &$out, array $field, string $path, string $group ): void {
		$type = (string) ( $field['type'] ?? 'text' );
		$map  = [
			'image'        => 'object',
			'file'         => 'url',
			'url'          => 'url',
			'link'         => 'object',
			'number'       => 'number',
			'range'        => 'number',
			'true_false'   => 'boolean',
			'date_picker'  => 'date',
			'date_time_picker' => 'datetime',
			'repeater'     => 'rows',
			'group'        => 'object',
			'gallery'      => 'rows',
			'relationship' => 'rows',
			'post_object'  => 'object',
			'taxonomy'     => 'rows',
			'user'         => 'object',
		];
		$out[] = [
			'token'       => '{{' . $path . '}}',
			'label'       => (string) ( $field['label'] ?? $field['name'] ),
			'type'        => $map[ $type ] ?? 'text',
			'description' => $group ? sprintf( /* translators: 1: field group 2: field type */ __( '%1$s · %2$s', 'schema-forge' ), $group, $type ) : $type,
		];
		if ( in_array( $type, [ 'repeater', 'group', 'flexible_content' ], true ) && ! empty( $field['sub_fields'] ) ) {
			foreach ( (array) $field['sub_fields'] as $sub ) {
				$sub_path = $type === 'group' ? $path . '.' . $sub['name'] : 'item.' . $sub['name'];
				self::catalog_field( $out, $sub, $sub_path, $group );
			}
		}
	}
}
