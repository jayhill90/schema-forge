<?php
/**
 * Validates and sanitizes template trees coming from the REST API.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Support;

use SchemaForge\Compiler\NodeCompiler;
use SchemaForge\Compiler\ReferenceResolver;
use SchemaForge\Compiler\ValueCoercer;
use SchemaForge\Vocab\VocabLoader;

final class TemplateSanitizer {

	public const TYPE_PATTERN     = '/^[A-Za-z0-9][A-Za-z0-9_]{0,80}$/';
	public const PROPERTY_PATTERN = '/^[a-z][A-Za-z0-9_-]{0,80}$/';
	public const ID_PATTERN       = '/^[A-Za-z0-9_-]{1,40}$/';
	public const PLACEMENTS       = [ 'inline', 'graph' ];
	public const ON_EMPTY         = [ 'drop', 'fallback', 'dropNode' ];
	public const VALUE_KINDS      = [ 'text', 'node', 'ref', 'repeat' ];

	/** @var string[] */
	private array $warnings = [];

	private int $node_count = 0;

	/** @var array<string,bool> */
	private array $ids = [];

	/**
	 * @throws \InvalidArgumentException On structural errors.
	 * @return array{tree:array, settings:array, warnings:string[]}
	 */
	public function sanitize( mixed $tree, mixed $settings ): array {
		$this->warnings   = [];
		$this->node_count = 0;
		$this->ids        = [];

		if ( ! is_array( $tree ) ) {
			throw new \InvalidArgumentException( __( 'Template tree must be an object.', 'schema-forge' ) );
		}
		$root = $tree['root'] ?? null;
		$clean_tree = [
			'version' => 1,
			'root'    => is_array( $root ) && ! empty( $root['type'] ) ? $this->node( $root, 0, true ) : null,
		];

		return [
			'tree'     => $clean_tree,
			'settings' => $this->settings( is_array( $settings ) ? $settings : [] ),
			'warnings' => $this->warnings,
		];
	}

	public function settings( array $settings ): array {
		$yoast      = (array) ( $settings['yoast'] ?? [] );
		$standalone = (array) ( $settings['standalone'] ?? [] );
		$page_type  = sanitize_text_field( (string) ( $yoast['webPageType'] ?? '' ) );
		if ( $page_type !== '' && ! preg_match( self::TYPE_PATTERN, $page_type ) ) {
			$page_type = '';
		}
		return [
			'yoast'      => [
				'suppressArticle' => ! empty( $yoast['suppressArticle'] ),
				'webPageType'     => $page_type,
			],
			'standalone' => [
				'includeCoreNodes' => ! array_key_exists( 'includeCoreNodes', $standalone ) || ! empty( $standalone['includeCoreNodes'] ),
			],
		];
	}

	private function node( array $node, int $depth, bool $is_root ): array {
		if ( $depth > NodeCompiler::MAX_DEPTH ) {
			throw new \InvalidArgumentException( sprintf( /* translators: %d depth */ __( 'Template nesting deeper than %d levels is not allowed.', 'schema-forge' ), NodeCompiler::MAX_DEPTH ) );
		}
		if ( ++$this->node_count > NodeCompiler::MAX_NODES ) {
			throw new \InvalidArgumentException( sprintf( /* translators: %d count */ __( 'Templates may not contain more than %d nodes.', 'schema-forge' ), NodeCompiler::MAX_NODES ) );
		}

		$type = trim( (string) ( $node['type'] ?? '' ) );
		if ( ! preg_match( self::TYPE_PATTERN, $type ) ) {
			throw new \InvalidArgumentException( sprintf( /* translators: %s type */ __( 'Invalid schema type "%s".', 'schema-forge' ), $type ) );
		}
		if ( VocabLoader::available() && ! VocabLoader::has_type( $type ) ) {
			$this->warnings[] = sprintf( /* translators: %s type */ __( '"%s" is not a known schema.org type.', 'schema-forge' ), $type );
		} elseif ( VocabLoader::available() && VocabLoader::is_superseded_type( $type ) ) {
			$this->warnings[] = sprintf( /* translators: 1: type 2: replacement */ __( '"%1$s" is deprecated on schema.org; consider "%2$s".', 'schema-forge' ), $type, implode( ', ', VocabLoader::superseded_by( $type, 'types' ) ) );
		}

		$id = (string) ( $node['id'] ?? '' );
		if ( ! preg_match( self::ID_PATTERN, $id ) || isset( $this->ids[ $id ] ) ) {
			$id = self::generate_id( 'n' );
		}
		$this->ids[ $id ] = true;

		$options = (array) ( $node['options'] ?? [] );
		$extra   = [];
		foreach ( (array) ( $options['extraTypes'] ?? [] ) as $extra_type ) {
			$extra_type = trim( (string) $extra_type );
			if ( preg_match( self::TYPE_PATTERN, $extra_type ) && $extra_type !== $type ) {
				$extra[] = $extra_type;
			}
		}
		$placement = (string) ( $options['placement'] ?? ( $is_root ? 'graph' : 'inline' ) );
		if ( ! in_array( $placement, self::PLACEMENTS, true ) ) {
			$placement = 'inline';
		}

		$clean = [
			'id'         => $id,
			'type'       => $type,
			'options'    => [
				'isMainEntity' => $is_root && ! empty( $options['isMainEntity'] ),
				'idOverride'   => sanitize_text_field( (string) ( $options['idOverride'] ?? '' ) ),
				'placement'    => $is_root ? 'graph' : $placement,
				'extraTypes'   => array_values( array_unique( $extra ) ),
				'collapsed'    => ! empty( $options['collapsed'] ),
			],
			'properties' => [],
		];

		foreach ( (array) ( $node['properties'] ?? [] ) as $property ) {
			if ( is_array( $property ) ) {
				$clean['properties'][] = $this->property( $property, $type, $depth );
			}
		}
		return $clean;
	}

	private function property( array $property, string $type, int $depth ): array {
		$name = trim( (string) ( $property['name'] ?? '' ) );
		if ( ! preg_match( self::PROPERTY_PATTERN, $name ) ) {
			throw new \InvalidArgumentException( sprintf( /* translators: %s property */ __( 'Invalid property name "%s".', 'schema-forge' ), $name ) );
		}
		if ( VocabLoader::available() && VocabLoader::has_type( $type ) && ! VocabLoader::type_has_property( $type, $name ) ) {
			$this->warnings[] = sprintf( /* translators: 1: property 2: type */ __( '"%1$s" is not an expected property of %2$s.', 'schema-forge' ), $name, $type );
		}
		if ( VocabLoader::available() && VocabLoader::is_superseded_property( $name ) ) {
			$this->warnings[] = sprintf( /* translators: 1: property 2: replacement */ __( '"%1$s" is deprecated on schema.org; consider "%2$s".', 'schema-forge' ), $name, implode( ', ', VocabLoader::superseded_by( $name, 'props' ) ) );
		}

		$id = (string) ( $property['id'] ?? '' );
		if ( ! preg_match( self::ID_PATTERN, $id ) || isset( $this->ids[ $id ] ) ) {
			$id = self::generate_id( 'p' );
		}
		$this->ids[ $id ] = true;

		$data_type = (string) ( $property['dataType'] ?? 'auto' );
		$on_empty  = (string) ( $property['onEmpty'] ?? 'drop' );

		$clean = [
			'id'       => $id,
			'name'     => $name,
			'dataType' => in_array( $data_type, ValueCoercer::TYPES, true ) ? $data_type : 'auto',
			'onEmpty'  => in_array( $on_empty, self::ON_EMPTY, true ) ? $on_empty : 'drop',
			'fallback' => self::text( (string) ( $property['fallback'] ?? '' ) ),
			'values'   => [],
		];

		foreach ( (array) ( $property['values'] ?? [] ) as $value ) {
			if ( is_array( $value ) ) {
				$clean['values'][] = $this->value( $value, $depth );
			}
		}
		return $clean;
	}

	private function value( array $value, int $depth ): array {
		$kind = (string) ( $value['kind'] ?? 'text' );
		if ( ! in_array( $kind, self::VALUE_KINDS, true ) ) {
			$kind = 'text';
		}
		$id = (string) ( $value['id'] ?? '' );
		if ( ! preg_match( self::ID_PATTERN, $id ) || isset( $this->ids[ $id ] ) ) {
			$id = self::generate_id( 'v' );
		}
		$this->ids[ $id ] = true;

		switch ( $kind ) {
			case 'node':
				$node = $value['node'] ?? null;
				if ( ! is_array( $node ) ) {
					throw new \InvalidArgumentException( __( 'Nested value is missing its node.', 'schema-forge' ) );
				}
				return [ 'id' => $id, 'kind' => 'node', 'node' => $this->node( $node, $depth + 1, false ) ];

			case 'ref':
				$target = trim( (string) ( $value['target'] ?? '' ) );
				if ( ! preg_match( '/^(yoast|core):(' . implode( '|', ReferenceResolver::YOAST_TARGETS ) . ')$|^node:[A-Za-z0-9_-]{1,40}$|^template:\d{1,10}$/', $target ) ) {
					throw new \InvalidArgumentException( sprintf( /* translators: %s target */ __( 'Invalid reference "%s".', 'schema-forge' ), $target ) );
				}
				return [ 'id' => $id, 'kind' => 'ref', 'target' => $target ];

			case 'repeat':
				$node = $value['node'] ?? null;
				if ( ! is_array( $node ) ) {
					throw new \InvalidArgumentException( __( 'Repeat value is missing its node.', 'schema-forge' ) );
				}
				return [
					'id'     => $id,
					'kind'   => 'repeat',
					'source' => self::text( (string) ( $value['source'] ?? '' ) ),
					'node'   => $this->node( $node, $depth + 1, false ),
				];

			case 'text':
			default:
				return [
					'id'           => $id,
					'kind'         => 'text',
					'value'        => self::text( (string) ( $value['value'] ?? '' ) ),
					'allowPartial' => ! empty( $value['allowPartial'] ),
				];
		}
	}

	/**
	 * Sanitize a literal/token string without mangling {{tokens}}.
	 */
	public static function text( string $value ): string {
		$value = wp_check_invalid_utf8( $value );
		$value = wp_strip_all_tags( $value );
		return trim( preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $value ) ?? $value );
	}

	public static function generate_id( string $prefix ): string {
		return $prefix . '_' . substr( str_replace( [ '+', '/', '=' ], '', base64_encode( random_bytes( 6 ) ) ), 0, 8 );
	}
}
