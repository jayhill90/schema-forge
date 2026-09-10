<?php
/**
 * Plugin-wide settings (option: schema_forge_settings).
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Support;

final class Settings {

	public const OPTION = 'schema_forge_settings';

	public static function defaults(): array {
		return [
			'siteRepresents'   => 'organization', // organization | person | none
			'organizationName' => '',
			'organizationLogo' => 0,
			'personUserId'     => 0,
			'includeCoreNodes' => true,
			'prettyPrint'      => false,
		];
	}

	public static function get(): array {
		$stored = get_option( self::OPTION, [] );
		return array_merge( self::defaults(), is_array( $stored ) ? $stored : [] );
	}

	public static function value( string $key ): mixed {
		return self::get()[ $key ] ?? null;
	}

	public static function update( array $input ): array {
		$current = self::get();
		$clean   = $current;
		if ( isset( $input['siteRepresents'] ) && in_array( $input['siteRepresents'], [ 'organization', 'person', 'none' ], true ) ) {
			$clean['siteRepresents'] = $input['siteRepresents'];
		}
		if ( array_key_exists( 'organizationName', $input ) ) {
			$clean['organizationName'] = sanitize_text_field( (string) $input['organizationName'] );
		}
		if ( array_key_exists( 'organizationLogo', $input ) ) {
			$clean['organizationLogo'] = max( 0, (int) $input['organizationLogo'] );
		}
		if ( array_key_exists( 'personUserId', $input ) ) {
			$clean['personUserId'] = max( 0, (int) $input['personUserId'] );
		}
		if ( array_key_exists( 'includeCoreNodes', $input ) ) {
			$clean['includeCoreNodes'] = (bool) $input['includeCoreNodes'];
		}
		if ( array_key_exists( 'prettyPrint', $input ) ) {
			$clean['prettyPrint'] = (bool) $input['prettyPrint'];
		}
		update_option( self::OPTION, $clean, false );
		return $clean;
	}
}
