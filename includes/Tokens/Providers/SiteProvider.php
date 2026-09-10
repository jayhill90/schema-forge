<?php
/**
 * {{site.*}} tokens.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens\Providers;

use SchemaForge\Model\RenderContext;
use SchemaForge\Support\Images;
use SchemaForge\Tokens\ProviderInterface;

final class SiteProvider implements ProviderInterface {

	public function namespace(): string {
		return 'site';
	}

	public function label(): string {
		return __( 'Site', 'schema-forge' );
	}

	public function resolve( string $path, RenderContext $ctx ): mixed {
		switch ( $path ) {
			case 'name':
				return $ctx->site_name;
			case 'url':
				return $ctx->site_url;
			case 'description':
			case 'tagline':
				return $ctx->site_description ?: null;
			case 'language':
				return get_bloginfo( 'language' );
			case 'logo':
				return $ctx->site_logo_id ? (string) wp_get_attachment_image_url( $ctx->site_logo_id, 'full' ) : null;
			case 'logo_object':
				return $ctx->site_logo_id ? Images::object_from_attachment( $ctx->site_logo_id ) : null;
			case 'icon':
				return get_site_icon_url( 512 ) ?: null;
			case 'canonical':
			case 'current_url':
				return $ctx->canonical;
			case 'search_url':
				return home_url( '/?s={search_term_string}' );
			case 'admin_email':
				return null; // Never expose.
		}
		if ( str_starts_with( $path, 'option.' ) ) {
			$key = substr( $path, 7 );
			/**
			 * Whitelist of options readable via {{site.option.*}}.
			 *
			 * @param string[] $allowed
			 */
			$allowed = (array) apply_filters( 'schema_forge_site_option_tokens', [] );
			if ( in_array( $key, $allowed, true ) ) {
				$value = get_option( $key );
				return is_scalar( $value ) ? $value : null;
			}
		}
		return null;
	}

	public function catalog( RenderContext $ctx ): array {
		$t = static fn( string $path, string $label, string $type = 'text' ) => [
			'token' => "{{site.$path}}",
			'label' => $label,
			'type'  => $type,
		];
		return [
			$t( 'name', __( 'Site name', 'schema-forge' ) ),
			$t( 'url', __( 'Site URL', 'schema-forge' ), 'url' ),
			$t( 'description', __( 'Tagline', 'schema-forge' ) ),
			$t( 'logo', __( 'Logo URL', 'schema-forge' ), 'url' ),
			$t( 'logo_object', __( 'Logo (ImageObject)', 'schema-forge' ), 'object' ),
			$t( 'icon', __( 'Site icon URL', 'schema-forge' ), 'url' ),
			$t( 'language', __( 'Language', 'schema-forge' ) ),
			$t( 'canonical', __( 'Current page URL', 'schema-forge' ), 'url' ),
			$t( 'search_url', __( 'Search URL template', 'schema-forge' ), 'url' ),
		];
	}
}
