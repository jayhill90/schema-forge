import { useCallback, useEffect, useMemo, useState } from '@wordpress/element';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Button, Notice, Spinner, TabPanel, TextControl, ToggleControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import api, { errorMessage } from '../../api';
import { config } from '../../config';
import { useNotices } from '../../components/Notices';
import { BuilderProvider, PreviewTokensContext, useBuilder } from '../../builder/BuilderContext';
import Palette from '../../builder/Palette';
import Canvas from '../../builder/Canvas';
import Inspector from '../../builder/Inspector';
import PreviewPanel from '../../builder/PreviewPanel';
import IssuesPanel, { useIssues } from '../../builder/IssuesPanel';
import { denormalize } from '../../../shared/tree/normalize';
import { typeFitsProperty } from '../../../shared/vocab';
import { useVocab } from '../../hooks/useVocab';
import { routeUrl } from '../../router';

const NEW_TEMPLATE = { id: 0, name: '', description: '', enabled: false, tree: { version: 1, root: null }, settings: { yoast: { suppressArticle: false, webPageType: '' }, standalone: { includeCoreNodes: true } } };

function collisionDetection( args ) {
	const within = pointerWithin( args );
	return within.length ? within : rectIntersection( args );
}

function BuilderInner( { templateId, navigate } ) {
	const builder = useBuilder();
	const { state, init, setMeta, markSaved, undo, redo, canUndo, canRedo, moveProperty, setRootType, addValue, nestNode, addProperty, select } = builder;
	const { core } = useVocab();
	const { notify } = useNotices();
	const issues = useIssues();
	const [ loading, setLoading ] = useState( true );
	const [ loadError, setLoadError ] = useState( null );
	const [ saving, setSaving ] = useState( false );
	const [ previewContext, setPreviewContext ] = useState( null );
	const [ previewTokens, setPreviewTokens ] = useState( {} );
	const [ activeDrag, setActiveDrag ] = useState( null );
	const [ announcement, setAnnouncement ] = useState( '' );

	// Load the template (or start a new one).
	useEffect( () => {
		let cancelled = false;
		setLoading( true );
		setLoadError( null );
		const load = templateId && templateId !== 'new' ? api.getTemplate( templateId ) : Promise.resolve( NEW_TEMPLATE );
		Promise.all( [ load, api.listTemplates().catch( () => [] ) ] )
			.then( ( [ template, templates ] ) => {
				if ( cancelled ) {
					return;
				}
				window.SchemaForgeTemplates = templates.filter( ( t ) => t.id !== template.id );
				init( template );
				setLoading( false );
			} )
			.catch( ( e ) => {
				if ( ! cancelled ) {
					setLoadError( errorMessage( e, __( 'Could not load the template.', 'schema-forge' ) ) );
					setLoading( false );
				}
			} );
		return () => {
			cancelled = true;
		};
	}, [ templateId, init ] );

	// Unsaved-changes guard.
	useEffect( () => {
		if ( ! state.dirty ) {
			return undefined;
		}
		const handler = ( e ) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener( 'beforeunload', handler );
		return () => window.removeEventListener( 'beforeunload', handler );
	}, [ state.dirty ] );

	const save = useCallback( async () => {
		if ( saving ) {
			return;
		}
		const errors = issues.filter( ( i ) => i.level === 'error' );
		if ( ! state.tree.rootId ) {
			notify( __( 'Choose a root type before saving.', 'schema-forge' ), { status: 'error' } );
			return;
		}
		if ( errors.length ) {
			notify( sprintf( /* translators: %d count */ __( 'Fix %d error(s) in the Issues panel before saving.', 'schema-forge' ), errors.length ), { status: 'error' } );
			return;
		}
		setSaving( true );
		const payload = { name: state.meta.name, description: state.meta.description, enabled: state.meta.enabled, tree: denormalize( state.tree ), settings: state.settings };
		try {
			const saved = state.loadedId ? await api.updateTemplate( state.loadedId, payload ) : await api.createTemplate( payload );
			markSaved( saved.id );
			notify( saved.warnings && saved.warnings.length ? sprintf( /* translators: %d count */ __( 'Saved with %d warning(s).', 'schema-forge' ), saved.warnings.length ) : __( 'Template saved.', 'schema-forge' ) );
			if ( ! state.loadedId ) {
				navigate( 'builder', saved.id, { replace: true } );
			}
		} catch ( e ) {
			notify( errorMessage( e, __( 'Could not save the template.', 'schema-forge' ) ), { status: 'error', explicitDismiss: true } );
		} finally {
			setSaving( false );
		}
	}, [ saving, issues, state, notify, markSaved, navigate ] );

	// Keyboard shortcuts.
	useEffect( () => {
		const onKey = ( e ) => {
			const mod = e.metaKey || e.ctrlKey;
			if ( ! mod ) {
				return;
			}
			if ( e.key === 's' ) {
				e.preventDefault();
				save();
			} else if ( e.key === 'z' && ! e.shiftKey ) {
				if ( e.target && /^(input|textarea)$/i.test( e.target.tagName ) ) {
					return;
				}
				e.preventDefault();
				undo();
			} else if ( ( e.key === 'z' && e.shiftKey ) || e.key === 'y' ) {
				if ( e.target && /^(input|textarea)$/i.test( e.target.tagName ) ) {
					return;
				}
				e.preventDefault();
				redo();
			}
		};
		window.addEventListener( 'keydown', onKey );
		return () => window.removeEventListener( 'keydown', onKey );
	}, [ save, undo, redo ] );

	const sensors = useSensors(
		useSensor( PointerSensor, { activationConstraint: { distance: 6 } } ),
		useSensor( KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates } )
	);

	const onDragStart = ( { active } ) => {
		setActiveDrag( active.data.current || null );
	};

	const onDragEnd = ( { active, over } ) => {
		setActiveDrag( null );
		const a = active.data.current;
		const o = over && over.data.current;
		if ( ! a || ! over ) {
			return;
		}
		if ( a.kind === 'sortable-property' && o && o.kind === 'sortable-property' ) {
			if ( a.nodeId === o.nodeId && a.index !== o.index ) {
				moveProperty( a.nodeId, a.index, o.index );
				setAnnouncement( sprintf( /* translators: 1: property 2: position */ __( 'Moved “%1$s” to position %2$d.', 'schema-forge' ), a.propertyId && state.tree.properties[ a.propertyId ] ? state.tree.properties[ a.propertyId ].name : '', o.index + 1 ) );
			} else if ( a.nodeId !== o.nodeId ) {
				setAnnouncement( __( 'Properties can only be reordered within the same node.', 'schema-forge' ) );
			}
			return;
		}
		if ( a.kind === 'type' ) {
			if ( over.id === 'drop:root' ) {
				setRootType( a.typeName );
				setAnnouncement( sprintf( /* translators: %s type */ __( '%s is now the root type.', 'schema-forge' ), a.typeName ) );
				return;
			}
			if ( o && o.kind === 'sortable-property' ) {
				const property = state.tree.properties[ o.propertyId ];
				if ( ! property ) {
					return;
				}
				if ( ! typeFitsProperty( core, property.name, a.typeName ) ) {
					setAnnouncement( sprintf( /* translators: 1: type 2: property */ __( '%1$s is not an expected type for “%2$s”. Added anyway; check the Issues panel.', 'schema-forge' ), a.typeName, property.name ) );
				} else {
					setAnnouncement( sprintf( /* translators: 1: type 2: property */ __( 'Nested %1$s into “%2$s”.', 'schema-forge' ), a.typeName, property.name ) );
				}
				const emptySlot = property.valueIds.map( ( id ) => state.tree.values[ id ] ).find( ( v ) => v && ( v.kind === 'node' || v.kind === 'repeat' ) && ! v.nodeId );
				if ( emptySlot ) {
					nestNode( emptySlot.id, a.typeName );
				} else {
					addValue( property.id, 'node', { typeName: a.typeName } );
				}
				select( { kind: 'property', id: property.id } );
				return;
			}
			if ( o && o.kind === 'node' ) {
				// Dropping a type onto a node card: add it as a nested value of a new unnamed property.
				addProperty( o.nodeId, '', { initialValue: { kind: 'node', typeName: a.typeName } } );
				setAnnouncement( sprintf( /* translators: %s type */ __( 'Added a new property holding %s. Give it a name.', 'schema-forge' ), a.typeName ) );
			}
			return;
		}
		if ( a.kind === 'property' ) {
			let nodeId = null;
			if ( o && o.kind === 'node' ) {
				nodeId = o.nodeId;
			} else if ( o && o.kind === 'sortable-property' ) {
				nodeId = o.nodeId;
			}
			if ( nodeId ) {
				addProperty( nodeId, a.name, { initialValue: { kind: 'text', value: '' } } );
				setAnnouncement( sprintf( /* translators: 1: property 2: type */ __( 'Added “%1$s” to %2$s.', 'schema-forge' ), a.name, state.tree.nodes[ nodeId ] ? state.tree.nodes[ nodeId ].type : '' ) );
			}
		}
	};

	const announcements = useMemo( () => ( {
		onDragStart: ( { active } ) => {
			const d = active.data.current || {};
			if ( d.kind === 'type' ) {
				return sprintf( /* translators: %s type */ __( 'Picked up type %s. Drop it on a property to nest it, or on the canvas to make it the root.', 'schema-forge' ), d.typeName );
			}
			if ( d.kind === 'property' ) {
				return sprintf( /* translators: %s property */ __( 'Picked up property %s. Drop it on a node.', 'schema-forge' ), d.name );
			}
			if ( d.kind === 'sortable-property' ) {
				return sprintf( /* translators: %d position */ __( 'Picked up property at position %d. Use arrow keys to move, space to drop.', 'schema-forge' ), d.index + 1 );
			}
			return __( 'Picked up item.', 'schema-forge' );
		},
		onDragOver: ( { active, over } ) => {
			const d = active.data.current || {};
			const t = over && over.data.current;
			if ( ! over ) {
				return __( 'Not over a drop target.', 'schema-forge' );
			}
			if ( d.kind === 'sortable-property' && t && t.kind === 'sortable-property' ) {
				return sprintf( /* translators: %d position */ __( 'Over position %d.', 'schema-forge' ), t.index + 1 );
			}
			if ( t && t.kind === 'sortable-property' ) {
				const p = state.tree.properties[ t.propertyId ];
				return sprintf( /* translators: %s property */ __( 'Over property %s.', 'schema-forge' ), p ? p.name : '' );
			}
			if ( t && t.kind === 'node' ) {
				const n = state.tree.nodes[ t.nodeId ];
				return sprintf( /* translators: %s type */ __( 'Over node %s.', 'schema-forge' ), n ? n.type : '' );
			}
			if ( over.id === 'drop:root' ) {
				return __( 'Over the empty canvas.', 'schema-forge' );
			}
			return '';
		},
		onDragEnd: () => announcement || __( 'Dropped.', 'schema-forge' ),
		onDragCancel: () => __( 'Drag cancelled.', 'schema-forge' ),
	} ), [ state.tree, announcement ] );

	if ( loading ) {
		return <div className="schema-forge-loading" role="status"><Spinner /> { __( 'Loading template…', 'schema-forge' ) }</div>;
	}
	if ( loadError ) {
		return (
			<div className="schema-forge-screen">
				<Notice status="error" isDismissible={ false }>{ loadError }</Notice>
				<Button variant="secondary" onClick={ () => navigate( 'templates' ) }>{ __( 'Back to templates', 'schema-forge' ) }</Button>
			</div>
		);
	}

	const errorCount = issues.filter( ( i ) => i.level === 'error' ).length;
	const warningCount = issues.length - errorCount;

	return (
		<PreviewTokensContext.Provider value={ previewTokens }>
			<DndContext sensors={ sensors } collisionDetection={ collisionDetection } onDragStart={ onDragStart } onDragEnd={ onDragEnd } onDragCancel={ () => setActiveDrag( null ) } accessibility={ { announcements, screenReaderInstructions: { draggable: __( 'To pick up an item, press space or enter. While dragging, use the arrow keys to move it. Press space or enter again to drop, or escape to cancel. Every drag action also has a button alternative.', 'schema-forge' ) } } }>
				<div className="schema-forge-builder">
					<header className="schema-forge-builder__header">
						<Button icon="arrow-left-alt2" href={ routeUrl( 'templates' ) } onClick={ ( e ) => { e.preventDefault(); if ( ! state.dirty || window.confirm( __( 'Discard unsaved changes?', 'schema-forge' ) ) ) { navigate( 'templates' ); } } } label={ __( 'Back to templates', 'schema-forge' ) } showTooltip />
						<TextControl
							className="schema-forge-builder__name"
							label={ __( 'Template name', 'schema-forge' ) }
							hideLabelFromVision
							placeholder={ __( 'Template name', 'schema-forge' ) }
							value={ state.meta.name }
							onChange={ ( v ) => setMeta( { name: v } ) }
							__nextHasNoMarginBottom
							__next40pxDefaultSize
						/>
						<ToggleControl label={ __( 'Enabled', 'schema-forge' ) } checked={ state.meta.enabled } onChange={ ( v ) => setMeta( { enabled: v } ) } __nextHasNoMarginBottom />
						<span className="schema-forge-builder__status" role="status">
							{ state.dirty ? __( 'Unsaved changes', 'schema-forge' ) : __( 'Saved', 'schema-forge' ) }
						</span>
						<Button icon="undo" label={ __( 'Undo (Ctrl+Z)', 'schema-forge' ) } showTooltip disabled={ ! canUndo } onClick={ undo } />
						<Button icon="redo" label={ __( 'Redo (Ctrl+Shift+Z)', 'schema-forge' ) } showTooltip disabled={ ! canRedo } onClick={ redo } />
						<Button variant="primary" onClick={ save } isBusy={ saving } disabled={ saving }>
							{ state.loadedId ? __( 'Save', 'schema-forge' ) : __( 'Create template', 'schema-forge' ) }
						</Button>
					</header>
					<div className="schema-forge-builder__body">
						<Palette />
						<Canvas previewContext={ previewContext } />
						<aside className="schema-forge-sidebar" aria-label={ __( 'Inspector', 'schema-forge' ) }>
							<TabPanel
								tabs={ [
									{ name: 'inspector', title: __( 'Options', 'schema-forge' ) },
									{ name: 'preview', title: __( 'Preview', 'schema-forge' ) },
									{ name: 'issues', title: issues.length ? sprintf( /* translators: 1: errors 2: warnings */ __( 'Issues (%1$d/%2$d)', 'schema-forge' ), errorCount, warningCount ) : __( 'Issues', 'schema-forge' ) },
								] }
							>
								{ ( tab ) => {
									if ( tab.name === 'preview' ) {
										return <PreviewPanel previewContext={ previewContext } setPreviewContext={ setPreviewContext } onTokens={ setPreviewTokens } />;
									}
									if ( tab.name === 'issues' ) {
										return <IssuesPanel />;
									}
									return <Inspector />;
								} }
							</TabPanel>
						</aside>
					</div>
				</div>
				<DragOverlay dropAnimation={ null }>
					{ activeDrag && activeDrag.kind === 'type' && <div className="schema-forge-drag-ghost">{ activeDrag.typeName }</div> }
					{ activeDrag && activeDrag.kind === 'property' && <div className="schema-forge-drag-ghost">{ activeDrag.name }</div> }
				</DragOverlay>
			</DndContext>
		</PreviewTokensContext.Provider>
	);
}

export default function Builder( props ) {
	return (
		<BuilderProvider>
			<BuilderInner { ...props } />
		</BuilderProvider>
	);
}
