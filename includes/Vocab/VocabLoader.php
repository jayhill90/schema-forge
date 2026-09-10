<?php
/**
 * Reads the compiled schema.org vocabulary for server-side validation.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Vocab;

final class VocabLoader {

	private static ?array $core = null;

	private static ?array $meta = null;

	/** @var array<string, string[]> */
	private static array $inherited = [];

	public static function meta(): array {
		if ( self::$meta === null ) {
			self::$meta = self::read( 'schemaorg.meta.json' );
		}
		return self::$meta;
	}

	public static function core(): array {
		if ( self::$core === null ) {
			self::$core = self::read( 'schemaorg.core.json' );
		}
		return self::$core;
	}

	public static function available(): bool {
		return isset( self::core()['types'] );
	}

	public static function has_type( string $type ): bool {
		return isset( self::core()['types'][ $type ] );
	}

	public static function has_property( string $property ): bool {
		return isset( self::core()['props'][ $property ] );
	}

	public static function is_superseded_type( string $type ): bool {
		return ! empty( self::core()['types'][ $type ]['x'] );
	}

	public static function is_superseded_property( string $property ): bool {
		return ! empty( self::core()['props'][ $property ]['x'] );
	}

	/**
	 * @param string $table 'types' or 'props'.
	 * @return string[]
	 */
	public static function superseded_by( string $name, string $table ): array {
		return self::core()[ $table ][ $name ]['sb'] ?? [];
	}

	public static function is_datatype( string $type ): bool {
		return in_array( $type, self::core()['datatypes'] ?? [], true );
	}

	public static function is_enumeration( string $type ): bool {
		return ! empty( self::core()['types'][ $type ]['e'] );
	}

	/**
	 * @return string[]
	 */
	public static function enum_members( string $type ): array {
		return self::core()['enums'][ $type ] ?? [];
	}

	/**
	 * @return string[]
	 */
	public static function range_of( string $property ): array {
		return self::core()['props'][ $property ]['r'] ?? [];
	}

	/**
	 * @return string[]
	 */
	public static function ancestors( string $type ): array {
		$out  = [];
		$seen = [];
		$walk = function ( string $name ) use ( &$walk, &$out, &$seen ): void {
			foreach ( self::core()['types'][ $name ]['s'] ?? [] as $parent ) {
				if ( ! isset( $seen[ $parent ] ) ) {
					$seen[ $parent ] = true;
					$out[]           = $parent;
					$walk( $parent );
				}
			}
		};
		$walk( $type );
		return $out;
	}

	public static function is_subtype_of( string $child, string $parent ): bool {
		return $child === $parent || in_array( $parent, self::ancestors( $child ), true );
	}

	/**
	 * Direct + inherited properties.
	 *
	 * @return string[]
	 */
	public static function properties_for( string $type ): array {
		if ( isset( self::$inherited[ $type ] ) ) {
			return self::$inherited[ $type ];
		}
		$props = self::core()['types'][ $type ]['p'] ?? [];
		foreach ( self::ancestors( $type ) as $ancestor ) {
			$props = array_merge( $props, self::core()['types'][ $ancestor ]['p'] ?? [] );
		}
		$props = array_values( array_unique( $props ) );
		sort( $props );
		self::$inherited[ $type ] = $props;
		return $props;
	}

	public static function type_has_property( string $type, string $property ): bool {
		return in_array( $property, self::properties_for( $type ), true );
	}

	private static function read( string $file ): array {
		$path = SCHEMA_FORGE_DIR . 'assets/vocab/' . $file;
		if ( ! is_readable( $path ) ) {
			return [];
		}
		$data = json_decode( (string) file_get_contents( $path ), true );
		return is_array( $data ) ? $data : [];
	}
}
