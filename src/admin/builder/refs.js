import { __ } from '@wordpress/i18n';

export const CORE_REFS = [
	{ target: 'yoast:webpage', label: __( 'This page (WebPage)', 'schema-forge' ) },
	{ target: 'yoast:website', label: __( 'The site (WebSite)', 'schema-forge' ) },
	{ target: 'yoast:organization', label: __( 'Site organization', 'schema-forge' ) },
	{ target: 'yoast:person', label: __( 'Site person', 'schema-forge' ) },
	{ target: 'yoast:publisher', label: __( 'Publisher (organization or person)', 'schema-forge' ) },
	{ target: 'yoast:author', label: __( 'Post author', 'schema-forge' ) },
	{ target: 'yoast:primaryimage', label: __( 'Primary image', 'schema-forge' ) },
	{ target: 'yoast:breadcrumb', label: __( 'Breadcrumb list (Yoast)', 'schema-forge' ) },
	{ target: 'yoast:article', label: __( 'Article (Yoast)', 'schema-forge' ) },
];

export function describeRef( target, tree, templates ) {
	if ( ! target ) {
		return __( '(none)', 'schema-forge' );
	}
	const core = CORE_REFS.find( ( r ) => r.target === target || r.target.replace( 'yoast:', 'core:' ) === target );
	if ( core ) {
		return core.label;
	}
	if ( target.startsWith( 'node:' ) ) {
		const node = tree.nodes[ target.slice( 5 ) ];
		return node ? `${ node.type } (${ __( 'node in this template', 'schema-forge' ) })` : __( 'Missing node', 'schema-forge' );
	}
	if ( target.startsWith( 'template:' ) ) {
		const id = Number( target.slice( 9 ) );
		const t = ( templates || [] ).find( ( x ) => x.id === id );
		return t ? `${ t.name } (${ __( 'template', 'schema-forge' ) })` : __( 'Missing template', 'schema-forge' );
	}
	return target;
}
