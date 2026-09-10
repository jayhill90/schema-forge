<?php
/**
 * {{item.*}} tokens inside repeat scopes.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens\Providers;

use SchemaForge\Model\RenderContext;
use SchemaForge\Tokens\ProviderInterface;

final class ItemProvider implements ProviderInterface {

	public function namespace(): string {
		return 'item';
	}

	public function label(): string {
		return __( 'Repeat item', 'schema-forge' );
	}

	public function resolve( string $path, RenderContext $ctx ): mixed {
		$scope = $ctx->scope;
		if ( $scope === null ) {
			return null;
		}
		if ( $path === 'value' || $path === 'self' ) {
			return $scope;
		}
		if ( $path === 'index' ) {
			return is_array( $scope ) && isset( $scope['__index'] ) ? $scope['__index'] : null;
		}
		$value = $scope;
		foreach ( explode( '.', $path ) as $segment ) {
			if ( is_object( $value ) ) {
				$value = get_object_vars( $value );
			}
			if ( ! is_array( $value ) || ! array_key_exists( $segment, $value ) ) {
				return null;
			}
			$value = $value[ $segment ];
		}
		return $value;
	}

	public function catalog( RenderContext $ctx ): array {
		return [
			[ 'token' => '{{item.value}}', 'label' => __( 'Item (scalar)', 'schema-forge' ), 'type' => 'text', 'description' => __( 'Use inside a Repeat value. For rows, address fields as {{item.field}}.', 'schema-forge' ) ],
			[ 'token' => '{{item.name}}', 'label' => __( 'Item name', 'schema-forge' ), 'type' => 'text' ],
			[ 'token' => '{{item.index}}', 'label' => __( 'Item position (1-based)', 'schema-forge' ), 'type' => 'number' ],
		];
	}
}
