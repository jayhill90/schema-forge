import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from '@wordpress/element';
import { config } from '../config';

const VocabContext = createContext( {
	core: null,
	descriptions: null,
	loading: true,
	error: null,
} );

let corePromise = null;
let descPromise = null;

function loadJson( url ) {
	return window
		.fetch( url, { credentials: 'same-origin' } )
		.then( ( res ) => {
			if ( ! res.ok ) {
				throw new Error( `${ res.status } ${ res.statusText }` );
			}
			return res.json();
		} );
}

export function loadCore() {
	if ( ! corePromise ) {
		corePromise = loadJson(
			`${ config.vocabUrl }?v=${ encodeURIComponent( config.vocabVersion || '1' ) }`
		);
	}
	return corePromise;
}

export function loadDescriptions() {
	if ( ! descPromise ) {
		descPromise = loadJson(
			`${ config.vocabDescUrl }?v=${ encodeURIComponent( config.vocabVersion || '1' ) }`
		).catch( () => ( { types: {}, props: {}, enums: {} } ) );
	}
	return descPromise;
}

export function VocabProvider( { children } ) {
	const [ state, setState ] = useState( {
		core: null,
		descriptions: null,
		loading: true,
		error: null,
	} );

	useEffect( () => {
		let cancelled = false;
		loadCore()
			.then( ( core ) => {
				if ( ! cancelled ) {
					setState( ( s ) => ( { ...s, core, loading: false } ) );
				}
				return loadDescriptions();
			} )
			.then( ( descriptions ) => {
				if ( ! cancelled ) {
					setState( ( s ) => ( { ...s, descriptions } ) );
				}
			} )
			.catch( ( error ) => {
				if ( ! cancelled ) {
					setState( ( s ) => ( { ...s, loading: false, error } ) );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [] );

	const value = useMemo( () => state, [ state ] );
	return (
		<VocabContext.Provider value={ value }>
			{ children }
		</VocabContext.Provider>
	);
}

export function useVocab() {
	return useContext( VocabContext );
}

export function describeType( descriptions, name ) {
	return (
		( descriptions && descriptions.types && descriptions.types[ name ] ) ||
		''
	);
}

export function describeProperty( descriptions, name ) {
	return (
		( descriptions && descriptions.props && descriptions.props[ name ] ) ||
		''
	);
}
