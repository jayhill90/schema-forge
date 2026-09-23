#!/usr/bin/env node
/**
 * Validate a Schema Forge import JSON file against the plugin's sanitizer rules
 * and the bundled schema.org vocabulary. Exit code 1 on errors.
 *
 *   node validate.mjs template.json [--json]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Write a line to stdout / stderr (this is a CLI script).
 *
 * @param {string} line Text to print.
 */
const printOut = ( line ) => process.stdout.write( `${ line }\n` );
const printErr = ( line ) => process.stderr.write( `${ line }\n` );

const file = process.argv[ 2 ];
if ( ! file ) {
	printErr( 'usage: validate.mjs <template.json> [--json]' );
	process.exit( 1 );
}
const asJson = process.argv.includes( '--json' );
const here = path.dirname( fileURLToPath( import.meta.url ) );
const vocab = JSON.parse(
	await readFile(
		path.join( here, '..', 'assets', 'schemaorg.core.json' ),
		'utf8'
	)
);

const TYPE_RE = /^[A-Za-z0-9][A-Za-z0-9_]{0,80}$/;
const PROP_RE = /^[a-z][A-Za-z0-9_-]{0,80}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const DATA_TYPES = [
	'auto',
	'text',
	'url',
	'number',
	'integer',
	'boolean',
	'date',
	'datetime',
	'json',
];
const ON_EMPTY = [ 'drop', 'fallback', 'dropNode' ];
const KINDS = [ 'text', 'node', 'ref', 'repeat' ];
const REF_RE =
	/^(yoast|core):(webpage|website|organization|person|publisher|primaryimage|breadcrumb|author|article)$|^node:[A-Za-z0-9_-]{1,40}$|^template:\d{1,10}$/;
const TOKEN_RE =
	/\{\{\s*([a-z][a-z0-9_]*)\.([^\s|}]+)\s*(?:\|\s*([^}]*?))?\s*\}\}/gi;
const NAMESPACES = [ 'post', 'site', 'meta', 'acf', 'terms', 'item' ];
const MAX_DEPTH = 12,
	MAX_NODES = 500;

const ancestors = ( t, seen = new Set() ) => {
	for ( const s of vocab.types[ t ]?.s ?? [] ) {
		if ( ! seen.has( s ) ) {
			seen.add( s );
			ancestors( s, seen );
		}
	}
	return seen;
};
const propsOf = ( t ) => {
	const out = new Set( vocab.types[ t ]?.p ?? [] );
	for ( const a of ancestors( t ) ) {
		( vocab.types[ a ]?.p ?? [] ).forEach( ( p ) => out.add( p ) );
	}
	return out;
};
const isSubtype = ( c, p ) => c === p || ancestors( c ).has( p );
const isDataType = ( t ) => vocab.datatypes.includes( t );

function validateTemplate( tpl, label ) {
	const errors = [],
		warnings = [],
		info = [];
	const ids = new Set();
	const graphIds = new Set();
	const refs = [];
	let nodeCount = 0;
	const err = ( m ) => errors.push( `${ label }: ${ m }` );
	const warn = ( m ) => warnings.push( `${ label }: ${ m }` );
	const note = ( m ) => info.push( `${ label }: ${ m }` );

	if ( ! tpl || typeof tpl !== 'object' ) {
		err( 'template must be an object' );
		return { errors, warnings, info };
	}
	if ( ! tpl.name ) {
		warn( 'missing "name" (will import as "Imported template")' );
	}
	if ( ! tpl.tree || typeof tpl.tree !== 'object' ) {
		err( 'missing "tree" object' );
		return { errors, warnings, info };
	}
	if ( ! tpl.tree.root ) {
		err( 'tree.root is missing — the builder needs a root node' );
		return { errors, warnings, info };
	}

	const takeId = ( id, what ) => {
		if ( id === undefined ) {
			warn(
				`${ what } has no id (one will be generated; node: references cannot target it)`
			);
			return;
		}
		if ( ! ID_RE.test( String( id ) ) ) {
			err(
				`${ what } id "${ id }" is invalid (letters, digits, _ and -, max 40)`
			);
			return;
		}
		if ( ids.has( id ) ) {
			err( `duplicate id "${ id }" (${ what })` );
			return;
		}
		ids.add( id );
	};

	const checkTokens = ( s, where ) => {
		for ( const m of String( s ).matchAll( TOKEN_RE ) ) {
			if ( ! NAMESPACES.includes( m[ 1 ].toLowerCase() ) ) {
				warn(
					`${ where }: unknown token namespace "${ m[ 1 ] }" in ${ m[ 0 ] } (known: ${ NAMESPACES.join( ', ' ) })`
				);
			}
		}
		if ( /\{\{[^}]*$/.test( s ) || /^[^{]*\}\}/.test( s ) ) {
			warn( `${ where }: unbalanced {{ }} in "${ s }"` );
		}
	};

	function node( n, depth, isRoot, pathLabel, inRepeat ) {
		if ( ++nodeCount > MAX_NODES ) {
			err( `more than ${ MAX_NODES } nodes` );
			return;
		}
		if ( depth > MAX_DEPTH ) {
			err( `${ pathLabel }: nesting deeper than ${ MAX_DEPTH }` );
			return;
		}
		if ( ! n || typeof n !== 'object' ) {
			err( `${ pathLabel }: node must be an object` );
			return;
		}
		takeId( n.id, `node ${ pathLabel }` );
		const type = String( n.type ?? '' );
		if ( ! TYPE_RE.test( type ) ) {
			err( `${ pathLabel }: invalid type "${ type }"` );
			return;
		}
		if ( ! vocab.types[ type ] ) {
			warn(
				`${ pathLabel }: "${ type }" is not a schema.org type (allowed, but check spelling)`
			);
		} else if ( vocab.types[ type ].x ) {
			warn(
				`${ pathLabel }: "${ type }" is deprecated on schema.org${ vocab.types[ type ].sb?.length ? ` — use ${ vocab.types[ type ].sb.join( '/' ) }` : '' }`
			);
		}
		const opts = n.options ?? {};
		const placement = isRoot ? 'graph' : ( opts.placement ?? 'inline' );
		if ( ! [ 'inline', 'graph' ].includes( placement ) ) {
			err( `${ pathLabel }: options.placement must be inline or graph` );
		}
		if ( placement === 'graph' && n.id ) {
			graphIds.add( n.id );
		}
		if ( ! isRoot && opts.isMainEntity ) {
			warn(
				`${ pathLabel }: isMainEntity only applies to the root node`
			);
		}
		for ( const x of opts.extraTypes ?? [] ) {
			if ( ! TYPE_RE.test( String( x ) ) ) {
				err( `${ pathLabel }: invalid extraTypes entry "${ x }"` );
			}
		}
		if ( opts.idOverride ) {
			checkTokens( opts.idOverride, `${ pathLabel } idOverride` );
		}
		const props = n.properties ?? [];
		if ( ! Array.isArray( props ) ) {
			err( `${ pathLabel }: properties must be an array` );
			return;
		}
		if ( ! props.length ) {
			warn( `${ pathLabel }: ${ type } has no properties` );
		}
		const known = vocab.types[ type ] ? propsOf( type ) : null;
		const seen = new Set();
		let hasRequired = false;
		for ( const p of props ) {
			const name = String( p?.name ?? '' );
			const pl = `${ pathLabel }.${ name || '?' }`;
			takeId( p?.id, `property ${ pl }` );
			if ( ! PROP_RE.test( name ) ) {
				err(
					`${ pl }: invalid property name "${ name }" (lowerCamelCase; hyphen allowed; no @id/@type)`
				);
				continue;
			}
			if ( known && ! known.has( name ) ) {
				warn(
					`${ pl }: "${ name }" is not an expected property of ${ type }`
				);
			} else if ( vocab.props[ name ]?.x ) {
				warn(
					`${ pl }: "${ name }" is deprecated on schema.org${ vocab.props[ name ].sb?.length ? ` — use ${ vocab.props[ name ].sb.join( '/' ) }` : '' }`
				);
			}
			if ( seen.has( name ) ) {
				note(
					`${ pl }: property repeated; values will merge into a list`
				);
			}
			seen.add( name );
			if ( p.dataType && ! DATA_TYPES.includes( p.dataType ) ) {
				err( `${ pl }: invalid dataType "${ p.dataType }"` );
			}
			if ( p.onEmpty && ! ON_EMPTY.includes( p.onEmpty ) ) {
				err( `${ pl }: invalid onEmpty "${ p.onEmpty }"` );
			}
			if ( p.onEmpty === 'dropNode' ) {
				hasRequired = true;
			}
			if ( p.onEmpty === 'fallback' && ! p.fallback ) {
				warn(
					`${ pl }: onEmpty is fallback but fallback text is empty`
				);
			}
			if ( p.fallback ) {
				checkTokens( p.fallback, `${ pl } fallback` );
			}
			const values = p.values ?? [];
			if ( ! Array.isArray( values ) ) {
				err( `${ pl }: values must be an array` );
				continue;
			}
			if ( ! values.length ) {
				warn(
					`${ pl }: no values — property will always be omitted${ p.onEmpty === 'dropNode' ? ' and the node always dropped' : '' }`
				);
			}
			const range = ( vocab.props[ name ]?.r ?? [] ).filter(
				( r ) => ! isDataType( r )
			);
			for ( const v of values ) {
				takeId( v?.id, `value on ${ pl }` );
				const kind = v?.kind ?? 'text';
				if ( ! KINDS.includes( kind ) ) {
					err( `${ pl }: invalid value kind "${ kind }"` );
					continue;
				}
				if ( kind === 'text' ) {
					if (
						v.value === undefined ||
						String( v.value ).trim() === ''
					) {
						warn( `${ pl }: empty text value` );
					} else {
						checkTokens( v.value, pl );
						if ( /\{\{\s*item\./i.test( v.value ) && ! inRepeat ) {
							warn(
								`${ pl }: {{item.*}} used outside a repeat — it will always be empty`
							);
						}
					}
				} else if ( kind === 'ref' ) {
					if ( ! REF_RE.test( String( v.target ?? '' ) ) ) {
						err( `${ pl }: invalid ref target "${ v.target }"` );
					} else if ( String( v.target ).startsWith( 'node:' ) ) {
						refs.push( { target: v.target.slice( 5 ), where: pl } );
					}
					if (
						range.length &&
						! range.some( ( r ) =>
							[
								'Thing',
								'Organization',
								'Person',
								'ImageObject',
								'WebPage',
								'WebSite',
								'BreadcrumbList',
								'Article',
								'CreativeWork',
							].some(
								( t ) => isSubtype( t, r ) || isSubtype( r, t )
							)
						)
					) {
						note(
							`${ pl }: expects ${ range.join( '/' ) }; make sure the referenced entity fits`
						);
					}
				} else if ( kind === 'node' || kind === 'repeat' ) {
					if ( kind === 'repeat' ) {
						if ( ! v.source ) {
							err( `${ pl }: repeat has no source token` );
						} else {
							checkTokens( v.source, `${ pl } repeat source` );
							if ( ! /\{\{/.test( v.source ) ) {
								warn(
									`${ pl }: repeat source "${ v.source }" is not a token`
								);
							}
						}
					}
					if ( ! v.node || typeof v.node !== 'object' ) {
						err( `${ pl }: ${ kind } value has no node` );
						continue;
					}
					const childType = String( v.node.type ?? '' );
					if (
						range.length &&
						vocab.types[ childType ] &&
						! range.includes( 'Thing' ) &&
						! range.some( ( r ) => isSubtype( childType, r ) )
					) {
						warn(
							`${ pl }: ${ childType } is not an expected type for "${ name }" (expected ${ range.join( ', ' ) })`
						);
					}
					node(
						v.node,
						depth + 1,
						false,
						`${ pl }>${ childType || '?' }`,
						inRepeat || kind === 'repeat'
					);
				}
			}
		}
		if ( isRoot && ! hasRequired ) {
			note(
				`root ${ type } has no required (onEmpty: dropNode) property — pages missing data will still emit a node`
			);
		}
	}

	node(
		tpl.tree.root,
		0,
		true,
		String( tpl.tree.root.type ?? 'root' ),
		false
	);
	for ( const r of refs ) {
		if ( ! graphIds.has( r.target ) ) {
			err(
				`${ r.where }: node:${ r.target } does not point at a node with placement "graph"`
			);
		}
	}

	const s = tpl.settings ?? {};
	if ( s.yoast?.webPageType && ! TYPE_RE.test( s.yoast.webPageType ) ) {
		err(
			`settings.yoast.webPageType "${ s.yoast.webPageType }" is invalid`
		);
	} else if (
		s.yoast?.webPageType &&
		vocab.types[ s.yoast.webPageType ] &&
		! isSubtype( s.yoast.webPageType, 'WebPage' )
	) {
		warn(
			`settings.yoast.webPageType "${ s.yoast.webPageType }" is not a WebPage subtype`
		);
	}
	if (
		tpl.tree.root.options?.isMainEntity &&
		s.yoast?.suppressArticle !== true &&
		! isSubtype( String( tpl.tree.root.type ), 'Article' )
	) {
		note(
			"root is the main entity but Yoast's Article node is not suppressed; set settings.yoast.suppressArticle: true if this template describes posts"
		);
	}

	return { errors, warnings, info, nodeCount };
}

let raw;
try {
	raw = JSON.parse( await readFile( file, 'utf8' ) );
} catch ( error ) {
	printErr( `INVALID: cannot read ${ file } as JSON (${ error.message })` );
	process.exit( 1 );
}
const templates = Array.isArray( raw ) ? raw : [ raw ];
const results = templates.map( ( t, i ) =>
	validateTemplate( t, t?.name ? `"${ t.name }"` : `template[${ i }]` )
);
const errors = results.flatMap( ( r ) => r.errors ),
	warnings = results.flatMap( ( r ) => r.warnings ),
	info = results.flatMap( ( r ) => r.info );

if ( asJson ) {
	printOut(
		JSON.stringify(
			{
				ok: errors.length === 0,
				templates: templates.length,
				errors,
				warnings,
				info,
			},
			null,
			2
		)
	);
} else {
	for ( const e of errors ) {
		printOut( `ERROR   ${ e }` );
	}
	for ( const w of warnings ) {
		printOut( `WARNING ${ w }` );
	}
	for ( const n of info ) {
		printOut( `INFO    ${ n }` );
	}
	printOut(
		`${ errors.length ? 'INVALID' : 'OK' }: ${ templates.length } template(s), ${ results.reduce( ( a, r ) => a + ( r.nodeCount ?? 0 ), 0 ) } nodes, ${ errors.length } errors, ${ warnings.length } warnings`
	);
}
process.exit( errors.length ? 1 : 0 );
