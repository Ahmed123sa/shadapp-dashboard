import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from '@/test/render';
import PasswordField from '../PasswordField';

describe('PasswordField', () => {
  it('starts masked and toggles to plain text on the visibility button', async () => {
    const user = userEvent.setup();
    renderWithIntl(<PasswordField value="secret123" onChange={() => {}} />);

    const input = screen.getByPlaceholderText('Enter password');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button'));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('calls onChange with the typed value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<PasswordField value="" onChange={onChange} />);

    await user.type(screen.getByPlaceholderText('Enter password'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('reports "Weak" for a short, letters-only value', () => {
    renderWithIntl(<PasswordField value="abc" onChange={() => {}} />);
    expect(screen.getByText('Weak')).toBeInTheDocument();
  });

  it('reports "Medium" once exactly two of the three requirements are met', () => {
    // 8 letters, no digit: length>=8 and has-a-letter are met, has-a-digit is not.
    renderWithIntl(<PasswordField value="abcdefgh" onChange={() => {}} />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('reports "Strong" once length, a letter and a digit are all present', () => {
    renderWithIntl(<PasswordField value="abcdefg1" onChange={() => {}} />);
    // length>=8 (yes), has letter (yes), has digit (yes) => all 3 met => Strong
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('hides the strength meter entirely when showStrength is false', () => {
    renderWithIntl(<PasswordField value="abc" onChange={() => {}} showStrength={false} />);
    expect(screen.queryByText('Weak')).not.toBeInTheDocument();
  });

  it('renders the requirement checklist with met/unmet items', () => {
    renderWithIntl(<PasswordField value="abcdefg1" onChange={() => {}} />);
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One English letter')).toBeInTheDocument();
    expect(screen.getByText('One number')).toBeInTheDocument();
  });
});
