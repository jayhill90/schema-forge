<?php
/**
 * Generates @id values for graph nodes.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Compiler;

use SchemaForge\Model\RenderContext;

final class IdGenerator {

	public static function root( RenderContext $ctx, string $type, int $template_id ): string {
		return self::base( $ctx ) . '#/schema/' . self::slug( $type ) . '/' . $template_id;
	}

	public static function nested( RenderContext $ctx, string $type, int $template_id, string $node_id ): string {
		return self::base( $ctx ) . '#/schema/' . self::slug( $type ) . '/' . $template_id . '/' . rawurlencode( $node_id );
	}

	public static function override( RenderContext $ctx, string $resolved ): string {
		$resolved = trim( $resolved );
		if ( preg_match( '#^https?://#i', $resolved ) ) {
			return esc_url_raw( $resolved );
		}
		if ( str_starts_with( $resolved, '#' ) ) {
			return self::base( $ctx ) . $resolved;
		}
		return self::base( $ctx ) . '#' . ltrim( $resolved, '/' );
	}

	private static function base( RenderContext $ctx ): string {
		$canonical = $ctx->canonical !== '' ? $ctx->canonical : $ctx->site_url;
		return strtok( $canonical, '#' ) ?: $canonical;
	}

	private static function slug( string $type ): string {
		return strtolower( preg_replace( '/[^A-Za-z0-9]+/', '-', $type ) ?? $type );
	}
}
