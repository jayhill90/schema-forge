import { Notice, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { config } from './config';
import { useRoute } from './router';
import { VocabProvider, useVocab } from './hooks/useVocab';
import { NoticesProvider } from './components/Notices';
import Header from './components/Header';
import TemplatesList from './screens/TemplatesList';
import Builder from './screens/Builder';
import Rules from './screens/Rules';
import Settings from './screens/Settings';

function Screen( { route, navigate } ) {
	switch ( route.view ) {
		case 'builder':
			return <Builder templateId={ route.id } navigate={ navigate } />;
		case 'rules':
			return <Rules navigate={ navigate } />;
		case 'settings':
			return <Settings />;
		case 'templates':
		default:
			return <TemplatesList navigate={ navigate } />;
	}
}

function VocabGate( { children } ) {
	const { loading, error } = useVocab();
	if ( error ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ __( 'The schema.org vocabulary could not be loaded. Run `npm run vocab` in the plugin directory and reload.', 'schema-forge' ) }
			</Notice>
		);
	}
	if ( loading ) {
		return (
			<div className="schema-forge-loading" role="status">
				<Spinner /> { __( 'Loading vocabulary…', 'schema-forge' ) }
			</div>
		);
	}
	return children;
}

export default function App() {
	const { route, navigate } = useRoute();

	if ( ! config.canManage ) {
		return <Notice status="error" isDismissible={ false }>{ __( 'You do not have permission to manage schema templates.', 'schema-forge' ) }</Notice>;
	}

	return (
		<NoticesProvider>
			<VocabProvider>
				<div className={ `schema-forge-app schema-forge-view-${ route.view }` }>
					{ route.view !== 'builder' && <Header route={ route } navigate={ navigate } /> }
					<VocabGate>
						<Screen route={ route } navigate={ navigate } />
					</VocabGate>
				</div>
			</VocabProvider>
		</NoticesProvider>
	);
}
