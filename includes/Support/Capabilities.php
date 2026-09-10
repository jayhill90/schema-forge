<?php
/**
 * Capability management.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Support;

final class Capabilities {

	public const CAP = 'manage_schema_forge';

	/**
	 * The capability required to manage schema templates.
	 */
	public static function cap(): string {
		/**
		 * Filter the capability required to manage Schema Forge.
		 *
		 * @param string $cap Capability name.
		 */
		return (string) apply_filters( 'schema_forge_capability', self::CAP );
	}

	public static function current_user_can(): bool {
		return current_user_can( self::cap() );
	}

	/**
	 * Grant the capability to administrators and Yoast SEO managers.
	 */
	public static function grant(): void {
		foreach ( self::roles() as $role_name ) {
			$role = get_role( $role_name );
			if ( $role && ! $role->has_cap( self::CAP ) ) {
				$role->add_cap( self::CAP );
			}
		}
	}

	public static function revoke(): void {
		foreach ( wp_roles()->role_objects as $role ) {
			if ( $role->has_cap( self::CAP ) ) {
				$role->remove_cap( self::CAP );
			}
		}
	}

	/**
	 * Re-grant if the plugin was updated / installed without running activation.
	 */
	public static function maybe_upgrade(): void {
		if ( get_option( 'schema_forge_version' ) !== SCHEMA_FORGE_VERSION ) {
			self::grant();
			update_option( 'schema_forge_version', SCHEMA_FORGE_VERSION );
		}
	}

	/**
	 * @return string[]
	 */
	private static function roles(): array {
		/**
		 * Filter the roles that receive the manage capability on activation.
		 *
		 * @param string[] $roles Role slugs.
		 */
		return (array) apply_filters( 'schema_forge_capability_roles', [ 'administrator', 'wpseo_manager' ] );
	}
}
