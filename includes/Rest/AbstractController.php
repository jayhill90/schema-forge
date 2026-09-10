<?php
/**
 * Shared REST controller behaviour.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Rest;

use SchemaForge\Support\Capabilities;

abstract class AbstractController {

	public const NAMESPACE = 'schema-forge/v1';

	abstract public function register_routes(): void;

	public function permission_check(): bool|\WP_Error {
		if ( Capabilities::current_user_can() ) {
			return true;
		}
		return new \WP_Error(
			'schema_forge_forbidden',
			__( 'You are not allowed to manage schema templates.', 'schema-forge' ),
			[ 'status' => rest_authorization_required_code() ]
		);
	}

	protected function error( string $code, string $message, int $status = 400, array $data = [] ): \WP_Error {
		return new \WP_Error( $code, $message, array_merge( [ 'status' => $status ], $data ) );
	}

	protected function register( string $route, string $methods, callable $callback, array $args = [], ?callable $permission = null ): void {
		register_rest_route(
			self::NAMESPACE,
			$route,
			[
				'methods'             => $methods,
				'callback'            => $callback,
				'permission_callback' => $permission ?? [ $this, 'permission_check' ],
				'args'                => $args,
			]
		);
	}
}
