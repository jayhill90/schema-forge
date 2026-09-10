#!/usr/bin/env node
/**
 * Download the schema.org vocabulary and compile it to assets/vocab/*.json.
 *
 *   node scripts/build-vocab.mjs [--input path.jsonld] [--out assets/vocab]
 *                                [--version 29.2] [--exclude-superseded] [--include-attic]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileVocab } from './lib/compile-vocab.mjs';

const SOURCE = 'https://schema.org/version/latest/schemaorg-current-https.jsonld';
const __dirname = path.dirname( fileURLToPath( import.meta.url ) );

function arg( name, fallback ) {
	const i = process.argv.indexOf( `--${ name }` );
	if ( i === -1 ) {
		return fallback;
	}
	const next = process.argv[ i + 1 ];
	return next && ! next.startsWith( '--' ) ? next : true;
}

async function load() {
	const input = arg( 'input', null );
	if ( input ) {
		return { json: JSON.parse( await readFile( input, 'utf8' ) ), version: arg( 'version', 'local' ) };
	}
	const res = await fetch( SOURCE );
	if ( ! res.ok ) {
		throw new Error( `Failed to download ${ SOURCE }: ${ res.status }` );
	}
	const json = await res.json();
	const lastModified = res.headers.get( 'last-modified' );
	const version = arg( 'version', lastModified ? new Date( lastModified ).toISOString().slice( 0, 10 ) : 'latest' );
	return { json, version };
}

const { json, version } = await load();
const outDir = path.resolve( __dirname, '..', arg( 'out', 'assets/vocab' ) );
await mkdir( outDir, { recursive: true } );

const { core, descriptions, meta } = compileVocab( json, {
	version,
	includeSuperseded: arg( 'exclude-superseded', false ) !== true,
	includeAttic: arg( 'include-attic', false ) === true,
} );

const files = {
	'schemaorg.core.json': JSON.stringify( core ),
	'schemaorg.desc.json': JSON.stringify( descriptions ),
	'schemaorg.meta.json': JSON.stringify( meta, null, 2 ) + '\n',
};
for ( const [ name, content ] of Object.entries( files ) ) {
	await writeFile( path.join( outDir, name ), content );
	// eslint-disable-next-line no-console
	console.log( `${ name.padEnd( 24 ) } ${ ( Buffer.byteLength( content ) / 1024 ).toFixed( 0 ).padStart( 6 ) } KB` );
}
// eslint-disable-next-line no-console
console.log( JSON.stringify( meta.counts ) );
