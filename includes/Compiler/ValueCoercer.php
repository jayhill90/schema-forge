<?php
/**
 * Coerces resolved values to a declared data type.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Compiler;

final class ValueCoercer {

	public const TYPES = [ 'auto', 'text', 'url', 'number', 'integer', 'boolean', 'date', 'datetime', 'json' ];

	public static function coerce( mixed $value, string $type ): mixed {
		if ( $value === null ) {
			return null;
		}
		if ( is_array( $value ) ) {
			if ( isset( $value['@type'] ) || $type === 'auto' || $type === 'json' ) {
				return $value;
			}
			return array_values( array_filter( array_map( static fn( $v ) => self::coerce( $v, $type ), $value ), static fn( $v ) => $v !== null ) );
		}

		switch ( $type ) {
			case 'text':
				return (string) $value;
			case 'url':
				$url = esc_url_raw( trim( (string) $value ) );
				return $url === '' ? null : $url;
			case 'number':
				$n = self::numeric( $value );
				return $n === null ? null : ( floor( $n ) === $n && ! str_contains( (string) $value, '.' ) ? (int) $n : $n );
			case 'integer':
				$n = self::numeric( $value );
				return $n === null ? null : (int) round( $n );
			case 'boolean':
				if ( is_bool( $value ) ) {
					return $value;
				}
				$s = strtolower( trim( (string) $value ) );
				if ( in_array( $s, [ '1', 'true', 'yes', 'on' ], true ) ) {
					return true;
				}
				if ( in_array( $s, [ '0', 'false', 'no', 'off', '' ], true ) ) {
					return false;
				}
				return (bool) $value;
			case 'date':
				$ts = self::timestamp( $value );
				return $ts === null ? null : wp_date( 'Y-m-d', $ts );
			case 'datetime':
				$ts = self::timestamp( $value );
				return $ts === null ? null : wp_date( 'c', $ts );
			case 'json':
				if ( is_string( $value ) ) {
					$decoded = json_decode( $value, true );
					return json_last_error() === JSON_ERROR_NONE ? $decoded : $value;
				}
				return $value;
			case 'auto':
			default:
				if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
					return $value;
				}
				return (string) $value;
		}
	}

	private static function numeric( mixed $value ): ?float {
		if ( is_int( $value ) || is_float( $value ) ) {
			return (float) $value;
		}
		$s = trim( (string) $value );
		$s = preg_replace( '/[^\d.,\-]/', '', $s ) ?? $s;
		if ( substr_count( $s, ',' ) && ! substr_count( $s, '.' ) ) {
			$s = str_replace( ',', '.', $s );
		} else {
			$s = str_replace( ',', '', $s );
		}
		return is_numeric( $s ) ? (float) $s : null;
	}

	private static function timestamp( mixed $value ): ?int {
		if ( is_int( $value ) ) {
			return $value;
		}
		$s = trim( (string) $value );
		if ( $s === '' ) {
			return null;
		}
		if ( preg_match( '/^\d{8}$/', $s ) ) { // ACF Ymd.
			$s = substr( $s, 0, 4 ) . '-' . substr( $s, 4, 2 ) . '-' . substr( $s, 6, 2 );
		}
		$ts = strtotime( $s );
		return $ts === false ? null : $ts;
	}
}
