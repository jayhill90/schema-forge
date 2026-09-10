<?php
/**
 * Template value object.
 *
 * @package SchemaForge
 */

declare(strict_types=1);

namespace SchemaForge\Model;

final class Template {

	public function __construct(
		public int $id,
		public string $name,
		public string $description,
		public bool $enabled,
		public array $tree,
		public array $settings,
		public string $modified = '',
		public string $created = '',
	) {}

	public static function defaults(): array {
		return [
			'tree'     => [
				'version' => 1,
				'root'    => null,
			],
			'settings' => [
				'yoast'      => [
					'suppressArticle' => false,
					'webPageType'     => '',
				],
				'standalone' => [
					'includeCoreNodes' => true,
				],
			],
		];
	}

	public function root(): ?array {
		$root = $this->tree['root'] ?? null;
		return is_array( $root ) ? $root : null;
	}

	public function root_type(): string {
		return (string) ( $this->root()['type'] ?? '' );
	}

	public function setting( string $path, mixed $default = null ): mixed {
		$value = $this->settings;
		foreach ( explode( '.', $path ) as $segment ) {
			if ( ! is_array( $value ) || ! array_key_exists( $segment, $value ) ) {
				return $default;
			}
			$value = $value[ $segment ];
		}
		return $value;
	}

	public function to_array( bool $with_tree = true ): array {
		$data = [
			'id'          => $this->id,
			'name'        => $this->name,
			'description' => $this->description,
			'enabled'     => $this->enabled,
			'rootType'    => $this->root_type(),
			'modified'    => $this->modified,
			'created'     => $this->created,
		];
		if ( $with_tree ) {
			$data['tree']     = $this->tree;
			$data['settings'] = $this->settings;
		}
		return $data;
	}
}
