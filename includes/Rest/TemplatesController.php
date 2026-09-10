<?php
/**
 * /templates CRUD.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Rest;

use SchemaForge\Assignment\RulesStore;
use SchemaForge\Model\Template;
use SchemaForge\Repository\TemplateRepository;
use SchemaForge\Support\TemplateSanitizer;

final class TemplatesController extends AbstractController {

	public function register_routes(): void {
		$this->register( '/templates', \WP_REST_Server::READABLE, [ $this, 'index' ] );
		$this->register( '/templates', \WP_REST_Server::CREATABLE, [ $this, 'create' ] );
		$this->register( '/templates/(?P<id>\d+)', \WP_REST_Server::READABLE, [ $this, 'show' ] );
		$this->register( '/templates/(?P<id>\d+)', 'PUT, PATCH', [ $this, 'update' ] );
		$this->register( '/templates/(?P<id>\d+)', \WP_REST_Server::DELETABLE, [ $this, 'destroy' ] );
		$this->register( '/templates/(?P<id>\d+)/duplicate', \WP_REST_Server::CREATABLE, [ $this, 'duplicate' ] );
	}

	public function index( \WP_REST_Request $request ): \WP_REST_Response {
		$repo  = TemplateRepository::instance();
		$rules = RulesStore::get();
		$usage = self::usage_map( $rules );
		$items = [];
		foreach ( $repo->all() as $template ) {
			$item               = $template->to_array( false );
			$item['assignedTo'] = $usage[ $template->id ] ?? [];
			$items[]            = $item;
		}
		return rest_ensure_response( $items );
	}

	public function show( \WP_REST_Request $request ) {
		$template = TemplateRepository::instance()->find( (int) $request['id'] );
		if ( ! $template ) {
			return $this->error( 'schema_forge_not_found', __( 'Template not found.', 'schema-forge' ), 404 );
		}
		return rest_ensure_response( $template->to_array() );
	}

	public function create( \WP_REST_Request $request ) {
		return $this->write( $request, null );
	}

	public function update( \WP_REST_Request $request ) {
		$existing = TemplateRepository::instance()->find( (int) $request['id'] );
		if ( ! $existing ) {
			return $this->error( 'schema_forge_not_found', __( 'Template not found.', 'schema-forge' ), 404 );
		}
		return $this->write( $request, $existing );
	}

	private function write( \WP_REST_Request $request, ?Template $existing ) {
		$body     = $request->get_json_params() ?: [];
		$defaults = Template::defaults();

		$name        = array_key_exists( 'name', $body ) ? sanitize_text_field( (string) $body['name'] ) : ( $existing->name ?? '' );
		$description = array_key_exists( 'description', $body ) ? sanitize_textarea_field( (string) $body['description'] ) : ( $existing->description ?? '' );
		$enabled     = array_key_exists( 'enabled', $body ) ? (bool) $body['enabled'] : ( $existing->enabled ?? false );
		$tree        = array_key_exists( 'tree', $body ) ? $body['tree'] : ( $existing->tree ?? $defaults['tree'] );
		$settings    = array_key_exists( 'settings', $body ) ? $body['settings'] : ( $existing->settings ?? $defaults['settings'] );

		try {
			$clean = ( new TemplateSanitizer() )->sanitize( $tree, $settings );
		} catch ( \InvalidArgumentException $e ) {
			return $this->error( 'schema_forge_invalid_template', $e->getMessage(), 400 );
		}

		$template = new Template( $existing->id ?? 0, $name, $description, $enabled, $clean['tree'], $clean['settings'] );
		try {
			$id = TemplateRepository::instance()->save( $template );
		} catch ( \RuntimeException $e ) {
			return $this->error( 'schema_forge_save_failed', $e->getMessage(), 500 );
		}

		$saved = TemplateRepository::instance()->find( $id );
		$data  = $saved ? $saved->to_array() : [];
		$data['warnings'] = $clean['warnings'];

		return new \WP_REST_Response( $data, $existing ? 200 : 201 );
	}

	public function destroy( \WP_REST_Request $request ) {
		$id = (int) $request['id'];
		if ( ! TemplateRepository::instance()->delete( $id ) ) {
			return $this->error( 'schema_forge_not_found', __( 'Template not found.', 'schema-forge' ), 404 );
		}
		RulesStore::forget_template( $id );
		return rest_ensure_response( [ 'deleted' => true, 'id' => $id ] );
	}

	public function duplicate( \WP_REST_Request $request ) {
		$copy = TemplateRepository::instance()->duplicate( (int) $request['id'] );
		if ( ! $copy ) {
			return $this->error( 'schema_forge_not_found', __( 'Template not found.', 'schema-forge' ), 404 );
		}
		return new \WP_REST_Response( $copy->to_array(), 201 );
	}

	/**
	 * Template id → list of human-readable assignment descriptions.
	 *
	 * @return array<int, string[]>
	 */
	public static function usage_map( array $rules ): array {
		$usage = [];
		$note  = static function ( array $ids, string $label ) use ( &$usage ): void {
			foreach ( $ids as $id ) {
				$usage[ (int) $id ][] = $label;
			}
		};
		foreach ( $rules['post_types'] as $post_type => $ids ) {
			$obj = get_post_type_object( $post_type );
			$note( $ids, $obj ? $obj->labels->name : $post_type );
		}
		foreach ( $rules['taxonomies'] as $taxonomy => $conf ) {
			$tax = get_taxonomy( $taxonomy );
			$note( $conf['templates'], $tax ? $tax->labels->name : $taxonomy );
			foreach ( $conf['terms'] as $term_id => $term_conf ) {
				$term = get_term( (int) $term_id );
				$note( $term_conf['add'], $term instanceof \WP_Term ? $term->name : "#{$term_id}" );
			}
		}
		$labels = [
			'front_page' => __( 'Front page', 'schema-forge' ),
			'blog'       => __( 'Blog', 'schema-forge' ),
			'search'     => __( 'Search', 'schema-forge' ),
			'not_found'  => __( '404', 'schema-forge' ),
			'author'     => __( 'Author archives', 'schema-forge' ),
			'date'       => __( 'Date archives', 'schema-forge' ),
		];
		foreach ( $labels as $key => $label ) {
			$note( $rules['archives'][ $key ], $label );
		}
		foreach ( $rules['archives']['post_type'] as $post_type => $ids ) {
			$obj = get_post_type_object( $post_type );
			$note( $ids, sprintf( /* translators: %s post type */ __( '%s archive', 'schema-forge' ), $obj ? $obj->labels->name : $post_type ) );
		}
		foreach ( $rules['archives']['taxonomy'] as $key => $ids ) {
			$note( $ids, sprintf( /* translators: %s taxonomy or term */ __( '%s archive', 'schema-forge' ), $key ) );
		}
		return $usage;
	}
}
