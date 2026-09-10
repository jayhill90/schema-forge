<?php
/**
 * Compiles a template tree into schema.org graph nodes.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Compiler;

use SchemaForge\Model\RenderContext;
use SchemaForge\Model\Template;
use SchemaForge\Tokens\TokenParser;
use SchemaForge\Tokens\TokenResolver;

final class NodeCompiler {

	public const MAX_DEPTH = 12;

	public const MAX_NODES = 500;

	public const MAX_REPEAT = 200;

	private TokenResolver $resolver;

	private bool $collect_tokens;

	private CompileResult $result;

	private int $node_count = 0;

	/** @var array<string,string> nodeId → @id for graph-placed nodes */
	private array $node_ids = [];

	public function __construct( ?TokenResolver $resolver = null, bool $collect_tokens = false ) {
		$this->resolver       = $resolver ?? TokenResolver::instance();
		$this->collect_tokens = $collect_tokens;
		$this->result         = new CompileResult();
	}

	public function compile( Template $template, RenderContext $ctx ): CompileResult {
		$this->result     = new CompileResult();
		$this->node_count = 0;
		$this->node_ids   = [];

		$root = $template->root();
		if ( ! $root || empty( $root['type'] ) ) {
			return $this->result;
		}
		$ctx = $ctx->for_template( $template->id );

		$this->index_graph_nodes( $root, $ctx, $template->id, true );

		$root_node = $this->compile_node( $root, $ctx, 0, true );
		if ( $root_node !== null ) {
			// Root goes first, nested graph nodes follow.
			array_unshift( $this->result->nodes, $root_node );
		}

		/**
		 * Filter the nodes compiled for a template.
		 *
		 * @param array[]       $nodes
		 * @param Template      $template
		 * @param RenderContext $ctx
		 */
		$this->result->nodes = (array) apply_filters( 'schema_forge_compiled_nodes', $this->result->nodes, $template, $ctx );

		return $this->result;
	}

	/**
	 * Pre-compute @ids of graph-placed nodes so node: refs can point forward.
	 */
	private function index_graph_nodes( array $node, RenderContext $ctx, int $template_id, bool $is_root ): void {
		$placement = $is_root ? 'graph' : (string) ( $node['options']['placement'] ?? 'inline' );
		if ( $placement === 'graph' && ! empty( $node['id'] ) && ! empty( $node['type'] ) ) {
			$this->node_ids[ (string) $node['id'] ] = $is_root
				? IdGenerator::root( $ctx, (string) $node['type'], $template_id )
				: IdGenerator::nested( $ctx, (string) $node['type'], $template_id, (string) $node['id'] );
		}
		foreach ( (array) ( $node['properties'] ?? [] ) as $property ) {
			foreach ( (array) ( $property['values'] ?? [] ) as $value ) {
				if ( isset( $value['node'] ) && is_array( $value['node'] ) && ( $value['kind'] ?? '' ) === 'node' ) {
					$this->index_graph_nodes( $value['node'], $ctx, $template_id, false );
				}
			}
		}
	}

	/**
	 * @return array|null Compiled node, or null when dropped.
	 */
	private function compile_node( array $node, RenderContext $ctx, int $depth, bool $is_root ): ?array {
		if ( $depth > self::MAX_DEPTH || ++$this->node_count > self::MAX_NODES ) {
			$this->warn( __( 'Template too deep or too large; some nodes were skipped.', 'schema-forge' ) );
			return null;
		}
		$type = (string) ( $node['type'] ?? '' );
		if ( $type === '' ) {
			return null;
		}

		$options   = (array) ( $node['options'] ?? [] );
		$placement = $is_root ? 'graph' : (string) ( $options['placement'] ?? 'inline' );

		$types = array_values( array_unique( array_merge( [ $type ], array_filter( (array) ( $options['extraTypes'] ?? [] ), 'is_string' ) ) ) );
		$out   = [ '@type' => count( $types ) === 1 ? $types[0] : $types ];

		if ( $placement === 'graph' ) {
			$id = $this->node_ids[ (string) ( $node['id'] ?? '' ) ] ?? null;
			if ( ! empty( $options['idOverride'] ) ) {
				$resolved = $this->resolver->resolve_text( (string) $options['idOverride'], $ctx );
				if ( ! $resolved->is_empty() && is_string( $resolved->value ) ) {
					$id = IdGenerator::override( $ctx, $resolved->value );
				}
			}
			if ( $id === null ) {
				$id = $is_root
					? IdGenerator::root( $ctx, $type, $ctx->template_id )
					: IdGenerator::nested( $ctx, $type, $ctx->template_id, (string) ( $node['id'] ?? uniqid() ) );
			}
			$out['@id'] = $id;
		}

		foreach ( (array) ( $node['properties'] ?? [] ) as $property ) {
			$name = (string) ( $property['name'] ?? '' );
			if ( $name === '' || $name[0] === '@' ) {
				continue;
			}
			$values = $this->compile_values( (array) ( $property['values'] ?? [] ), $property, $ctx, $depth );
			if ( $values === [] ) {
				$on_empty = (string) ( $property['onEmpty'] ?? 'drop' );
				if ( $on_empty === 'fallback' ) {
					$fallback = $this->resolver->resolve_text( (string) ( $property['fallback'] ?? '' ), $ctx );
					if ( ! $fallback->is_empty() ) {
						$values = [ ValueCoercer::coerce( $fallback->value, (string) ( $property['dataType'] ?? 'auto' ) ) ];
					}
				} elseif ( $on_empty === 'dropNode' ) {
					return null;
				}
				if ( $values === [] ) {
					continue;
				}
			}
			$out[ $name ] = count( $values ) === 1 ? $values[0] : $values;
		}

		if ( $is_root && ! empty( $options['isMainEntity'] ) ) {
			$out['mainEntityOfPage']       = [ '@id' => $ctx->webpage_id() ];
			$this->result->main_entity_id = $out['@id'];
		}

		if ( $placement === 'graph' && ! $is_root ) {
			$this->result->nodes[] = $out;
			return [ '@id' => $out['@id'] ];
		}
		return $out;
	}

	/**
	 * @return array Non-empty compiled values.
	 */
	private function compile_values( array $values, array $property, RenderContext $ctx, int $depth ): array {
		$data_type = (string) ( $property['dataType'] ?? 'auto' );
		$out       = [];
		foreach ( $values as $value ) {
			$kind = (string) ( $value['kind'] ?? 'text' );
			switch ( $kind ) {
				case 'text':
					$raw      = (string) ( $value['value'] ?? '' );
					$resolved = $this->resolver->resolve_text( $raw, $ctx );
					$this->record_tokens( $raw, $ctx );
					if ( $resolved->is_empty() ) {
						break;
					}
					if ( $resolved->had_tokens && $resolved->any_empty && empty( $value['allowPartial'] ) && ! $resolved->structured ) {
						break;
					}
					$coerced = ValueCoercer::coerce( $resolved->value, $data_type );
					if ( TokenResolver::is_empty( $coerced ) ) {
						break;
					}
					// A single-token list of scalars expands to multiple values.
					if ( is_array( $coerced ) && array_is_list( $coerced ) && ! isset( $coerced['@type'] ) ) {
						foreach ( $coerced as $item ) {
							if ( is_array( $item ) && ! isset( $item['@type'] ) ) {
								$item = TokenResolver::to_string( $item );
							}
							if ( ! TokenResolver::is_empty( $item ) ) {
								$out[] = $item;
							}
						}
					} else {
						$out[] = $coerced;
					}
					break;

				case 'node':
					if ( isset( $value['node'] ) && is_array( $value['node'] ) ) {
						$child = $this->compile_node( $value['node'], $ctx, $depth + 1, false );
						if ( $child !== null ) {
							$out[] = $child;
						}
					}
					break;

				case 'ref':
					$ref = ReferenceResolver::resolve( (string) ( $value['target'] ?? '' ), $ctx, $this->node_ids, $this->result->dependencies );
					if ( $ref !== null ) {
						$out[] = $ref;
					}
					break;

				case 'repeat':
					$source = (string) ( $value['source'] ?? '' );
					$rows   = $this->resolver->resolve_text( $source, $ctx );
					$this->record_tokens( $source, $ctx );
					if ( $rows->is_empty() || ! isset( $value['node'] ) || ! is_array( $value['node'] ) ) {
						break;
					}
					$list = is_array( $rows->value ) ? $rows->value : [ $rows->value ];
					if ( ! array_is_list( $list ) ) {
						$list = isset( $list['@type'] ) ? [ $list ] : array_values( $list );
					}
					$i = 0;
					foreach ( array_slice( $list, 0, self::MAX_REPEAT ) as $row ) {
						++$i;
						if ( is_array( $row ) && ! isset( $row['__index'] ) ) {
							$row['__index'] = $i;
						}
						$child = $this->compile_node( $value['node'], $ctx->with_scope( $row ), $depth + 1, false );
						if ( $child !== null ) {
							$out[] = $child;
						}
					}
					break;
			}
		}
		return $out;
	}

	private function record_tokens( string $raw, RenderContext $ctx ): void {
		if ( ! $this->collect_tokens ) {
			return;
		}
		foreach ( TokenParser::parse( $raw ) as $token ) {
			$key = $token['match'];
			if ( array_key_exists( $key, $this->result->tokens ) ) {
				continue;
			}
			$value = $this->resolver->resolve_token( $token, $ctx );
			$this->result->tokens[ $key ] = is_array( $value ) ? $value : ( $value === null ? null : TokenResolver::to_string( $value ) );
		}
	}

	private function warn( string $message ): void {
		if ( ! in_array( $message, $this->result->warnings, true ) ) {
			$this->result->warnings[] = $message;
		}
	}
}
