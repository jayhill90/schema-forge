<?php
/**
 * Uninstall: remove templates, options, post meta and capabilities.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

// Templates.
$template_ids = get_posts(
	[
		'post_type'      => 'sf_schema_template',
		'post_status'    => 'any',
		'numberposts'    => -1,
		'fields'         => 'ids',
	]
);
foreach ( $template_ids as $template_id ) {
	wp_delete_post( (int) $template_id, true );
}

// Options and transients.
delete_option( 'schema_forge_rules' );
delete_option( 'schema_forge_settings' );
delete_option( 'schema_forge_version' );
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '\_transient\_schema\_forge\_%' OR option_name LIKE '\_transient\_timeout\_schema\_forge\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

// Post meta.
delete_post_meta_by_key( '_sf_assignments' );

// Capabilities.
foreach ( wp_roles()->role_objects as $role ) {
	if ( $role->has_cap( 'manage_schema_forge' ) ) {
		$role->remove_cap( 'manage_schema_forge' );
	}
}
