<?php
/**
 * JSON helpers.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Support;

final class Json {

	public static function encode( mixed $data, bool $pretty = false ): string {
		$flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
		if ( $pretty ) {
			$flags |= JSON_PRETTY_PRINT;
		}
		return (string) wp_json_encode( $data, $flags );
	}

	/**
	 * Encode for inline <script> output (escapes tags/ampersands).
	 */
	public static function encode_for_script( mixed $data ): string {
		$flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP;
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			$flags |= JSON_PRETTY_PRINT;
		}
		return (string) wp_json_encode( $data, $flags );
	}

	public static function decode( string $json ): mixed {
		if ( $json === '' ) {
			return null;
		}
		$data = json_decode( $json, true );
		return json_last_error() === JSON_ERROR_NONE ? $data : null;
	}
}
