/**
 * Block editor sidebar panel: per-post template assignments.
 */
import { registerPlugin } from '@wordpress/plugins';
import { PluginDocumentSettingPanel } from '@wordpress/editor';
import { useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { Button, CheckboxControl, FormTokenField, Notice, Spinner, ToggleControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import './styles.scss';

const NS = '/schema-forge/v1';

function SchemaForgePanel() {
	const postId = useSelect( ( select ) => select( 'core/editor' ).getCurrentPostId(), [] );
	const postType = useSelect( ( select ) => select( 'core/editor' ).getCurrentPostType(), [] );
	const [ data, setData ] = useState( null );
	const [ assignments, setAssignments ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ savedTick, setSavedTick ] = useState( 0 );

	const load = () => {
		if ( ! postId ) {
			return;
		}
		Promise.all( [
			apiFetch( { path: `${ NS }/resolve?post_id=${ postId }` } ),
			apiFetch( { path: `${ NS }/posts/${ postId }/assignments` } ),
		] )
			.then( ( [ resolved, current ] ) => {
				setData( resolved );
				setAssignments( current );
			} )
			.catch( ( e ) => setError( ( e && e.message ) || __( 'Could not load schema assignments.', 'schema-forge' ) ) );
	};

	useEffect( load, [ postId ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const persist = async ( next ) => {
		setAssignments( next );
		setSaving( true );
		try {
			const saved = await apiFetch( { path: `${ NS }/posts/${ postId }/assignments`, method: 'PUT', data: next } );
			setAssignments( saved );
			const resolved = await apiFetch( { path: `${ NS }/resolve?post_id=${ postId }` } );
			setData( resolved );
			setSavedTick( ( t ) => t + 1 );
		} catch ( e ) {
			setError( ( e && e.message ) || __( 'Could not save.', 'schema-forge' ) );
		} finally {
			setSaving( false );
		}
	};

	if ( error ) {
		return <Notice status="error" isDismissible={ false }>{ error }</Notice>;
	}
	if ( ! data || ! assignments ) {
		return <p role="status"><Spinner /> { __( 'Loading…', 'schema-forge' ) }</p>;
	}

	const inherited = data.resolved.filter( ( r ) => r.source !== 'post' );
	const own = data.resolved.filter( ( r ) => r.source === 'post' );
	const disabled = data.disabled || [];
	const availableForAdd = data.available.filter( ( t ) => ! data.resolved.find( ( r ) => r.id === t.id ) );
	const nameToId = new Map( data.available.map( ( t ) => [ t.name, t.id ] ) );
	const idToName = new Map( data.available.map( ( t ) => [ t.id, t.name ] ) );

	return (
		<div className="schema-forge-editor-panel">
			{ inherited.length > 0 && (
				<>
					<p className="schema-forge-editor-panel__heading">{ __( 'Inherited templates', 'schema-forge' ) }</p>
					{ inherited.map( ( r ) => (
						<CheckboxControl
							key={ r.id }
							label={ `${ r.name } (${ r.rootType })` }
							help={ r.label }
							checked
							onChange={ () => persist( { ...assignments, disable: [ ...assignments.disable, r.id ] } ) }
							__nextHasNoMarginBottom
						/>
					) ) }
				</>
			) }
			{ disabled.length > 0 && (
				<>
					<p className="schema-forge-editor-panel__heading">{ __( 'Disabled on this post', 'schema-forge' ) }</p>
					{ disabled.map( ( r ) => (
						<CheckboxControl
							key={ r.id }
							label={ `${ r.name } (${ r.rootType })` }
							checked={ false }
							onChange={ () => persist( { ...assignments, disable: assignments.disable.filter( ( id ) => id !== r.id ) } ) }
							__nextHasNoMarginBottom
						/>
					) ) }
				</>
			) }
			{ ! inherited.length && ! disabled.length && (
				<p className="description">{ sprintf( /* translators: %s post type */ __( 'No templates are inherited from rules for this %s.', 'schema-forge' ), postType ) }</p>
			) }
			<ToggleControl
				label={ __( 'Ignore all inherited templates', 'schema-forge' ) }
				checked={ Boolean( assignments.disableInherited ) }
				onChange={ ( v ) => persist( { ...assignments, disableInherited: v } ) }
				__nextHasNoMarginBottom
			/>
			<FormTokenField
				label={ __( 'Additional templates', 'schema-forge' ) }
				value={ assignments.add.map( ( id ) => idToName.get( id ) ).filter( Boolean ) }
				suggestions={ availableForAdd.map( ( t ) => t.name ) }
				onChange={ ( tokens ) => persist( { ...assignments, add: tokens.map( ( t ) => nameToId.get( typeof t === 'string' ? t : t.value ) ).filter( Boolean ) } ) }
				__experimentalExpandOnFocus
				__experimentalShowHowTo={ false }
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			{ own.length > 0 && <p className="description">{ sprintf( /* translators: %d count */ __( '%d template(s) added directly to this post.', 'schema-forge' ), own.length ) }</p> }
			<p className="schema-forge-editor-panel__status" role="status">
				{ saving ? __( 'Saving…', 'schema-forge' ) : savedTick > 0 ? __( 'Saved.', 'schema-forge' ) : '' }
			</p>
			{ window.SchemaForgeEditor && window.SchemaForgeEditor.adminUrl && (
				<Button variant="link" href={ window.SchemaForgeEditor.adminUrl } target="_blank" rel="noreferrer">{ __( 'Manage schema templates ↗', 'schema-forge' ) }</Button>
			) }
		</div>
	);
}

registerPlugin( 'schema-forge', {
	render: () => (
		<PluginDocumentSettingPanel name="schema-forge" title={ __( 'Schema templates', 'schema-forge' ) } className="schema-forge-document-panel">
			<SchemaForgePanel />
		</PluginDocumentSettingPanel>
	),
	icon: 'networking',
} );
