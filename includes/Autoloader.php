<?php
/**
 * PSR-4 style autoloader for the SchemaForge namespace.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge;

final class Autoloader {

	private const PREFIX = 'SchemaForge\\';

	public static function register(): void {
		spl_autoload_register( [ self::class, 'load' ] );
	}

	public static function load( string $class ): void {
		if ( strncmp( $class, self::PREFIX, strlen( self::PREFIX ) ) !== 0 ) {
			return;
		}

		$relative = substr( $class, strlen( self::PREFIX ) );
		$file     = SCHEMA_FORGE_DIR . 'includes/' . str_replace( '\\', '/', $relative ) . '.php';

		if ( is_readable( $file ) ) {
			require_once $file;
		}
	}
}
