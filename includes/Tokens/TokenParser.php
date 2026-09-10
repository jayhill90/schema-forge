<?php
/**
 * Parses {{namespace.path|filter:arg}} tokens. Regex is mirrored in src/shared/tokens/parse.js.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens;

final class TokenParser {

	public const PATTERN = '/\{\{\s*([a-z][a-z0-9_]*)\.([^\s|}]+)\s*(?:\|\s*([^}]*?))?\s*\}\}/i';

	/**
	 * @return array<int, array{match:string, namespace:string, path:string, filters:array<int, array{name:string, arg:?string}>}>
	 */
	public static function parse( string $text ): array {
		if ( strpos( $text, '{{' ) === false ) {
			return [];
		}
		preg_match_all( self::PATTERN, $text, $matches, PREG_SET_ORDER );
		$tokens = [];
		foreach ( $matches as $m ) {
			$tokens[] = [
				'match'     => $m[0],
				'namespace' => strtolower( $m[1] ),
				'path'      => $m[2],
				'filters'   => self::parse_filters( $m[3] ?? '' ),
			];
		}
		return $tokens;
	}

	public static function has_tokens( string $text ): bool {
		return strpos( $text, '{{' ) !== false && preg_match( self::PATTERN, $text ) === 1;
	}

	/**
	 * True when the text is exactly one token (optionally surrounded by whitespace).
	 */
	public static function is_single_token( string $text ): bool {
		return preg_match( '/^\s*' . substr( self::PATTERN, 1, -2 ) . '\s*$/i', $text ) === 1;
	}

	/**
	 * @return array<int, array{name:string, arg:?string}>
	 */
	private static function parse_filters( string $raw ): array {
		$raw = trim( $raw );
		if ( $raw === '' ) {
			return [];
		}
		$filters = [];
		foreach ( preg_split( '/\|(?=(?:[^"]*"[^"]*")*[^"]*$)/', $raw ) as $piece ) {
			$piece = trim( $piece );
			if ( $piece === '' ) {
				continue;
			}
			$name = $piece;
			$arg  = null;
			if ( str_contains( $piece, ':' ) ) {
				[ $name, $arg ] = explode( ':', $piece, 2 );
				$arg            = trim( $arg );
				if ( strlen( $arg ) >= 2 && $arg[0] === '"' && substr( $arg, -1 ) === '"' ) {
					$arg = substr( $arg, 1, -1 );
				}
			}
			$filters[] = [
				'name' => strtolower( trim( $name ) ),
				'arg'  => $arg,
			];
		}
		return $filters;
	}
}
