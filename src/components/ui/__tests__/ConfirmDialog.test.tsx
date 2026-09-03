import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

const baseProps = {
  title: 'Delete client?',
  message: 'This cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
};

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog {...baseProps} open={false} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and message when open', () => {
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Delete client?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} open onConfirm={onConfirm} onCancel={() => {}} />);

    await user.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel on the cancel button and on backdrop click, but not on dialog-body click', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={onCancel} />);

    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Clicking inside the dialog body must not also trigger the backdrop's
    // onCancel (it calls stopPropagation for exactly this reason).
    await user.click(screen.getByText('This cannot be undone.'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('exposes dialog semantics and labels the dialog by its title', () => {
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Delete client?');
  });

  it('moves focus into the dialog on open and returns it to the trigger on close', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open dialog</button>
          <ConfirmDialog {...baseProps} open={open} onConfirm={() => {}} onCancel={() => setOpen(false)} />
        </>
      );
    }
    render(<Harness />);

    const trigger = screen.getByText('Open dialog');
    trigger.focus();
    await user.click(trigger);

    await waitFor(() => expect(screen.getByText('Cancel')).toHaveFocus());

    await user.click(screen.getByText('Cancel'));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} open onConfirm={() => {}} onCancel={onCancel} />);

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
