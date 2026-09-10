import { useEffect, useRef, useState } from '@wordpress/element';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useBuilder, useSelect } from './BuilderContext';
import PropertyRow from './PropertyRow';
import PropertyPicker from './PropertyPicker';
import { nodeDepth, usedPropertyNames } from '../../shared/tree/selectors';

export default function NodeCard( { nodeId, previewContext } ) {
	const { state, addProperty, clearNode, setNodeOption, select } = useBuilder();
	const node = state.tree.nodes[ nodeId ];
	const [ isSelected, doSelect ] = useSelect( 'node', nodeId );
	const [ adding, setAdding ] = useState( false );
	const addRef = useRef( null );
	const { setNodeRef, isOver, active } = useDroppable( { id: `drop:node:${ nodeId }`, data: { kind: 'node', nodeId } } );

	useEffect( () => {
		if ( adding && addRef.current ) {
			const input = addRef.current.querySelector( 'input' );
			if ( input ) {
				input.focus();
			}
		}
	}, [ adding ] );

	if ( ! node ) {
		return null;
	}
	const isRoot = nodeId === state.tree.rootId;
	const depth = nodeDepth( state.tree, nodeId );
	const collapsed = Boolean( node.options.collapsed );
	const propertyDropHover = isOver && active && active.data.current && active.data.current.kind === 'property';
	const used = usedPropertyNames( state.tree, nodeId );
	const types = [ node.type, ...( node.options.extraTypes || [] ) ];

	return (
		<section
			ref={ setNodeRef }
			className={ `schema-forge-node${ isRoot ? ' is-root' : '' }${ isSelected ? ' is-selected' : '' }${ propertyDropHover ? ' is-drop-target' : '' }` }
			style={ { '--sf-depth': depth } }
			aria-label={ sprintf( /* translators: %s type */ __( '%s node', 'schema-forge' ), node.type ) }
			data-node-id={ nodeId }
		>
			<header className="schema-forge-node__head" onClick={ doSelect } onKeyDown={ ( e ) => { if ( e.key === 'Enter' ) { doSelect(); } } } role="button" tabIndex={ 0 }>
				<Button
					size="small"
					icon={ collapsed ? 'arrow-right-alt2' : 'arrow-down-alt2' }
					label={ collapsed ? __( 'Expand node', 'schema-forge' ) : __( 'Collapse node', 'schema-forge' ) }
					onClick={ ( e ) => { e.stopPropagation(); setNodeOption( nodeId, 'collapsed', ! collapsed ); } }
					aria-expanded={ ! collapsed }
				/>
				<span className="schema-forge-node__type">{ types.join( ' + ' ) }</span>
				{ isRoot && <span className="schema-forge-badge schema-forge-badge--root">{ __( 'root', 'schema-forge' ) }</span> }
				{ node.options.isMainEntity && <span className="schema-forge-badge schema-forge-badge--main">{ __( 'main entity', 'schema-forge' ) }</span> }
				{ ! isRoot && node.options.placement === 'graph' && <span className="schema-forge-badge">{ __( 'in graph (@id)', 'schema-forge' ) }</span> }
				<span className="schema-forge-node__count">{ sprintf( /* translators: %d count */ __( '%d properties', 'schema-forge' ), node.propertyIds.length ) }</span>
				<span className="schema-forge-node__actions">
					<Button size="small" variant="tertiary" onClick={ ( e ) => { e.stopPropagation(); select( { kind: 'node', id: nodeId } ); } }>{ __( 'Options', 'schema-forge' ) }</Button>
					{ ! isRoot && node.parentValueId && (
						<Button size="small" icon="no-alt" isDestructive label={ __( 'Remove nested node', 'schema-forge' ) } onClick={ ( e ) => { e.stopPropagation(); clearNode( node.parentValueId ); } } />
					) }
				</span>
			</header>
			{ ! collapsed && (
				<div className="schema-forge-node__body">
					<SortableContext items={ node.propertyIds } strategy={ verticalListSortingStrategy }>
						<ul className="schema-forge-node__properties">
							{ node.propertyIds.map( ( pid, i ) => (
								<PropertyRow key={ pid } propertyId={ pid } nodeType={ node.type } index={ i } total={ node.propertyIds.length } previewContext={ previewContext } />
							) ) }
						</ul>
					</SortableContext>
					{ adding ? (
						<div className="schema-forge-node__add" ref={ addRef }>
							<PropertyPicker
								typeName={ node.type }
								value=""
								exclude={ used }
								label={ __( 'New property', 'schema-forge' ) }
								onChange={ ( name ) => {
									addProperty( nodeId, name, { initialValue: { kind: 'text', value: '' } } );
									setAdding( false );
								} }
							/>
							<Button variant="tertiary" size="small" onClick={ () => setAdding( false ) }>{ __( 'Cancel', 'schema-forge' ) }</Button>
						</div>
					) : (
						<div className="schema-forge-node__footer">
							<Button variant="secondary" size="small" icon="plus-alt2" onClick={ () => setAdding( true ) }>{ __( 'Add property', 'schema-forge' ) }</Button>
							<span className="schema-forge-muted">{ __( 'or drag a property from the palette', 'schema-forge' ) }</span>
						</div>
					) }
				</div>
			) }
		</section>
	);
}
