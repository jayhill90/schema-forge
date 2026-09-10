import { useMemo } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useBuilder } from './BuilderContext';
import { useVocab } from '../hooks/useVocab';
import { validateTree } from './validate';
import { config } from '../config';

export function useIssues() {
	const { state } = useBuilder();
	const { core } = useVocab();
	return useMemo( () => validateTree( core, state.tree, { hasYoast: config.hasYoast } ), [ core, state.tree ] );
}

export default function IssuesPanel() {
	const issues = useIssues();
	const { select } = useBuilder();
	if ( ! issues.length ) {
		return <p className="schema-forge-issues__ok">✓ { __( 'No issues found.', 'schema-forge' ) }</p>;
	}
	return (
		<ul className="schema-forge-issues">
			{ issues.map( ( issue, i ) => (
				<li key={ i } className={ `schema-forge-issue schema-forge-issue--${ issue.level }` }>
					<span className="schema-forge-issue__level">{ issue.level }</span>
					<span className="schema-forge-issue__message">{ issue.message }</span>
					{ issue.selection && (
						<Button size="small" variant="link" onClick={ () => select( issue.selection ) }>{ __( 'Show', 'schema-forge' ) }</Button>
					) }
				</li>
			) ) }
		</ul>
	);
}
