import { Button, Flex, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Confirmation dialog. Closes on Escape and on backdrop click (Modal defaults).
 *
 * @param {Object}          props
 * @param {string}          props.title           Dialog heading.
 * @param {Element}         props.children        Dialog body.
 * @param {string}          [props.confirmLabel]  Confirm button text; defaults to "Confirm".
 * @param {function():void} props.onConfirm       Called when the confirm button is pressed.
 * @param {function():void} props.onCancel        Called on Cancel, Escape or backdrop click.
 * @param {boolean}         [props.isDestructive] Style the confirm button as destructive (default true).
 * @param {boolean}         [props.busy]          Disable both buttons and show progress.
 * @return {Element} The modal.
 */
export default function ConfirmModal( {
	title,
	children,
	confirmLabel,
	onConfirm,
	onCancel,
	isDestructive = true,
	busy = false,
} ) {
	return (
		<Modal
			title={ title }
			onRequestClose={ onCancel }
			size="small"
			shouldCloseOnClickOutside
			shouldCloseOnEsc
		>
			<div className="schema-forge-confirm__body">{ children }</div>
			<Flex justify="flex-end" gap={ 2 } style={ { marginTop: 16 } }>
				<Button
					variant="tertiary"
					onClick={ onCancel }
					disabled={ busy }
				>
					{ __( 'Cancel', 'schema-forge' ) }
				</Button>
				<Button
					variant="primary"
					isDestructive={ isDestructive }
					onClick={ onConfirm }
					isBusy={ busy }
					disabled={ busy }
				>
					{ confirmLabel || __( 'Confirm', 'schema-forge' ) }
				</Button>
			</Flex>
		</Modal>
	);
}
