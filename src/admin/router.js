import { useCallback, useEffect, useState } from '@wordpress/element';

function read() {
	const params = new URLSearchParams( window.location.search );
	return {
		view: params.get( 'view' ) || 'templates',
		id: params.get( 'id' ) || '',
	};
}

/**
 * Tiny query-param router: ?page=schema-forge&view=builder&id=12
 */
export function useRoute() {
	const [ route, setRoute ] = useState( read );

	useEffect( () => {
		const onPop = () => setRoute( read() );
		window.addEventListener( 'popstate', onPop );
		return () => window.removeEventListener( 'popstate', onPop );
	}, [] );

	const navigate = useCallback(
		( view, id = '', { replace = false } = {} ) => {
			const params = new URLSearchParams( window.location.search );
			params.set( 'view', view );
			if ( id ) {
				params.set( 'id', String( id ) );
			} else {
				params.delete( 'id' );
			}
			const url = `${ window.location.pathname }?${ params.toString() }`;
			if ( replace ) {
				window.history.replaceState( {}, '', url );
			} else {
				window.history.pushState( {}, '', url );
			}
			setRoute( read() );
		},
		[]
	);

	return { route, navigate };
}

export function routeUrl( view, id = '' ) {
	const params = new URLSearchParams( window.location.search );
	params.set( 'view', view );
	if ( id ) {
		params.set( 'id', String( id ) );
	} else {
		params.delete( 'id' );
	}
	return `${ window.location.pathname }?${ params.toString() }`;
}
