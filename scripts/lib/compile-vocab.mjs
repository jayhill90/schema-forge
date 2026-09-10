/**
 * Compile the schema.org JSON-LD release into compact JSON assets.
 *
 * Output shape (core):
 * {
 *   v: "29.2",
 *   types: { Product: { s: ["Thing"], p: ["sku", ...], e: 0|1, pd: 0|1, x?: 1, sb?: ["Replacement"] } },
 *   props: { sku: { r: ["Text"], pd: 0|1, sub: ["identifier"], x?: 1, sb?: ["replacement"], ext?: 1 } },
 *   enums: { DayOfWeek: ["Monday", ...] },
 *   datatypes: ["Text", "URL", ...]
 * }
 * `e` marks enumeration types (subclasses of Enumeration), `pd` marks pending,
 * `x` marks superseded (deprecated) terms with `sb` naming their replacements,
 * `ext` marks widely used extension properties that are not in the vocabulary.
 * Inherited properties are NOT expanded here; consumers walk `s`.
 */

const SCHEMA_PREFIX = 'schema:';

export const EXTENSION_PROPERTIES = [
	{
		name: 'query-input',
		domains: [ 'SearchAction' ],
		range: [ 'Text', 'PropertyValueSpecification' ],
		description: 'Sitelinks search box input specification, e.g. "required name=search_term_string". Used together with target on a SearchAction; not part of the core vocabulary but required by Google.',
	},
];

function ids( value ) {
	if ( ! value ) {
		return [];
	}
	const list = Array.isArray( value ) ? value : [ value ];
	return list
		.map( ( v ) => ( typeof v === 'string' ? v : v && v[ '@id' ] ) )
		.filter( Boolean );
}

function localName( id ) {
	return id.startsWith( SCHEMA_PREFIX ) ? id.slice( SCHEMA_PREFIX.length ) : null;
}

function text( value ) {
	if ( ! value ) {
		return '';
	}
	if ( typeof value === 'string' ) {
		return value;
	}
	if ( typeof value === 'object' && '@value' in value ) {
		return String( value[ '@value' ] );
	}
	return '';
}

export function cleanComment( raw, max = 400 ) {
	let s = text( raw );
	s = s.replace( /\[\[([^\]]+)\]\]/g, '$1' ); // [[Term]] links
	s = s.replace( /\[([^\]]+)\]\([^)]*\)/g, '$1' ); // markdown links
	s = s.replace( /<[^>]+>/g, '' );
	s = s
		.replace( /&#x2014;|&mdash;/g, '—' )
		.replace( /&amp;/g, '&' )
		.replace( /&lt;/g, '<' )
		.replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' )
		.replace( /&#39;/g, "'" )
		.replace( /\\n/g, ' ' )
		.replace( /\s+/g, ' ' )
		.trim();
	if ( s.length > max ) {
		s = s.slice( 0, max - 1 ).replace( /\s+\S*$/, '' ) + '…';
	}
	return s;
}

function partOf( entry ) {
	return ids( entry[ 'schema:isPartOf' ] );
}

/**
 * @param {object} jsonld            Parsed schema.org JSON-LD document.
 * @param {object} [options]
 * @param {string} [options.version] Version label to embed.
 * @param {boolean} [options.includeSuperseded]
 * @param {boolean} [options.includeAttic]
 */
export function compileVocab( jsonld, options = {} ) {
	const { version = 'latest', includeSuperseded = true, includeAttic = false } = options;
	const graph = Array.isArray( jsonld?.[ '@graph' ] ) ? jsonld[ '@graph' ] : [];

	const types = {};
	const props = {};
	const descriptions = { types: {}, props: {}, enums: {} };
	const enumMembers = {}; // enumType -> [member]
	const memberEntries = [];

	const isExcluded = ( entry ) => {
		if ( ! includeSuperseded && entry[ 'schema:supersededBy' ] ) {
			return true;
		}
		// Terms that are both superseded and never attached to a live type are still kept; they are flagged below.
		if ( ! includeAttic && partOf( entry ).some( ( p ) => p.includes( 'attic.schema.org' ) ) ) {
			return true;
		}
		return false;
	};

	for ( const entry of graph ) {
		const name = localName( String( entry[ '@id' ] || '' ) );
		if ( ! name ) {
			continue;
		}
		const entryTypes = ids( entry[ '@type' ] );
		const pending = partOf( entry ).some( ( p ) => p.includes( 'pending.schema.org' ) ) ? 1 : 0;

		if ( entryTypes.includes( 'rdfs:Class' ) ) {
			if ( isExcluded( entry ) ) {
				continue;
			}
			const supers = ids( entry[ 'rdfs:subClassOf' ] ).map( localName ).filter( Boolean );
			types[ name ] = {
				s: supers,
				p: [],
				e: 0,
				pd: pending,
				dt: entryTypes.includes( 'schema:DataType' ) ? 1 : 0,
			};
			const replacedBy = ids( entry[ 'schema:supersededBy' ] ).map( localName ).filter( Boolean );
			if ( entry[ 'schema:supersededBy' ] ) {
				types[ name ].x = 1;
				types[ name ].sb = replacedBy;
			}
			const c = cleanComment( entry[ 'rdfs:comment' ] );
			if ( c ) {
				descriptions.types[ name ] = c;
			}
			continue;
		}

		if ( entryTypes.includes( 'rdf:Property' ) ) {
			if ( isExcluded( entry ) ) {
				continue;
			}
			const domains = ids( entry[ 'schema:domainIncludes' ] ).map( localName ).filter( Boolean );
			const ranges = ids( entry[ 'schema:rangeIncludes' ] ).map( localName ).filter( Boolean );
			const sub = ids( entry[ 'rdfs:subPropertyOf' ] ).map( localName ).filter( Boolean );
			props[ name ] = { r: ranges, pd: pending };
			if ( sub.length ) {
				props[ name ].sub = sub;
			}
			if ( entry[ 'schema:supersededBy' ] ) {
				props[ name ].x = 1;
				props[ name ].sb = ids( entry[ 'schema:supersededBy' ] ).map( localName ).filter( Boolean );
			}
			props[ name ].__domains = domains;
			const c = cleanComment( entry[ 'rdfs:comment' ] );
			if ( c ) {
				descriptions.props[ name ] = c;
			}
			continue;
		}

		// Enumeration members are typed by their enumeration class.
		const enumTypes = entryTypes.map( localName ).filter( Boolean );
		if ( enumTypes.length ) {
			if ( isExcluded( entry ) ) {
				continue;
			}
			memberEntries.push( { name, enumTypes, entry } );
		}
	}

	// Widely used properties that are not part of the vocabulary but that search engines expect.
	for ( const ext of EXTENSION_PROPERTIES ) {
		if ( ! props[ ext.name ] && ext.domains.some( ( d ) => types[ d ] ) ) {
			props[ ext.name ] = { r: ext.range, pd: 0, ext: 1, __domains: ext.domains };
			descriptions.props[ ext.name ] = ext.description;
		}
	}

	// Attach properties to their domain types.
	for ( const [ propName, prop ] of Object.entries( props ) ) {
		for ( const domain of prop.__domains ) {
			if ( types[ domain ] ) {
				types[ domain ].p.push( propName );
			}
		}
		delete prop.__domains;
	}

	// Mark enumerations and data types via ancestry.
	const ancestors = ( name, seen = new Set() ) => {
		const t = types[ name ];
		if ( ! t ) {
			return seen;
		}
		for ( const s of t.s ) {
			if ( ! seen.has( s ) ) {
				seen.add( s );
				ancestors( s, seen );
			}
		}
		return seen;
	};

	const explicitDataTypes = new Set(
		Object.entries( types ).filter( ( [ , t ] ) => t.dt ).map( ( [ name ] ) => name )
	);
	const datatypes = [];
	for ( const [ name, t ] of Object.entries( types ) ) {
		const anc = ancestors( name );
		if ( name === 'Enumeration' || anc.has( 'Enumeration' ) ) {
			t.e = 1;
		}
		if ( explicitDataTypes.has( name ) || [ ...anc ].some( ( a ) => explicitDataTypes.has( a ) ) ) {
			datatypes.push( name );
		}
	}
	for ( const t of Object.values( types ) ) {
		delete t.dt;
	}
	// DataType itself is a meta type; drop from datatypes if present.
	const dtSet = new Set( datatypes.filter( ( d ) => d !== 'DataType' ) );

	for ( const { name, enumTypes, entry } of memberEntries ) {
		for ( const enumType of enumTypes ) {
			if ( ! types[ enumType ] ) {
				continue;
			}
			if ( ! enumMembers[ enumType ] ) {
				enumMembers[ enumType ] = [];
			}
			enumMembers[ enumType ].push( name );
		}
		const c = cleanComment( entry[ 'rdfs:comment' ] );
		if ( c ) {
			descriptions.enums[ name ] = c;
		}
	}

	for ( const t of Object.values( types ) ) {
		t.p.sort();
	}
	for ( const list of Object.values( enumMembers ) ) {
		list.sort();
	}

	const sortObject = ( obj ) =>
		Object.fromEntries( Object.keys( obj ).sort().map( ( k ) => [ k, obj[ k ] ] ) );

	const core = {
		v: version,
		types: sortObject( types ),
		props: sortObject( props ),
		enums: sortObject( enumMembers ),
		datatypes: [ ...dtSet ].sort(),
	};

	const meta = {
		version,
		generated: new Date().toISOString(),
		counts: {
			types: Object.keys( types ).length,
			props: Object.keys( props ).length,
			enums: Object.keys( enumMembers ).length,
			enumMembers: memberEntries.length,
			datatypes: dtSet.size,
			superseded: Object.values( types ).filter( ( t ) => t.x ).length + Object.values( props ).filter( ( p ) => p.x ).length,
		},
	};

	return { core, descriptions, meta };
}

/**
 * Convenience helpers mirrored on the client (src/shared/vocab).
 */
export function allProperties( core, typeName ) {
	const seen = new Set();
	const out = new Set();
	const walk = ( name ) => {
		if ( seen.has( name ) ) {
			return;
		}
		seen.add( name );
		const t = core.types[ name ];
		if ( ! t ) {
			return;
		}
		t.p.forEach( ( p ) => out.add( p ) );
		t.s.forEach( walk );
	};
	walk( typeName );
	return [ ...out ].sort();
}

export function isSubtypeOf( core, child, parent ) {
	if ( child === parent ) {
		return true;
	}
	const seen = new Set();
	const walk = ( name ) => {
		if ( seen.has( name ) ) {
			return false;
		}
		seen.add( name );
		const t = core.types[ name ];
		if ( ! t ) {
			return false;
		}
		return t.s.some( ( s ) => s === parent || walk( s ) );
	};
	return walk( child );
}
