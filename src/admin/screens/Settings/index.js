import { useEffect, useState } from '@wordpress/element';
import { Button, ComboboxControl, Flex, FlexItem, Notice, Panel, PanelBody, SelectControl, Spinner, TextControl, ToggleControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import api, { errorMessage } from '../../api';
import { config } from '../../config';
import { useNotices } from '../../components/Notices';
import { useDebounce } from '../../hooks/useDebounce';

function UserPicker( { value, onChange } ) {
	const [ query, setQuery ] = useState( '' );
	const [ options, setOptions ] = useState( [] );
	const debounced = useDebounce( query, 250 );
	useEffect( () => {
		api.searchUsers( debounced ).then( ( users ) => setOptions( users.map( ( u ) => ( { value: String( u.id ), label: u.name } ) ) ) ).catch( () => {} );
	}, [ debounced ] );
	const merged = value && ! options.find( ( o ) => o.value === String( value ) ) ? [ { value: String( value ), label: `#${ value }` }, ...options ] : options;
	return (
		<ComboboxControl label={ __( 'Person (user)', 'schema-forge' ) } value={ value ? String( value ) : '' } options={ merged } onFilterValueChange={ setQuery } onChange={ ( v ) => onChange( v ? Number( v ) : 0 ) } __nextHasNoMarginBottom __next40pxDefaultSize />
	);
}

export default function Settings() {
	const { notify } = useNotices();
	const [ settings, setSettings ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ saving, setSaving ] = useState( false );

	useEffect( () => {
		api.getSettings().then( setSettings ).catch( ( e ) => setError( errorMessage( e, __( 'Could not load settings.', 'schema-forge' ) ) ) );
	}, [] );

	const save = async () => {
		setSaving( true );
		try {
			setSettings( await api.saveSettings( settings ) );
			notify( __( 'Settings saved.', 'schema-forge' ) );
		} catch ( e ) {
			notify( errorMessage( e, __( 'Could not save settings.', 'schema-forge' ) ), { status: 'error' } );
		} finally {
			setSaving( false );
		}
	};

	if ( error ) {
		return <Notice status="error" isDismissible={ false }>{ error }</Notice>;
	}
	if ( ! settings ) {
		return <p role="status"><Spinner /> { __( 'Loading settings…', 'schema-forge' ) }</p>;
	}
	const set = ( key, value ) => setSettings( ( s ) => ( { ...s, [ key ]: value } ) );

	return (
		<div className="schema-forge-screen schema-forge-settings">
			<Flex justify="space-between" align="center" className="schema-forge-screen__toolbar">
				<FlexItem><h2>{ __( 'Settings', 'schema-forge' ) }</h2></FlexItem>
				<FlexItem><Button variant="primary" onClick={ save } isBusy={ saving } disabled={ saving }>{ __( 'Save settings', 'schema-forge' ) }</Button></FlexItem>
			</Flex>

			<Panel header={ __( 'Output', 'schema-forge' ) }>
				<PanelBody>
					{ config.hasYoast ? (
						<Notice status="info" isDismissible={ false }>
							{ __( 'Yoast SEO is active. Templates are merged into Yoast’s schema graph, and references such as “Site organization” use Yoast’s entities. Configure the organization/person under Yoast SEO → Settings → Site representation.', 'schema-forge' ) }
						</Notice>
					) : (
						<>
							<Notice status="info" isDismissible={ false }>{ __( 'Yoast SEO is not active. Schema Forge outputs its own JSON-LD graph on pages that have templates.', 'schema-forge' ) }</Notice>
							<ToggleControl label={ __( 'Include WebSite, WebPage and publisher nodes', 'schema-forge' ) } checked={ Boolean( settings.includeCoreNodes ) } onChange={ ( v ) => set( 'includeCoreNodes', v ) } __nextHasNoMarginBottom />
							<SelectControl
								label={ __( 'The site represents', 'schema-forge' ) }
								value={ settings.siteRepresents }
								options={ [ { value: 'organization', label: __( 'An organization', 'schema-forge' ) }, { value: 'person', label: __( 'A person', 'schema-forge' ) }, { value: 'none', label: __( 'Neither (no publisher node)', 'schema-forge' ) } ] }
								onChange={ ( v ) => set( 'siteRepresents', v ) }
								__nextHasNoMarginBottom
								__next40pxDefaultSize
							/>
							{ settings.siteRepresents === 'organization' && (
								<>
									<TextControl label={ __( 'Organization name', 'schema-forge' ) } value={ settings.organizationName || '' } onChange={ ( v ) => set( 'organizationName', v ) } placeholder={ config.siteName } __nextHasNoMarginBottom __next40pxDefaultSize />
									<TextControl label={ __( 'Organization logo (attachment ID)', 'schema-forge' ) } type="number" value={ settings.organizationLogo || '' } onChange={ ( v ) => set( 'organizationLogo', Number( v ) || 0 ) } help={ __( 'Leave empty to use the customizer site logo.', 'schema-forge' ) } __nextHasNoMarginBottom __next40pxDefaultSize />
								</>
							) }
							{ settings.siteRepresents === 'person' && <UserPicker value={ settings.personUserId } onChange={ ( v ) => set( 'personUserId', v ) } /> }
						</>
					) }
				</PanelBody>
			</Panel>

			<Panel header={ __( 'About', 'schema-forge' ) }>
				<PanelBody>
					<p>{ sprintf( /* translators: 1: plugin version 2: vocab version */ __( 'Schema Forge %1$s · schema.org vocabulary %2$s', 'schema-forge' ), config.pluginVersion, config.vocabVersion || '?' ) }</p>
					<p className="description">{ __( 'To refresh the vocabulary, run `npm run vocab` in the plugin directory and redeploy the assets/vocab files.', 'schema-forge' ) }</p>
					<p className="description">{ config.hasAcf ? __( 'ACF detected: {{acf.*}} tokens are available.', 'schema-forge' ) : __( 'ACF not detected: {{acf.*}} tokens resolve empty.', 'schema-forge' ) }</p>
				</PanelBody>
			</Panel>
		</div>
	);
}
