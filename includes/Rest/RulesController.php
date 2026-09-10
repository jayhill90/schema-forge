<?php
/**
 * /rules and /settings.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Rest;

use SchemaForge\Assignment\RulesStore;
use SchemaForge\Support\Settings;

final class RulesController extends AbstractController {

	public function register_routes(): void {
		$this->register( '/rules', \WP_REST_Server::READABLE, [ $this, 'get_rules' ] );
		$this->register( '/rules', 'PUT, POST', [ $this, 'update_rules' ] );
		$this->register( '/settings', \WP_REST_Server::READABLE, [ $this, 'get_settings' ] );
		$this->register( '/settings', 'PUT, POST', [ $this, 'update_settings' ] );
	}

	public function get_rules(): \WP_REST_Response {
		return rest_ensure_response( RulesStore::get() );
	}

	public function update_rules( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params();
		return rest_ensure_response( RulesStore::update( is_array( $body ) ? $body : [] ) );
	}

	public function get_settings(): \WP_REST_Response {
		return rest_ensure_response( Settings::get() );
	}

	public function update_settings( \WP_REST_Request $request ): \WP_REST_Response {
		$body = $request->get_json_params();
		return rest_ensure_response( Settings::update( is_array( $body ) ? $body : [] ) );
	}
}
