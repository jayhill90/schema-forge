import { __, sprintf } from '@wordpress/i18n';
import {
	hasType,
	getAllProperties,
	typeFitsProperty,
	isEnumeration,
	getEnumMembers,
	getRange,
	isDataType,
	isSuperseded,
	isPropertySuperseded,
	supersededBy,
} from '../../shared/vocab';
import { hasTokens } from '../../shared/tokens/parse';
import { graphNodes } from '../../shared/tree/selectors';

/**
 * Client-side validation of the normalized tree against the vocabulary.
 *
 * @param {Object}  core                     Compiled vocabulary.
 * @param {Object}  tree                     Normalized builder tree (see src/shared/tree/normalize.js).
 * @param {Object}  [options]
 * @param {boolean} [options.hasYoast]       Whether Yoast SEO is active (changes which references resolve).
 * @param {string}  [options.siteRepresents] `organization`, `person` or `none` (standalone mode).
 * @return {Array<{level:'error'|'warning'|'info', message:string, selection?:Object}>} Issues, in tree order.
 */
export function validateTree(
	core,
	tree,
	{ hasYoast = false, siteRepresents = 'organization' } = {}
) {
	const issues = [];
	if ( ! tree.rootId ) {
		issues.push( {
			level: 'error',
			message: __(
				'Pick a root type to start the template.',
				'schema-forge'
			),
		} );
		return issues;
	}
	const graphIds = new Set( graphNodes( tree ).map( ( n ) => n.id ) );

	for ( const node of Object.values( tree.nodes ) ) {
		const sel = { kind: 'node', id: node.id };
		if ( ! hasType( core, node.type ) ) {
			issues.push( {
				level: 'warning',
				message: sprintf(
					/* translators: %s type */ __(
						'“%s” is not a schema.org type. It will still be output as written.',
						'schema-forge'
					),
					node.type
				),
				selection: sel,
			} );
		} else if ( isSuperseded( core, node.type ) ) {
			issues.push( {
				level: 'info',
				message: sprintf(
					/* translators: 1: type 2: replacement */ __(
						'%1$s is deprecated on schema.org. Consider %2$s.',
						'schema-forge'
					),
					node.type,
					supersededBy( core, node.type ).join( ', ' ) || '—'
				),
				selection: sel,
			} );
		}
		if ( ! node.propertyIds.length ) {
			issues.push( {
				level: 'warning',
				message: sprintf(
					/* translators: %s type */ __(
						'%s has no properties.',
						'schema-forge'
					),
					node.type
				),
				selection: sel,
			} );
		}
		const known = new Set(
			getAllProperties( core, node.type ).map( ( p ) => p.name )
		);
		const seen = new Set();
		for ( const pid of node.propertyIds ) {
			const property = tree.properties[ pid ];
			if ( ! property ) {
				continue;
			}
			const psel = { kind: 'property', id: pid };
			if ( ! property.name ) {
				issues.push( {
					level: 'error',
					message: sprintf(
						/* translators: %s type */ __(
							'A property on %s has no name.',
							'schema-forge'
						),
						node.type
					),
					selection: psel,
				} );
				continue;
			}
			if ( ! /^[a-z][A-Za-z0-9_-]*$/.test( property.name ) ) {
				issues.push( {
					level: 'error',
					message: sprintf(
						/* translators: %s property */ __(
							'“%s” is not a valid property name (lowerCamelCase, hyphens allowed).',
							'schema-forge'
						),
						property.name
					),
					selection: psel,
				} );
			} else if (
				hasType( core, node.type ) &&
				! known.has( property.name )
			) {
				issues.push( {
					level: 'warning',
					message: sprintf(
						/* translators: 1: property 2: type */ __(
							'“%1$s” is not an expected property of %2$s.',
							'schema-forge'
						),
						property.name,
						node.type
					),
					selection: psel,
				} );
			} else if ( isPropertySuperseded( core, property.name ) ) {
				issues.push( {
					level: 'info',
					message: sprintf(
						/* translators: 1: property 2: replacement */ __(
							'“%1$s” is deprecated on schema.org. Consider “%2$s”.',
							'schema-forge'
						),
						property.name,
						supersededBy( core, property.name ).join( ', ' ) || '—'
					),
					selection: psel,
				} );
			}
			if ( seen.has( property.name ) ) {
				issues.push( {
					level: 'warning',
					message: sprintf(
						/* translators: 1: property 2: type */ __(
							'“%1$s” appears more than once on %2$s; values will be merged into a list.',
							'schema-forge'
						),
						property.name,
						node.type
					),
					selection: psel,
				} );
			}
			seen.add( property.name );
			if ( ! property.valueIds.length ) {
				issues.push( {
					level:
						property.onEmpty === 'dropNode' ? 'error' : 'warning',
					message:
						property.onEmpty === 'dropNode'
							? sprintf(
									/* translators: %s property */ __(
										'“%s” is required but has no values, so its node will always be dropped.',
										'schema-forge'
									),
									property.name
								)
							: sprintf(
									/* translators: %s property */ __(
										'“%s” has no values and will be omitted.',
										'schema-forge'
									),
									property.name
								),
					selection: psel,
				} );
			}
			if ( property.onEmpty === 'fallback' && ! property.fallback ) {
				issues.push( {
					level: 'warning',
					message: sprintf(
						/* translators: %s property */ __(
							'“%s” uses a fallback but the fallback text is empty.',
							'schema-forge'
						),
						property.name
					),
					selection: psel,
				} );
			}
			const enumType = getRange( core, property.name ).find( ( r ) =>
				isEnumeration( core, r )
			);
			for ( const vid of property.valueIds ) {
				const value = tree.values[ vid ];
				if ( ! value ) {
					continue;
				}
				const vsel = { kind: 'value', id: vid };
				if ( value.kind === 'text' ) {
					if ( ! value.value ) {
						issues.push( {
							level: 'warning',
							message: sprintf(
								/* translators: %s property */ __(
									'An empty text value on “%s” will be dropped.',
									'schema-forge'
								),
								property.name
							),
							selection: vsel,
						} );
					} else if ( enumType && ! hasTokens( value.value ) ) {
						const members = getEnumMembers( core, enumType );
						const plain = value.value.replace(
							/^https?:\/\/schema\.org\//,
							''
						);
						if ( members.length && ! members.includes( plain ) ) {
							issues.push( {
								level: 'info',
								message: sprintf(
									/* translators: 1: value 2: enumeration */ __(
										'“%1$s” is not a member of %2$s.',
										'schema-forge'
									),
									value.value,
									enumType
								),
								selection: vsel,
							} );
						}
					}
				} else if ( value.kind === 'node' || value.kind === 'repeat' ) {
					if ( ! value.nodeId ) {
						issues.push( {
							level: 'error',
							message: sprintf(
								/* translators: %s property */ __(
									'Choose a type for the nested node on “%s”.',
									'schema-forge'
								),
								property.name
							),
							selection: vsel,
						} );
					} else {
						const child = tree.nodes[ value.nodeId ];
						if (
							child &&
							hasType( core, child.type ) &&
							! typeFitsProperty(
								core,
								property.name,
								child.type
							)
						) {
							issues.push( {
								level: 'warning',
								message: sprintf(
									/* translators: 1: type 2: property 3: expected */ __(
										'%1$s is not an expected type for “%2$s” (expected: %3$s).',
										'schema-forge'
									),
									child.type,
									property.name,
									getRange( core, property.name )
										.filter(
											( r ) => ! isDataType( core, r )
										)
										.join( ', ' )
								),
								selection: { kind: 'node', id: child.id },
							} );
						}
					}
					if ( value.kind === 'repeat' && ! value.source ) {
						issues.push( {
							level: 'error',
							message: sprintf(
								/* translators: %s property */ __(
									'The repeat on “%s” has no source token.',
									'schema-forge'
								),
								property.name
							),
							selection: vsel,
						} );
					}
				} else if ( value.kind === 'ref' ) {
					if ( ! value.target ) {
						issues.push( {
							level: 'error',
							message: sprintf(
								/* translators: %s property */ __(
									'The reference on “%s” has no target.',
									'schema-forge'
								),
								property.name
							),
							selection: vsel,
						} );
					} else if (
						value.target.startsWith( 'node:' ) &&
						! graphIds.has( value.target.slice( 5 ) )
					) {
						issues.push( {
							level: 'error',
							message: sprintf(
								/* translators: %s property */ __(
									'The node reference on “%s” points to a node that is not placed in the graph.',
									'schema-forge'
								),
								property.name
							),
							selection: vsel,
						} );
					} else if (
						/^(yoast|core):organization$/.test( value.target ) &&
						siteRepresents === 'person' &&
						! hasYoast
					) {
						issues.push( {
							level: 'warning',
							message: __(
								'The site represents a person, so the organization reference will never resolve.',
								'schema-forge'
							),
							selection: vsel,
						} );
					} else if (
						/^(yoast|core):(breadcrumb|article)$/.test(
							value.target
						) &&
						! hasYoast
					) {
						issues.push( {
							level: 'warning',
							message: __(
								'Breadcrumb and Article references only resolve when Yoast SEO is active.',
								'schema-forge'
							),
							selection: vsel,
						} );
					}
				}
			}
		}
	}
	return issues;
}
