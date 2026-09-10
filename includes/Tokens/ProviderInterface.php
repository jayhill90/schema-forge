<?php
/**
 * Token provider contract.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens;

use SchemaForge\Model\RenderContext;

interface ProviderInterface {

	/** Namespace used in tokens, e.g. `post`. */
	public function namespace(): string;

	/** Human label for the token picker. */
	public function label(): string;

	/**
	 * Resolve a path. Return null when the value is missing.
	 */
	public function resolve( string $path, RenderContext $ctx ): mixed;

	/**
	 * Tokens to offer in the picker for this context.
	 *
	 * @return array<int, array{token:string, label:string, type:string, description?:string}>
	 */
	public function catalog( RenderContext $ctx ): array;
}
