#!/usr/bin/env node
/**
 * Print a structured digest of a web page (URL or local HTML file) as JSON.
 * No dependencies; tolerant regex-based extraction good enough to classify a page
 * and find the values that should become schema properties.
 *
 *   node inspect-page.mjs https://example.com/product/x > digest.json
 *   node inspect-page.mjs ./page.html
 */
import { readFile } from 'node:fs/promises';

/**
 * Write a line to stderr (this is a CLI script; the digest itself goes to stdout).
 *
 * @param {string} line Text to print.
 */
const printErr = ( line ) => process.stderr.write( `${ line }\n` );

const target = process.argv[ 2 ];
if ( ! target ) {
	printErr( 'usage: inspect-page.mjs <url-or-file>' );
	process.exit( 1 );
}

async function load( t ) {
	if ( /^https?:\/\//i.test( t ) ) {
		const res = await fetch( t, {
			headers: {
				'user-agent':
					'Mozilla/5.0 (compatible; SchemaForgeInspector/1.0)',
				accept: 'text/html,*/*',
			},
			redirect: 'follow',
		} );
		if ( ! res.ok ) {
			throw new Error( `HTTP ${ res.status } for ${ t }` );
		}
		return { html: await res.text(), url: res.url };
	}
	return { html: await readFile( t, 'utf8' ), url: `file://${ t }` };
}

const decode = ( s ) =>
	s
		.replace( /&nbsp;/g, ' ' )
		.replace( /&amp;/g, '&' )
		.replace( /&lt;/g, '<' )
		.replace( /&gt;/g, '>' )
		.replace( /&quot;/g, '"' )
		.replace( /&#39;|&apos;/g, "'" )
		.replace( /&#(\d+);/g, ( _, n ) => String.fromCodePoint( Number( n ) ) )
		.replace( /&#x([0-9a-f]+);/gi, ( _, h ) =>
			String.fromCodePoint( parseInt( h, 16 ) )
		);
const text = ( s ) =>
	decode( s.replace( /<[^>]+>/g, ' ' ) )
		.replace( /\s+/g, ' ' )
		.trim();
const attr = ( tag, name ) => {
	const m = tag.match(
		new RegExp(
			`\\s${ name }\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
			'i'
		)
	);
	return m ? decode( m[ 2 ] ?? m[ 3 ] ?? m[ 4 ] ?? '' ) : '';
};
const all = ( re, s ) => [ ...s.matchAll( re ) ];

let raw, url;
try {
	( { html: raw, url } = await load( target ) );
} catch ( e ) {
	printErr(
		`Could not load ${ target }: ${ e.cause?.code ?? e.message }. If it is a local site, make sure it is running; otherwise save the page as HTML and pass the file path.`
	);
	process.exit( 2 );
}
// Strip scripts/styles/svg for text analysis but keep ld+json first.
const jsonLd = all(
	/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
	raw
).map( ( m ) => {
	try {
		return JSON.parse( m[ 1 ].trim() );
	} catch ( e ) {
		return {
			parseError: String( e.message ),
			sample: m[ 1 ].trim().slice( 0, 200 ),
		};
	}
} );
const html = raw.replace( /<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, ' ' );

const head = html.match( /<head[\s\S]*?<\/head>/i )?.[ 0 ] ?? html;
const metas = all( /<meta\s[^>]*>/gi, head ).map( ( m ) => m[ 0 ] );
const metaBy = ( key, val ) =>
	metas
		.filter( ( t ) => attr( t, key ).toLowerCase() === val.toLowerCase() )
		.map( ( t ) => attr( t, 'content' ) )[ 0 ] ?? '';
const og = {};
for ( const t of metas ) {
	const p = attr( t, 'property' ) || attr( t, 'name' );
	if ( /^(og|twitter|article|product):/i.test( p ) ) {
		og[ p ] = attr( t, 'content' );
	}
}

const bodyTag = html.match( /<body[^>]*>/i )?.[ 0 ] ?? '';
const bodyClasses = attr( bodyTag, 'class' ).split( /\s+/ ).filter( Boolean );

// Main content region: prefer <main>, <article>, or common content wrappers.
const main =
	html.match( /<main[\s\S]*?<\/main>/i )?.[ 0 ] ??
	html.match( /<article[\s\S]*?<\/article>/i )?.[ 0 ] ??
	html.match( /<body[\s\S]*<\/body>/i )?.[ 0 ] ??
	html;

const headings = all( /<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/gi, main )
	.map( ( m ) => ( { level: m[ 1 ].toLowerCase(), text: text( m[ 2 ] ) } ) )
	.filter( ( h ) => h.text )
	.slice( 0, 60 );

// FAQ-like pairs: heading followed by a paragraph, or details/summary.
const faqPairs = [];
for ( const m of all(
	/<details[^>]*>[\s\S]*?<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi,
	main
) ) {
	faqPairs.push( {
		question: text( m[ 1 ] ),
		answer: text( m[ 2 ] ).slice( 0, 300 ),
	} );
}
for ( const m of all(
	/<(h[2-4])\b[^>]*>([\s\S]*?)<\/\1>\s*(?:<div[^>]*>\s*)*<p[^>]*>([\s\S]*?)<\/p>/gi,
	main
) ) {
	const q = text( m[ 2 ] );
	if (
		/\?\s*$|^(how|what|why|when|where|can|do|does|is|are|should)\b/i.test(
			q
		)
	) {
		faqPairs.push( {
			question: q,
			answer: text( m[ 3 ] ).slice( 0, 300 ),
		} );
	}
}

const mainText = text( main );
const prices = all(
	/(?:[$€£¥]\s?\d[\d,.]*|\d[\d,.]*\s?(?:USD|EUR|GBP|AUD|CAD)|\b\d+[.,]\d{2}\s?(?:€|£))/g,
	mainText
)
	.slice( 0, 12 )
	.map( ( m ) => ( {
		value: m[ 0 ],
		context: mainText.slice(
			Math.max( 0, m.index - 40 ),
			m.index + m[ 0 ].length + 40
		),
	} ) );
const dates = [
	...all( /<time\b[^>]*>([\s\S]*?)<\/time>/gi, main ).map( ( m ) => ( {
		text: text( m[ 1 ] ),
		datetime: attr( m[ 0 ], 'datetime' ),
	} ) ),
	...all( /\b\d{4}-\d{2}-\d{2}(?:T[\d:+\-Z.]+)?\b/g, mainText )
		.slice( 0, 6 )
		.map( ( m ) => ( { iso: m[ 0 ] } ) ),
].slice( 0, 12 );

const images = all( /<img\b[^>]*>/gi, main )
	.map( ( m ) => ( {
		src: attr( m[ 0 ], 'src' ) || attr( m[ 0 ], 'data-src' ),
		alt: attr( m[ 0 ], 'alt' ),
		width: attr( m[ 0 ], 'width' ),
		height: attr( m[ 0 ], 'height' ),
	} ) )
	.filter(
		( i ) => i.src && ! /^data:|\.svg(\?|$)|pixel|spacer|1x1/i.test( i.src )
	)
	.slice( 0, 12 );

const lists = all( /<(ol|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi, main )
	.map( ( m ) => ( {
		type: m[ 1 ].toLowerCase(),
		items: all( /<li\b[^>]*>([\s\S]*?)<\/li>/gi, m[ 2 ] )
			.map( ( li ) => text( li[ 1 ] ) )
			.filter( Boolean )
			.slice( 0, 30 ),
	} ) )
	.filter(
		( l ) => l.items.length >= 2 && l.items.every( ( i ) => i.length < 400 )
	)
	.filter(
		( l ) =>
			! l.items.every( ( i ) => i.length < 25 ) || l.items.length <= 15
	)
	.slice( 0, 15 );

const tables = all( /<table\b[^>]*>([\s\S]*?)<\/table>/gi, main )
	.map( ( m ) =>
		all( /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, m[ 1 ] )
			.map( ( tr ) =>
				all( /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi, tr[ 1 ] ).map(
					( td ) => text( td[ 1 ] )
				)
			)
			.filter( ( r ) => r.length )
			.slice( 0, 25 )
	)
	.filter( ( t ) => t.length )
	.slice( 0, 6 );

const codeBlocks = all( /<(pre|code)\b[^>]*>([\s\S]*?)<\/\1>/gi, main )
	.map( ( m ) => text( m[ 2 ] ) )
	.filter( ( c ) => c.length > 10 );

const anchors = all( /<a\b[^>]*>([\s\S]*?)<\/a>/gi, main ).map( ( m ) => ( {
	href: attr( m[ 0 ], 'href' ),
	text: text( m[ 1 ] ),
} ) );
let host = '';
try {
	host = new URL( url ).host;
} catch {
	// A local file path has no host.
}
const links = {
	internal: anchors.filter(
		( a ) =>
			a.href &&
			( a.href.startsWith( '/' ) || ( host && a.href.includes( host ) ) )
	).length,
	external: anchors.filter(
		( a ) => /^https?:/i.test( a.href ) && host && ! a.href.includes( host )
	).length,
	social: anchors
		.map( ( a ) => a.href )
		.filter( ( h ) =>
			/(facebook|instagram|twitter|x\.com|linkedin|youtube|tiktok|github|pinterest)\./i.test(
				h
			)
		)
		.slice( 0, 10 ),
	ctas: anchors
		.filter( ( a ) =>
			/\b(buy|add to cart|register|apply|download|install|book|order|enroll|get tickets|subscribe|sign up|get started)\b/i.test(
				a.text
			)
		)
		.map( ( a ) => a.text )
		.slice( 0, 10 ),
};

const endpoints = all(
	/\b(GET|POST|PUT|PATCH|DELETE)\s+\/[\w\-{}\/:.]+/g,
	mainText
)
	.map( ( m ) => m[ 0 ] )
	.slice( 0, 20 );

const digest = {
	url,
	title: text(
		head.match( /<title[^>]*>([\s\S]*?)<\/title>/i )?.[ 1 ] ?? ''
	),
	metaDescription: metaBy( 'name', 'description' ),
	canonical: attr(
		all( /<link\s[^>]*>/gi, head )
			.map( ( m ) => m[ 0 ] )
			.find( ( t ) => attr( t, 'rel' ).toLowerCase() === 'canonical' ) ??
			'',
		'href'
	),
	lang: attr( html.match( /<html[^>]*>/i )?.[ 0 ] ?? '', 'lang' ),
	generator: metaBy( 'name', 'generator' ),
	og,
	bodyClasses,
	wordpressHints: {
		isWordPress:
			/wp-content|wp-includes|wp-json/i.test( raw ) ||
			/wordpress/i.test( metaBy( 'name', 'generator' ) ),
		postType: (
			bodyClasses.find(
				( c ) =>
					/^single-[a-z0-9_-]+$/.test( c ) &&
					c !== 'single-format-standard'
			) ?? ''
		).replace( /^single-/, '' ),
		template:
			bodyClasses.find( ( c ) =>
				/-template-default$|^page-template-/.test( c )
			) ?? '',
		plugins: [
			( /plugins\/woocommerce\//i.test( raw ) ||
				bodyClasses.includes( 'woocommerce' ) ) &&
				'woocommerce',
			( /plugins\/wordpress-seo\//i.test( raw ) ||
				/yoast-schema-graph|class="yoast/i.test( raw ) ) &&
				'yoast-seo',
			/plugins\/(advanced-custom-fields|secure-custom-fields)/i.test(
				raw
			) && 'acf',
			/plugins\/elementor\//i.test( raw ) && 'elementor',
		].filter( Boolean ),
	},
	jsonLd,
	headings,
	faqPairs: faqPairs.slice( 0, 30 ),
	prices,
	dates,
	images,
	lists,
	tables,
	codeBlocks: {
		count: codeBlocks.length,
		samples: codeBlocks.slice( 0, 3 ).map( ( c ) => c.slice( 0, 160 ) ),
		endpoints,
	},
	links,
	wordCount: mainText.split( /\s+/ ).filter( Boolean ).length,
	textSample: mainText.slice( 0, 1500 ),
};

process.stdout.write( JSON.stringify( digest, null, 2 ) + '\n' );
