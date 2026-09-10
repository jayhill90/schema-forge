import { createContext, useCallback, useContext, useMemo, useState } from '@wordpress/element';
import { SnackbarList } from '@wordpress/components';

const NoticesContext = createContext( { notify: () => {} } );

let counter = 0;

export function NoticesProvider( { children } ) {
	const [ notices, setNotices ] = useState( [] );

	const remove = useCallback( ( id ) => setNotices( ( list ) => list.filter( ( n ) => n.id !== id ) ), [] );

	const notify = useCallback(
		( content, { status = 'success', explicitDismiss = false } = {} ) => {
			const id = `sf-notice-${ ++counter }`;
			setNotices( ( list ) => [ ...list, { id, content, status, explicitDismiss, spokenMessage: content } ] );
			if ( ! explicitDismiss ) {
				setTimeout( () => remove( id ), 5000 );
			}
			return id;
		},
		[ remove ]
	);

	const value = useMemo( () => ( { notify } ), [ notify ] );

	return (
		<NoticesContext.Provider value={ value }>
			{ children }
			<SnackbarList className="schema-forge-snackbars" notices={ notices } onRemove={ remove } />
		</NoticesContext.Provider>
	);
}

export function useNotices() {
	return useContext( NoticesContext );
}
