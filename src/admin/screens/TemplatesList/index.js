import { useMemo, useState } from '@wordpress/element';
import {
	Button,
	Flex,
	FlexItem,
	Modal,
	Notice,
	SearchControl,
	Spinner,
	TextareaControl,
	ToggleControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import api, { errorMessage } from '../../api';
import { useTemplates } from '../../hooks/useTemplates';
import { useNotices } from '../../components/Notices';
import ConfirmModal from '../../components/ConfirmModal';
import { routeUrl } from '../../router';

function formatDate( gmt ) {
	if ( ! gmt ) {
		return '';
	}
	const d = new Date( gmt.replace( ' ', 'T' ) + 'Z' );
	return isNaN( d.getTime() ) ? gmt : d.toLocaleString();
}

export default function TemplatesList( { navigate } ) {
	const { templates, error, reload, setTemplates } = useTemplates();
	const { notify } = useNotices();
	const [ search, setSearch ] = useState( '' );
	const [ pendingDelete, setPendingDelete ] = useState( null );
	const [ busy, setBusy ] = useState( false );

	const filtered = useMemo( () => {
		if ( ! templates ) {
			return [];
		}
		const q = search.trim().toLowerCase();
		if ( ! q ) {
			return templates;
		}
		return templates.filter( ( t ) =>
			`${ t.name } ${ t.rootType } ${ t.description }`
				.toLowerCase()
				.includes( q )
		);
	}, [ templates, search ] );

	const toggleEnabled = async ( template, enabled ) => {
		setTemplates( ( list ) =>
			list.map( ( t ) =>
				t.id === template.id ? { ...t, enabled } : t
			)
		);
		try {
			await api.updateTemplate( template.id, { enabled } );
			notify(
				enabled
					? sprintf(
							/* translators: %s template name */ __(
								'“%s” enabled.',
								'schema-forge'
							),
							template.name
						)
					: sprintf(
							/* translators: %s template name */ __(
								'“%s” disabled.',
								'schema-forge'
							),
							template.name
						)
			);
		} catch ( e ) {
			notify(
				errorMessage(
					e,
					__( 'Could not update the template.', 'schema-forge' )
				),
				{ status: 'error' }
			);
			reload();
		}
	};

	const duplicate = async ( template ) => {
		try {
			const copy = await api.duplicateTemplate( template.id );
			notify(
				sprintf(
					/* translators: %s template name */ __(
						'Duplicated as “%s”.',
						'schema-forge'
					),
					copy.name
				)
			);
			reload();
		} catch ( e ) {
			notify(
				errorMessage(
					e,
					__( 'Could not duplicate the template.', 'schema-forge' )
				),
				{ status: 'error' }
			);
		}
	};

	const [ importOpen, setImportOpen ] = useState( false );
	const [ importText, setImportText ] = useState( '' );
	const [ importError, setImportError ] = useState( '' );

	const exportTemplate = async ( template ) => {
		try {
			const full = await api.getTemplate( template.id );
			const payload = {
				schemaForge: 1,
				name: full.name,
				description: full.description,
				tree: full.tree,
				settings: full.settings,
			};
			await navigator.clipboard.writeText(
				JSON.stringify( payload, null, 2 )
			);
			notify(
				sprintf(
					/* translators: %s template name */ __(
						'Copied “%s” as JSON to the clipboard.',
						'schema-forge'
					),
					template.name
				)
			);
		} catch ( e ) {
			notify(
				errorMessage(
					e,
					__( 'Could not export the template.', 'schema-forge' )
				),
				{ status: 'error' }
			);
		}
	};

	const importTemplate = async () => {
		setImportError( '' );
		let parsed;
		try {
			parsed = JSON.parse( importText );
		} catch {
			setImportError( __( 'That is not valid JSON.', 'schema-forge' ) );
			return;
		}
		if (
			! parsed ||
			typeof parsed !== 'object' ||
			! parsed.tree ||
			! parsed.tree.root
		) {
			setImportError(
				__(
					'The JSON must contain a “tree” with a “root” node (as produced by Export).',
					'schema-forge'
				)
			);
			return;
		}
		setBusy( true );
		try {
			const created = await api.createTemplate( {
				name: parsed.name || __( 'Imported template', 'schema-forge' ),
				description: parsed.description || '',
				enabled: false,
				tree: parsed.tree,
				settings: parsed.settings || {},
			} );
			notify(
				sprintf(
					/* translators: %s template name */ __(
						'Imported “%s” (disabled until you enable it).',
						'schema-forge'
					),
					created.name
				)
			);
			setImportOpen( false );
			setImportText( '' );
			reload();
		} catch ( e ) {
			setImportError(
				errorMessage( e, __( 'Import failed.', 'schema-forge' ) )
			);
		} finally {
			setBusy( false );
		}
	};

	const confirmDelete = async () => {
		if ( ! pendingDelete ) {
			return;
		}
		setBusy( true );
		try {
			await api.deleteTemplate( pendingDelete.id );
			notify(
				sprintf(
					/* translators: %s template name */ __(
						'Deleted “%s”.',
						'schema-forge'
					),
					pendingDelete.name
				)
			);
			setPendingDelete( null );
			reload();
		} catch ( e ) {
			notify(
				errorMessage(
					e,
					__( 'Could not delete the template.', 'schema-forge' )
				),
				{ status: 'error' }
			);
		} finally {
			setBusy( false );
		}
	};

	return (
		<div className="schema-forge-screen schema-forge-templates">
			<Flex
				justify="space-between"
				align="center"
				wrap
				className="schema-forge-screen__toolbar"
			>
				<FlexItem>
					<h2>{ __( 'Schema templates', 'schema-forge' ) }</h2>
					<p className="description">
						{ __(
							'Reusable schema.org graphs. Assign them to posts, post types, terms and archives.',
							'schema-forge'
						) }
					</p>
				</FlexItem>
				<FlexItem>
					<Flex gap={ 2 }>
						<SearchControl
							value={ search }
							onChange={ setSearch }
							label={ __( 'Search templates', 'schema-forge' ) }
							__nextHasNoMarginBottom
						/>
						<Button
							variant="secondary"
							onClick={ () => setImportOpen( true ) }
						>
							{ __( 'Import JSON', 'schema-forge' ) }
						</Button>
						<Button
							variant="primary"
							href={ routeUrl( 'builder', 'new' ) }
							onClick={ ( e ) => {
								e.preventDefault();
								navigate( 'builder', 'new' );
							} }
						>
							{ __( 'New template', 'schema-forge' ) }
						</Button>
					</Flex>
				</FlexItem>
			</Flex>

			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ errorMessage(
						error,
						__( 'Could not load templates.', 'schema-forge' )
					) }
				</Notice>
			) }

			{ ! templates && ! error && (
				<p role="status">
					<Spinner /> { __( 'Loading templates…', 'schema-forge' ) }
				</p>
			) }

			{ templates && templates.length === 0 && (
				<div className="schema-forge-empty">
					<p>
						{ __(
							'No templates yet. Create your first one to start building structured data visually.',
							'schema-forge'
						) }
					</p>
					<Button
						variant="primary"
						onClick={ () => navigate( 'builder', 'new' ) }
					>
						{ __( 'Create a template', 'schema-forge' ) }
					</Button>
				</div>
			) }

			{ templates && templates.length > 0 && (
				<table className="wp-list-table widefat fixed striped schema-forge-table">
					<thead>
						<tr>
							<th scope="col" className="column-primary">
								{ __( 'Name', 'schema-forge' ) }
							</th>
							<th scope="col">
								{ __( 'Type', 'schema-forge' ) }
							</th>
							<th scope="col">
								{ __( 'Assigned to', 'schema-forge' ) }
							</th>
							<th scope="col">
								{ __( 'Enabled', 'schema-forge' ) }
							</th>
							<th scope="col">
								{ __( 'Modified', 'schema-forge' ) }
							</th>
							<th scope="col">
								<span className="screen-reader-text">
									{ __( 'Actions', 'schema-forge' ) }
								</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{ filtered.map( ( template ) => (
							<tr key={ template.id }>
								<td className="column-primary">
									<a
										href={ routeUrl(
											'builder',
											template.id
										) }
										className="row-title"
										onClick={ ( e ) => {
											e.preventDefault();
											navigate( 'builder', template.id );
										} }
									>
										{ template.name ||
											__( '(untitled)', 'schema-forge' ) }
									</a>
									{ template.description && (
										<p className="description">
											{ template.description }
										</p>
									) }
								</td>
								<td>
									<code>{ template.rootType || '—' }</code>
								</td>
								<td>
									{ template.assignedTo &&
									template.assignedTo.length ? (
										<ul className="schema-forge-chips">
											{ template.assignedTo.map(
												( label, i ) => (
													<li
														key={ i }
														className="schema-forge-chip"
													>
														{ label }
													</li>
												)
											) }
										</ul>
									) : (
										<span className="schema-forge-muted">
											{ __(
												'Not assigned',
												'schema-forge'
											) }
										</span>
									) }
								</td>
								<td>
									<ToggleControl
										checked={ template.enabled }
										onChange={ ( v ) =>
											toggleEnabled( template, v )
										}
										label={ sprintf(
											/* translators: %s template name */ __(
												'Enable %s',
												'schema-forge'
											),
											template.name
										) }
										hideLabelFromVision
										__nextHasNoMarginBottom
									/>
								</td>
								<td>{ formatDate( template.modified ) }</td>
								<td className="schema-forge-table__actions">
									<Button
										size="small"
										variant="secondary"
										onClick={ () =>
											navigate( 'builder', template.id )
										}
									>
										{ __( 'Edit', 'schema-forge' ) }
									</Button>
									<Button
										size="small"
										variant="tertiary"
										onClick={ () => duplicate( template ) }
									>
										{ __( 'Duplicate', 'schema-forge' ) }
									</Button>
									<Button
										size="small"
										variant="tertiary"
										onClick={ () =>
											exportTemplate( template )
										}
									>
										{ __( 'Export', 'schema-forge' ) }
									</Button>
									<Button
										size="small"
										variant="tertiary"
										isDestructive
										onClick={ () =>
											setPendingDelete( template )
										}
									>
										{ __( 'Delete', 'schema-forge' ) }
									</Button>
								</td>
							</tr>
						) ) }
						{ filtered.length === 0 && (
							<tr>
								<td colSpan={ 6 }>
									{ __(
										'No templates match your search.',
										'schema-forge'
									) }
								</td>
							</tr>
						) }
					</tbody>
				</table>
			) }

			{ importOpen && (
				<Modal
					title={ __( 'Import template JSON', 'schema-forge' ) }
					onRequestClose={ () => setImportOpen( false ) }
					shouldCloseOnClickOutside
					shouldCloseOnEsc
				>
					<TextareaControl
						label={ __(
							'Paste JSON exported from Schema Forge',
							'schema-forge'
						) }
						value={ importText }
						onChange={ setImportText }
						rows={ 12 }
						__nextHasNoMarginBottom
					/>
					{ importError && (
						<Notice status="error" isDismissible={ false }>
							{ importError }
						</Notice>
					) }
					<Flex
						justify="flex-end"
						gap={ 2 }
						style={ { marginTop: 16 } }
					>
						<Button
							variant="tertiary"
							onClick={ () => setImportOpen( false ) }
						>
							{ __( 'Cancel', 'schema-forge' ) }
						</Button>
						<Button
							variant="primary"
							onClick={ importTemplate }
							isBusy={ busy }
							disabled={ busy || ! importText.trim() }
						>
							{ __( 'Import', 'schema-forge' ) }
						</Button>
					</Flex>
				</Modal>
			) }

			{ pendingDelete && (
				<ConfirmModal
					title={ __( 'Delete template?', 'schema-forge' ) }
					confirmLabel={ __( 'Delete', 'schema-forge' ) }
					onConfirm={ confirmDelete }
					onCancel={ () => setPendingDelete( null ) }
					busy={ busy }
				>
					<p>
						{ sprintf(
							/* translators: %s template name */ __(
								'“%s” will be removed from every post, post type and rule that uses it. This cannot be undone.',
								'schema-forge'
							),
							pendingDelete.name
						) }
					</p>
				</ConfirmModal>
			) }
		</div>
	);
}
