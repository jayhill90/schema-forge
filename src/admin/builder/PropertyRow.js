import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
	Button,
	DropdownMenu,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useBuilder, useSelection } from './BuilderContext';
import PropertyPicker from './PropertyPicker';
import ValueEditor from './ValueEditor';
import { useVocab } from '../hooks/useVocab';
import { getRange, suggestDataType } from '../../shared/vocab';

export default function PropertyRow( {
	propertyId,
	nodeType,
	index,
	total,
	previewContext,
} ) {
	const { state, updateProperty, removeProperty, moveProperty, addValue } =
		useBuilder();
	const { core } = useVocab();
	const property = state.tree.properties[ propertyId ];
	const [ isSelected, select ] = useSelection( 'property', propertyId );

	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
		isOver,
		active,
	} = useSortable( {
		id: propertyId,
		data: {
			kind: 'sortable-property',
			nodeId: property ? property.nodeId : null,
			index,
			propertyId,
		},
	} );

	if ( ! property ) {
		return null;
	}

	const typeDropHover =
		isOver &&
		active &&
		active.data.current &&
		active.data.current.kind === 'type';
	const style = {
		transform: CSS.Transform.toString( transform ),
		transition,
	};
	const range = getRange( core, property.name );
	const badges = [];
	if ( property.onEmpty === 'dropNode' ) {
		badges.push( __( 'required', 'schema-forge' ) );
	}
	if ( property.dataType !== 'auto' ) {
		badges.push( property.dataType );
	}

	return (
		<li
			ref={ setNodeRef }
			style={ style }
			className={ `schema-forge-property${ isSelected ? ' is-selected' : '' }${ isDragging ? ' is-dragging' : '' }${ typeDropHover ? ' is-drop-target' : '' }` }
			onClickCapture={ select }
			onFocusCapture={ select }
			data-property-id={ propertyId }
		>
			<div className="schema-forge-property__head">
				<button
					type="button"
					ref={ setActivatorNodeRef }
					className="schema-forge-drag-handle"
					{ ...listeners }
					{ ...attributes }
					aria-label={ sprintf(
						/* translators: %s property */ __(
							'Drag to reorder “%s”',
							'schema-forge'
						),
						property.name || __( 'property', 'schema-forge' )
					) }
				>
					⠿
				</button>
				<div className="schema-forge-property__name">
					<PropertyPicker
						typeName={ nodeType }
						value={ property.name }
						label={ __( 'Property name', 'schema-forge' ) }
						onChange={ ( name ) => {
							const patch = { name };
							if ( property.dataType === 'auto' ) {
								const suggested = suggestDataType( core, name );
								if ( suggested !== 'auto' ) {
									patch.dataType = suggested;
								}
							}
							updateProperty( propertyId, patch );
						} }
					/>
				</div>
				<div className="schema-forge-property__badges">
					{ badges.map( ( b ) => (
						<span key={ b } className="schema-forge-badge">
							{ b }
						</span>
					) ) }
				</div>
				<div className="schema-forge-property__actions">
					<Button
						size="small"
						icon="arrow-up-alt2"
						label={ __( 'Move property up', 'schema-forge' ) }
						disabled={ index === 0 }
						onClick={ () =>
							moveProperty( property.nodeId, index, index - 1 )
						}
					/>
					<Button
						size="small"
						icon="arrow-down-alt2"
						label={ __( 'Move property down', 'schema-forge' ) }
						disabled={ index === total - 1 }
						onClick={ () =>
							moveProperty( property.nodeId, index, index + 1 )
						}
					/>
					<DropdownMenu
						icon="plus-alt2"
						label={ __( 'Add value', 'schema-forge' ) }
						toggleProps={ { size: 'small' } }
					>
						{ ( { onClose } ) => (
							<MenuGroup>
								<MenuItem
									onClick={ () => {
										addValue( propertyId, 'text' );
										onClose();
									} }
								>
									{ __( 'Text / token', 'schema-forge' ) }
								</MenuItem>
								<MenuItem
									onClick={ () => {
										addValue( propertyId, 'node' );
										onClose();
									} }
								>
									{ __( 'Nested node', 'schema-forge' ) }
								</MenuItem>
								<MenuItem
									onClick={ () => {
										addValue( propertyId, 'ref' );
										onClose();
									} }
								>
									{ __( 'Reference (@id)', 'schema-forge' ) }
								</MenuItem>
								<MenuItem
									onClick={ () => {
										addValue( propertyId, 'repeat' );
										onClose();
									} }
								>
									{ __(
										'Repeat over a list',
										'schema-forge'
									) }
								</MenuItem>
							</MenuGroup>
						) }
					</DropdownMenu>
					<Button
						size="small"
						icon="trash"
						isDestructive
						label={ sprintf(
							/* translators: %s property */ __(
								'Remove property “%s”',
								'schema-forge'
							),
							property.name
						) }
						onClick={ () => removeProperty( propertyId ) }
					/>
				</div>
			</div>
			{ range.length > 0 && property.valueIds.length === 0 && (
				<p className="schema-forge-property__hint">
					{ sprintf(
						/* translators: %s types */ __(
							'Expects %s. Drop a type here to nest it, or add a value.',
							'schema-forge'
						),
						range.join( ', ' )
					) }
				</p>
			) }
			<div className="schema-forge-property__values">
				{ property.valueIds.map( ( vid, i ) => (
					<ValueEditor
						key={ vid }
						valueId={ vid }
						property={ property }
						index={ i }
						total={ property.valueIds.length }
						previewContext={ previewContext }
					/>
				) ) }
				{ property.valueIds.length === 0 && (
					<Button
						variant="secondary"
						size="small"
						onClick={ () => addValue( propertyId, 'text' ) }
					>
						{ __( 'Add a value', 'schema-forge' ) }
					</Button>
				) }
			</div>
		</li>
	);
}
