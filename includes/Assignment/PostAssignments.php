<?php
/**
 * Per-post template assignments (meta: _sf_assignments).
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Assignment;

final class PostAssignments {

	public const META = '_sf_assignments';

	public static function defaults(): array {
		return [
			'add'             => [],
			'disable'         => [],
			'disableInherited' => false,
		];
	}

	public static function get( int $post_id ): array {
		$raw = get_post_meta( $post_id, self::META, true );
		if ( is_string( $raw ) && $raw !== '' ) {
			$raw = json_decode( $raw, true );
		}
		return self::sanitize( is_array( $raw ) ? $raw : [] );
	}

	public static function save( int $post_id, array $data ): array {
		$clean = self::sanitize( $data );
		if ( $clean === self::defaults() ) {
			delete_post_meta( $post_id, self::META );
		} else {
			update_post_meta( $post_id, self::META, wp_slash( wp_json_encode( $clean ) ) );
		}
		return $clean;
	}

	public static function sanitize( array $data ): array {
		$ids = static function ( mixed $list ): array {
			$out = [];
			foreach ( is_array( $list ) ? $list : [] as $id ) {
				$id = (int) $id;
				if ( $id > 0 && ! in_array( $id, $out, true ) ) {
					$out[] = $id;
				}
			}
			return $out;
		};
		return [
			'add'              => $ids( $data['add'] ?? [] ),
			'disable'          => $ids( $data['disable'] ?? [] ),
			'disableInherited' => ! empty( $data['disableInherited'] ),
		];
	}
}
