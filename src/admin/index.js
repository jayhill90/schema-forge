import { createRoot } from '@wordpress/element';
import App from './App';
import './styles.scss';

const mount = document.getElementById( 'schema-forge-admin' );
if ( mount ) {
	createRoot( mount ).render( <App /> );
}
