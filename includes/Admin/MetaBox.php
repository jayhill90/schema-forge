<?php
/**
 * Classic-editor meta box for per-post assignments.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Admin;

use SchemaForge\Assignment\AssignmentResolver;
use SchemaForge\Assignment\PostAssignments;
use SchemaForge\Assignment\QueryContext;
use SchemaForge\Repository\TemplateRepository;

final class MetaBox {

	private const NONCE = 'schema_forge_assignments';

	public function register(): void {
		add_action( 'add_meta_boxes', [ $this, 'add' ], 10, 2 );
		add_action( 'save_post', [ $this, 'save' ], 10, 2 );
	}

	public function add( string $post_type, $post ): void {
		$object = get_post_type_object( $post_type );
		if ( ! $object || ! $object->public || $post_type === 'attachment' ) {
			return;
		}
		if ( use_block_editor_for_post_type( $post_type ) && ( ! $post || use_block_editor_for_post( $post ) ) ) {
			return; // The block editor sidebar handles it.
		}
		add_meta_box( 'schema-forge-assignments', __( 'Schema templates', 'schema-forge' ), [ $this, 'render' ], $post_type, 'side', 'default' );
	}

	public function render( \WP_Post $post ): void {
		$repo        = TemplateRepository::instance();
		$assignments = PostAssignments::get( (int) $post->ID );
		$resolved    = AssignmentResolver::resolve_with_sources( QueryContext::for_post( (int) $post->ID ) );
		$inherited   = array_values( array_filter( $resolved, static fn( array $r ) => $r['source'] !== 'post' ) );
		$available   = $repo->all( true );

		wp_nonce_field( self::NONCE, self::NONCE . '_nonce' );
		echo '<input type="hidden" name="sf_assignments_present" value="1" />';

		if ( $inherited || $assignments['disable'] ) {
			echo '<p><strong>' . esc_html__( 'Inherited from rules', 'schema-forge' ) . '</strong></p>';
			$listed = [];
			foreach ( $inherited as $entry ) {
				$template = $repo->find( $entry['id'] );
				if ( ! $template ) {
					continue;
				}
				$listed[] = $entry['id'];
				printf(
					'<label style="display:block;margin-bottom:4px"><input type="checkbox" name="sf_keep[]" value="%1$d" checked /> %2$s <span class="description">(%3$s)</span></label>',
					(int) $entry['id'],
					esc_html( $template->name ),
					esc_html( $entry['label'] )
				);
			}
			foreach ( $assignments['disable'] as $id ) {
				$template = $repo->find( $id );
				if ( ! $template || in_array( $id, $listed, true ) ) {
					continue;
				}
				printf(
					'<label style="display:block;margin-bottom:4px"><input type="checkbox" name="sf_keep[]" value="%1$d" /> %2$s <span class="description">(%3$s)</span></label>',
					(int) $id,
					esc_html( $template->name ),
					esc_html__( 'disabled here', 'schema-forge' )
				);
			}
			echo '<input type="hidden" name="sf_inherited_ids" value="' . esc_attr( implode( ',', array_merge( $listed, $assignments['disable'] ) ) ) . '" />';
		} else {
			echo '<p class="description">' . esc_html__( 'No templates are inherited from rules.', 'schema-forge' ) . '</p>';
		}

		printf(
			'<p><label><input type="checkbox" name="sf_disable_inherited" value="1" %s /> %s</label></p>',
			checked( $assignments['disableInherited'], true, false ),
			esc_html__( 'Ignore all inherited templates', 'schema-forge' )
		);

		echo '<p><strong>' . esc_html__( 'Additional templates', 'schema-forge' ) . '</strong></p>';
		if ( $available ) {
			echo '<select name="sf_add[]" multiple size="5" style="width:100%" aria-label="' . esc_attr__( 'Additional templates', 'schema-forge' ) . '">';
			foreach ( $available as $template ) {
				printf(
					'<option value="%1$d" %2$s>%3$s (%4$s)</option>',
					(int) $template->id,
					selected( in_array( $template->id, $assignments['add'], true ), true, false ),
					esc_html( $template->name ),
					esc_html( $template->root_type() )
				);
			}
			echo '</select>';
			echo '<p class="description">' . esc_html__( 'Hold Ctrl/Cmd to select several.', 'schema-forge' ) . '</p>';
		} else {
			echo '<p class="description">' . esc_html__( 'No enabled templates yet.', 'schema-forge' ) . '</p>';
		}
	}

	public function save( int $post_id, $post ): void {
		if ( empty( $_POST['sf_assignments_present'] ) ) {
			return;
		}
		if ( ! isset( $_POST[ self::NONCE . '_nonce' ] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST[ self::NONCE . '_nonce' ] ) ), self::NONCE ) ) {
			return;
		}
		if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || wp_is_post_revision( $post_id ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}

		$inherited = array_filter( array_map( 'intval', explode( ',', sanitize_text_field( wp_unslash( $_POST['sf_inherited_ids'] ?? '' ) ) ) ) );
		$keep      = array_map( 'intval', (array) ( $_POST['sf_keep'] ?? [] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		$disable   = array_values( array_diff( $inherited, $keep ) );

		PostAssignments::save(
			$post_id,
			[
				'add'              => array_map( 'intval', (array) ( $_POST['sf_add'] ?? [] ) ), // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
				'disable'          => $disable,
				'disableInherited' => ! empty( $_POST['sf_disable_inherited'] ),
			]
		);
	}
}
