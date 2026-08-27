import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
