<?php
/**
 * Resolves tokens inside strings using registered providers.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Tokens;

use SchemaForge\Model\RenderContext;
use SchemaForge\Plugin;
use SchemaForge\Tokens\Providers\AcfProvider;
use SchemaForge\Tokens\Providers\ItemProvider;
use SchemaForge\Tokens\Providers\MetaProvider;
use SchemaForge\Tokens\Providers\PostProvider;
use SchemaForge\Tokens\Providers\SiteProvider;
use SchemaForge\Tokens\Providers\TermsProvider;

final class TokenResolver {

	/** @var array<string, ProviderInterface> */
	private array $providers = [];

	private static ?TokenResolver $instance = null;

	public static function instance(): self {
		if ( self::$instance === null ) {
			self::$instance = new self( self::default_providers() );
		}
		return self::$instance;
	}

	/**
	 * @param ProviderInterface[] $providers
	 */
	public function __construct( array $providers ) {
		foreach ( $providers as $provider ) {
			if ( $provider instanceof ProviderInterface ) {
				$this->providers[ $provider->namespace() ] = $provider;
			}
		}
	}

	/**
	 * @return ProviderInterface[]
	 */
	public static function default_providers(): array {
		$providers = [
			new PostProvider(),
			new SiteProvider(),
			new MetaProvider(),
			new TermsProvider(),
			new ItemProvider(),
		];
		if ( Plugin::acf_active() ) {
			$providers[] = new AcfProvider();
		}
		/**
		 * Filter the token providers.
		 *
		 * @param ProviderInterface[] $providers
		 */
		return (array) apply_filters( 'schema_forge_token_providers', $providers );
	}

	/**
	 * @return array<string, ProviderInterface>
	 */
	public function providers(): array {
		return $this->providers;
	}

	public function resolve_token( array $token, RenderContext $ctx ): mixed {
		$provider = $this->providers[ $token['namespace'] ] ?? null;
		if ( ! $provider ) {
			return null;
		}
		$value = $provider->resolve( $token['path'], $ctx );
		foreach ( $token['filters'] as $filter ) {
			$value = self::apply_filter( $value, $filter['name'], $filter['arg'] );
		}
		/**
		 * Filter a resolved token value.
		 *
		 * @param mixed         $value
		 * @param array         $token
		 * @param RenderContext $ctx
		 */
		return apply_filters( 'schema_forge_resolved_token', $value, $token, $ctx );
	}

	public function resolve_text( string $text, RenderContext $ctx ): ResolvedText {
		$tokens = TokenParser::parse( $text );
		if ( ! $tokens ) {
			return new ResolvedText( $text, false, false, false );
		}

		if ( count( $tokens ) === 1 && TokenParser::is_single_token( $text ) ) {
			$value = $this->resolve_token( $tokens[0], $ctx );
			$empty = self::is_empty( $value );
			return new ResolvedText( $empty ? null : $value, true, $empty, is_array( $value ) );
		}

		$any_empty = false;
		$result    = $text;
		foreach ( $tokens as $token ) {
			$value = $this->resolve_token( $token, $ctx );
			if ( self::is_empty( $value ) ) {
				$any_empty = true;
				$value     = '';
			}
			$result = str_replace( $token['match'], self::to_string( $value ), $result );
		}
		$result = trim( preg_replace( '/[ \t]{2,}/', ' ', $result ) ?? $result );
		return new ResolvedText( $result, true, $any_empty, false );
	}

	public static function is_empty( mixed $value ): bool {
		if ( $value === null || $value === false ) {
			return true;
		}
		if ( is_string( $value ) ) {
			return trim( $value ) === '';
		}
		if ( is_array( $value ) ) {
			return $value === [];
		}
		return false;
	}

	/**
	 * Stringify a value for interpolation into text.
	 */
	public static function to_string( mixed $value ): string {
		if ( is_string( $value ) ) {
			return $value;
		}
		if ( is_bool( $value ) ) {
			return $value ? 'true' : 'false';
		}
		if ( is_int( $value ) || is_float( $value ) ) {
			return (string) $value;
		}
		if ( is_array( $value ) ) {
			if ( array_is_list( $value ) ) {
				return implode( ', ', array_filter( array_map( [ self::class, 'to_string' ], $value ), 'strlen' ) );
			}
			foreach ( [ 'name', 'title', 'url', 'value', 'label' ] as $key ) {
				if ( isset( $value[ $key ] ) && is_scalar( $value[ $key ] ) ) {
					return (string) $value[ $key ];
				}
			}
			return '';
		}
		return '';
	}

	public static function apply_filter( mixed $value, string $name, ?string $arg ): mixed {
		switch ( $name ) {
			case 'join':
				return is_array( $value )
					? implode( $arg ?? ', ', array_map( [ self::class, 'to_string' ], $value ) )
					: $value;
			case 'first':
				return is_array( $value ) ? ( $value[ array_key_first( $value ) ] ?? null ) : $value;
			case 'last':
				return is_array( $value ) ? ( $value[ array_key_last( $value ) ] ?? null ) : $value;
			case 'count':
				return is_array( $value ) ? count( $value ) : ( self::is_empty( $value ) ? 0 : 1 );
			case 'date':
				if ( self::is_empty( $value ) ) {
					return $value;
				}
				$ts = is_numeric( $value ) ? (int) $value : strtotime( self::to_string( $value ) );
				return $ts ? wp_date( $arg ?: 'c', $ts ) : $value;
			case 'upper':
				return is_string( $value ) ? mb_strtoupper( $value ) : $value;
			case 'lower':
				return is_string( $value ) ? mb_strtolower( $value ) : $value;
			case 'trim':
				return is_string( $value ) ? trim( $value ) : $value;
			case 'truncate':
				$n = max( 1, (int) ( $arg ?? 160 ) );
				return is_string( $value ) ? wp_html_excerpt( $value, $n, '…' ) : $value;
			case 'words':
				$n = max( 1, (int) ( $arg ?? 55 ) );
				return is_string( $value ) ? wp_trim_words( $value, $n, '…' ) : $value;
			case 'strip':
			case 'text':
				return is_string( $value ) ? trim( wp_strip_all_tags( $value ) ) : $value;
			case 'default':
				return self::is_empty( $value ) ? ( $arg ?? '' ) : $value;
			case 'key':
				return is_array( $value ) && $arg !== null ? ( $value[ $arg ] ?? null ) : null;
			case 'raw':
			default:
				/**
				 * Allow custom token filters: `{{post.title|myfilter:arg}}`.
				 *
				 * @param mixed   $value
				 * @param string  $arg
				 */
				return apply_filters( "schema_forge_token_filter_{$name}", $value, $arg );
		}
	}

	/**
	 * Full catalog for the token picker.
	 *
	 * @return array<int, array{namespace:string, label:string, tokens:array}>
	 */
	public function catalog( RenderContext $ctx ): array {
		$groups = [];
		foreach ( $this->providers as $provider ) {
			$tokens = $provider->catalog( $ctx );
			if ( ! $tokens ) {
				continue;
			}
			$groups[] = [
				'namespace' => $provider->namespace(),
				'label'     => $provider->label(),
				'tokens'    => array_values( $tokens ),
			];
		}
		return $groups;
	}
}
