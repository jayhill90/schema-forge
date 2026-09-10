<?php
/**
 * Sample templates + rules for the playground. Idempotent (keyed by name).
 */

use SchemaForge\Assignment\PostAssignments;
use SchemaForge\Assignment\RulesStore;
use SchemaForge\Model\Template;
use SchemaForge\Repository\TemplateRepository;
use SchemaForge\Support\TemplateSanitizer;

if ( ! function_exists( 'sf_seed_template' ) ) {
	function sf_seed_template( string $name, array $root, array $settings = [], bool $enabled = true ): int {
		$repo  = TemplateRepository::instance();
		$clean = ( new TemplateSanitizer() )->sanitize( [ 'version' => 1, 'root' => $root ], array_replace_recursive( Template::defaults()['settings'], $settings ) );
		if ( $clean['warnings'] ) {
			echo "  warn [$name] " . implode( '; ', $clean['warnings'] ) . "\n";
		}
		$root     = $clean['tree']['root'];
		$settings = $clean['settings'];
		foreach ( $repo->all() as $existing ) {
			if ( $existing->name === $name ) {
				$template = new Template( $existing->id, $name, $existing->description, $enabled, [ 'version' => 1, 'root' => $root ], array_replace_recursive( Template::defaults()['settings'], $settings ) );
				return $repo->save( $template );
			}
		}
		$template = new Template( 0, $name, 'Seeded sample template.', $enabled, [ 'version' => 1, 'root' => $root ], array_replace_recursive( Template::defaults()['settings'], $settings ) );
		return $repo->save( $template );
	}

	function sf_next_id( string $prefix ): string {
		static $n = 0;
		return $prefix . '_' . base_convert( (string) ( ++$n ), 10, 36 );
	}

	function sf_prop( string $name, array $values, array $extra = [] ): array {
		return array_merge(
			[ 'id' => sf_next_id( 'p' ), 'name' => $name, 'dataType' => 'auto', 'onEmpty' => 'drop', 'fallback' => '', 'values' => $values ],
			$extra
		);
	}

	function sf_text( string $value, bool $allow_partial = false ): array {
		return [ 'id' => sf_next_id( 'v' ), 'kind' => 'text', 'value' => $value, 'allowPartial' => $allow_partial ];
	}

	function sf_ref( string $target ): array {
		return [ 'id' => sf_next_id( 'v' ), 'kind' => 'ref', 'target' => $target ];
	}

	function sf_node( string $id, string $type, array $properties, array $options = [] ): array {
		return [ 'id' => $id, 'type' => $type, 'options' => array_merge( [ 'isMainEntity' => false, 'idOverride' => '', 'placement' => 'inline', 'extraTypes' => [] ], $options ), 'properties' => $properties ];
	}
}

$ids = [];

// 1. Product: main entity, offers nested, brand referencing Yoast org, image via featured image object.
$ids['product'] = sf_seed_template(
	'Product (main entity)',
	sf_node(
		'root',
		'Product',
		[
			sf_prop( 'name', [ sf_text( '{{post.title}}' ) ], [ 'onEmpty' => 'dropNode' ] ),
			sf_prop( 'description', [ sf_text( '{{post.excerpt}}' ) ] ),
			sf_prop( 'sku', [ sf_text( '{{meta.sku}}' ) ] ),
			sf_prop( 'image', [ sf_text( '{{post.featured_image_object}}' ) ] ),
			sf_prop( 'url', [ sf_text( '{{post.permalink}}' ) ], [ 'dataType' => 'url' ] ),
			sf_prop( 'category', [ sf_text( '{{terms.product_cat.first.name}}' ) ] ),
			sf_prop( 'keywords', [ sf_text( '{{terms.product_cat|join:", "}}' ) ] ),
			sf_prop( 'brand', [ [ 'id' => 'v_brand', 'kind' => 'node', 'node' => sf_node( 'brand', 'Brand', [ sf_prop( 'name', [ sf_text( '{{meta.brand_name}}' ) ], [ 'onEmpty' => 'fallback', 'fallback' => '{{site.name}}' ] ) ] ) ] ] ),
			sf_prop( 'manufacturer', [ sf_ref( 'yoast:organization' ) ] ),
			sf_prop(
				'offers',
				[
					[
						'id'   => 'v_offer',
						'kind' => 'node',
						'node' => sf_node(
							'offer',
							'Offer',
							[
								sf_prop( 'price', [ sf_text( '{{meta.price}}' ) ], [ 'dataType' => 'number', 'onEmpty' => 'dropNode' ] ),
								sf_prop( 'priceCurrency', [ sf_text( '{{meta.currency}}' ) ], [ 'onEmpty' => 'fallback', 'fallback' => 'USD' ] ),
								sf_prop( 'availability', [ sf_text( 'https://schema.org/InStock' ) ] ),
								sf_prop( 'url', [ sf_text( '{{post.permalink}}' ) ], [ 'dataType' => 'url' ] ),
								sf_prop( 'seller', [ sf_ref( 'yoast:organization' ) ] ),
							]
						),
					],
				]
			),
		],
		[ 'isMainEntity' => true, 'placement' => 'graph' ]
	),
	[ 'yoast' => [ 'suppressArticle' => true, 'webPageType' => 'ItemPage' ] ]
);

// 2. Recipe for posts in the "recipes" category.
$ids['recipe'] = sf_seed_template(
	'Recipe',
	sf_node(
		'root',
		'Recipe',
		[
			sf_prop( 'name', [ sf_text( '{{post.title}}' ) ], [ 'onEmpty' => 'dropNode' ] ),
			sf_prop( 'description', [ sf_text( '{{post.excerpt}}' ) ] ),
			sf_prop( 'author', [ sf_ref( 'yoast:author' ) ] ),
			sf_prop( 'datePublished', [ sf_text( '{{post.date}}' ) ], [ 'dataType' => 'datetime' ] ),
			sf_prop( 'prepTime', [ sf_text( '{{meta.prep_time}}' ) ] ),
			sf_prop( 'cookTime', [ sf_text( '{{meta.cook_time}}' ) ] ),
			sf_prop( 'recipeCategory', [ sf_text( '{{terms.category}}' ) ] ),
			sf_prop( 'image', [ sf_ref( 'yoast:primaryimage' ) ] ),
		],
		[ 'isMainEntity' => true ]
	)
);

// 3. Organization for the front page, plus a separate ContactPoint placed in the graph and referenced by node id.
$ids['org'] = sf_seed_template(
	'Store organization',
	sf_node(
		'root',
		'LocalBusiness',
		[
			sf_prop( 'name', [ sf_text( '{{site.name}}' ) ] ),
			sf_prop( 'url', [ sf_text( '{{site.url}}' ) ], [ 'dataType' => 'url' ] ),
			sf_prop( 'description', [ sf_text( '{{site.description}}' ) ] ),
			sf_prop( 'telephone', [ sf_text( '+1-555-0100' ) ] ),
			sf_prop( 'contactPoint', [ sf_ref( 'node:contact' ) ] ),
			sf_prop( 'sameAs', [ sf_text( 'https://twitter.com/forge' ), sf_text( 'https://facebook.com/forge' ) ], [ 'dataType' => 'url' ] ),
			sf_prop( 'contactPoint', [ [ 'id' => 'v_contact', 'kind' => 'node', 'node' => sf_node( 'contact', 'ContactPoint', [ sf_prop( 'contactType', [ sf_text( 'customer service' ) ] ), sf_prop( 'telephone', [ sf_text( '+1-555-0100' ) ] ) ], [ 'placement' => 'graph' ] ) ] ] ),
		],
		[ 'isMainEntity' => true, 'extraTypes' => [ 'Store' ] ]
	)
);

// 4. FAQPage using repeat over an ACF/SCF repeater (falls back to nothing when absent).
$ids['faq'] = sf_seed_template(
	'FAQ (ACF repeater)',
	sf_node(
		'root',
		'FAQPage',
		[
			sf_prop(
				'mainEntity',
				[
					[
						'id'     => 'v_repeat',
						'kind'   => 'repeat',
						'source' => '{{acf.faqs}}',
						'node'   => sf_node(
							'q',
							'Question',
							[
								sf_prop( 'name', [ sf_text( '{{item.question}}' ) ], [ 'onEmpty' => 'dropNode' ] ),
								sf_prop( 'acceptedAnswer', [ [ 'id' => 'v_ans', 'kind' => 'node', 'node' => sf_node( 'a', 'Answer', [ sf_prop( 'text', [ sf_text( '{{item.answer}}' ) ] ) ] ) ] ] ),
							]
						),
					],
				],
				[ 'onEmpty' => 'dropNode' ]
			),
		]
	),
	[ 'yoast' => [ 'webPageType' => 'FAQPage' ] ]
);

// 4b. API documentation page: APIReference main entity + WebAPI + SearchAction with the hyphenated query-input property.
$ids['api'] = sf_seed_template(
	'API reference page',
	sf_node(
		'root',
		'APIReference',
		[
			sf_prop( 'headline', [ sf_text( '{{post.title}}' ) ], [ 'onEmpty' => 'dropNode' ] ),
			sf_prop( 'description', [ sf_text( '{{post.excerpt}}' ) ] ),
			sf_prop( 'programmingModel', [ sf_text( 'REST' ) ] ),
			sf_prop( 'targetPlatform', [ sf_text( '{{meta.platform}}' ) ], [ 'onEmpty' => 'fallback', 'fallback' => 'Web' ] ),
			sf_prop( 'assemblyVersion', [ sf_text( '{{meta.api_version}}' ) ] ),
			sf_prop( 'proficiencyLevel', [ sf_text( 'Expert' ) ] ),
			sf_prop( 'author', [ sf_ref( 'yoast:organization' ) ] ),
			sf_prop(
				'about',
				[
					[
						'id'   => 'v_api',
						'kind' => 'node',
						'node' => sf_node(
							'webapi',
							'WebAPI',
							[
								sf_prop( 'name', [ sf_text( '{{site.name}} API' ) ] ),
								sf_prop( 'documentation', [ sf_text( '{{post.permalink}}' ) ], [ 'dataType' => 'url' ] ),
								sf_prop( 'termsOfService', [ sf_text( '{{site.url}}terms/' ) ], [ 'dataType' => 'url' ] ),
								sf_prop( 'provider', [ sf_ref( 'yoast:organization' ) ] ),
							],
							[ 'placement' => 'graph' ]
						),
					],
				]
			),
			sf_prop(
				'potentialAction',
				[
					[
						'id'   => 'v_search',
						'kind' => 'node',
						'node' => sf_node(
							'search',
							'SearchAction',
							[
								sf_prop( 'target', [ sf_text( '{{site.url}}?s={search_term_string}' ) ] ),
								sf_prop( 'query-input', [ sf_text( 'required name=search_term_string' ) ] ),
							]
						),
					],
				]
			),
		],
		[ 'isMainEntity' => true ]
	),
	[ 'yoast' => [ 'suppressArticle' => true ] ]
);

// 5. A disabled template that must never appear.
$ids['disabled'] = sf_seed_template(
	'Disabled sample',
	sf_node( 'root', 'Thing', [ sf_prop( 'name', [ sf_text( 'never' ) ] ) ] ),
	[],
	false
);

// 6. Product-category template (term rule) that also references the organization template.
$ids['collection'] = sf_seed_template(
	'Shoe collection note',
	sf_node(
		'root',
		'CollectionPage',
		[
			sf_prop( 'name', [ sf_text( 'Shoes at {{site.name}}' ) ] ),
			sf_prop( 'publisher', [ sf_ref( 'template:' . $ids['org'] ) ] ),
		]
	)
);

RulesStore::update(
	[
		'post_types' => [
			'product' => [ $ids['product'], $ids['disabled'] ],
		],
		'taxonomies' => [
			'category'    => [
				'templates' => [],
				'terms'     => [ (int) ( get_term_by( 'slug', 'recipes', 'category' )->term_id ?? 0 ) => [ 'add' => [ $ids['recipe'] ], 'exclude' => [] ] ],
			],
			'product_cat' => [
				'templates' => [],
				'terms'     => [
					(int) ( get_term_by( 'slug', 'shoes', 'product_cat' )->term_id ?? 0 ) => [ 'add' => [ $ids['collection'] ], 'exclude' => [] ],
					(int) ( get_term_by( 'slug', 'hats', 'product_cat' )->term_id ?? 0 )  => [ 'add' => [], 'exclude' => [ $ids['product'] ] ],
				],
			],
		],
		'archives'   => [
			'front_page' => [ $ids['org'] ],
			'post_type'  => [ 'product' => [ $ids['collection'] ] ],
			'taxonomy'   => [ 'product_cat' => [ $ids['collection'] ] ],
			'search'     => [],
		],
	]
);

// Per-post: the "sun hat" product re-enables the product template that its term excluded; mystery box disables inherited.
PostAssignments::save( $GLOBALS['sf_seed']['product_hat'], [ 'add' => [ $ids['product'] ] ] );
PostAssignments::save( $GLOBALS['sf_seed']['product_nosku'], [ 'disableInherited' => true, 'add' => [ $ids['faq'] ] ] );
PostAssignments::save( $GLOBALS['sf_seed']['page_about'], [ 'add' => [ $ids['org'] ] ] );
PostAssignments::save( $GLOBALS['sf_seed']['post_api'], [ 'add' => [ $ids['api'] ] ] );

$GLOBALS['sf_seed_templates'] = $ids;
echo 'Templates: ' . wp_json_encode( $ids ) . "\n";
