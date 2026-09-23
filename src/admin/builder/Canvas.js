import { useDroppable } from '@dnd-kit/core';
import { __ } from '@wordpress/i18n';
import { useBuilder } from './BuilderContext';
import NodeCard from './NodeCard';
import TypePicker from './TypePicker';

export default function Canvas( { previewContext } ) {
	const { state, setRootType } = useBuilder();
	const { setNodeRef, isOver, active } = useDroppable( {
		id: 'drop:root',
		data: { kind: 'root' },
	} );
	const typeHover =
		isOver &&
		active &&
		active.data.current &&
		active.data.current.kind === 'type';

	return (
		<main
			className="schema-forge-canvas"
			aria-label={ __( 'Template canvas', 'schema-forge' ) }
		>
			{ state.tree.rootId ? (
				<NodeCard
					nodeId={ state.tree.rootId }
					previewContext={ previewContext }
				/>
			) : (
				<div
					ref={ setNodeRef }
					className={ `schema-forge-canvas__empty${ typeHover ? ' is-drop-target' : '' }` }
				>
					<h3>{ __( 'Start with a root type', 'schema-forge' ) }</h3>
					<p>
						{ __(
							'Drag a type from the palette here, or search for one below. The root becomes a node in the page’s schema graph.',
							'schema-forge'
						) }
					</p>
					<div className="schema-forge-canvas__picker">
						<TypePicker
							value=""
							onChange={ ( t ) => t && setRootType( t ) }
							suggested={ [
								'Product',
								'LocalBusiness',
								'Organization',
								'FAQPage',
								'Event',
								'Recipe',
								'Article',
								'Service',
								'Person',
							] }
							label={ __( 'Root type', 'schema-forge' ) }
						/>
					</div>
				</div>
			) }
		</main>
	);
}
