import { useCallback, useEffect, useState } from '@wordpress/element';
import api from '../api';

export function useTemplates() {
	const [ templates, setTemplates ] = useState( null );
	const [ error, setError ] = useState( null );

	const reload = useCallback( () => {
		setError( null );
		return api
			.listTemplates()
			.then( setTemplates )
			.catch( ( e ) => setError( e ) );
	}, [] );

	useEffect( () => {
		reload();
	}, [ reload ] );

	return { templates, error, reload, setTemplates };
}
