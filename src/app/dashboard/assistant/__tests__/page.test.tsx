import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MockAdapter from 'axios-mock-adapter';
import { renderWithIntl } from '@/test/render';
import AssistantSettingsPage from '../page';
import api from '@/lib/api';
import * as auth from '@/lib/auth';

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getUser: vi.fn(),
}));

let mock: MockAdapter;

const SETTINGS = {
  enabled: false,
  settings: {
    id: 1,
    name: { ar: 'مساعد شاد', en: 'Shad assistant' },
    welcome: { ar: 'أهلاً {name}', en: 'Hi {name}' },
    welcome_placeholders: ['name'],
  },
  questions: [
    {
      id: 2, key: 'balance', kind: 'data', is_enabled: true, sort_order: 2,
      question: { ar: 'فاضل عليّا كام؟', en: 'How much do I still owe?' },
      default_question: { ar: 'فاضل عليّا كام؟', en: 'How much do I still owe?' },
      states: [{
        state: 'default', ar: 'فاضل عليك {remaining} {currency}', en: 'You owe {remaining} {currency}',
        allowed: ['remaining', 'currency'], required: ['remaining', 'currency'],
        default: { ar: 'فاضل عليك {remaining} {currency}', en: 'You owe {remaining} {currency}' },
      }],
    },
    {
      id: 3, key: 'next_meeting', kind: 'data', is_enabled: false, sort_order: 5,
      question: { ar: 'الاجتماع الجاي إمتى؟', en: 'When is my next meeting?' },
      default_question: { ar: 'الاجتماع الجاي إمتى؟', en: 'When is my next meeting?' },
      states: [],
    },
  ],
  faqs: [
    {
      id: 11, kind: 'faq', is_enabled: true, sort_order: 7, action_target: null,
      question: { ar: 'مواعيد العمل؟', en: 'Working hours?' },
      answer: { ar: 'من 9 لـ 5', en: '9 to 5' },
    },
  ],
  targets: ['contracts', 'payments', 'chat', 'approvals', 'files', 'meetings'],
  limits: { question: 80, answer: 300, faq_answer: 600, faq_max: 20, name: 40, welcome: 200 },
};

beforeEach(() => {
  mock = new MockAdapter(api);
  vi.mocked(auth.getUser).mockReturnValue({ id: 1, role: 'super_admin' } as any);
  mock.onGet('/assistant/questions').reply(200, SETTINGS);
  mock.onPost('/assistant/preview').reply(200, {
    ar: { text: 'فاضل عليك 12,500.00 SAR', error: null },
    en: { text: 'You owe 12,500.00 SAR', error: null },
  });
});

describe('AssistantSettingsPage', () => {
  it('renders nothing for anyone but the super admin', async () => {
    vi.mocked(auth.getUser).mockReturnValue({ id: 2, role: 'account_manager' } as any);
    renderWithIntl(<AssistantSettingsPage />);

    expect(screen.queryByRole('heading', { name: 'Assistant settings' })).toBeNull();
    expect(mock.history.get).toHaveLength(0);
  });

  it('lists the data questions, the FAQs, and says the assistant is off for clients', async () => {
    renderWithIntl(<AssistantSettingsPage />);

    expect(await screen.findByText('How much do I still owe?')).toBeInTheDocument();
    expect(screen.getByText('Working hours?')).toBeInTheDocument();
    expect(screen.getByText('Off for clients')).toBeInTheDocument();
    expect(screen.getByText('1 / 20')).toBeInTheDocument();
  });

  it('hides a question from clients with its switch', async () => {
    mock.onPut('/assistant/questions/2').reply(200, {});
    const user = userEvent.setup();
    renderWithIntl(<AssistantSettingsPage />);

    await screen.findByText('How much do I still owe?');
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');

    await user.click(switches[0]);

    await waitFor(() => expect(mock.history.put).toHaveLength(1));
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ is_enabled: false });
  });

  it('does not offer to delete a data question, only a FAQ', async () => {
    renderWithIntl(<AssistantSettingsPage />);

    await screen.findByText('How much do I still owe?');

    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
  });

  it('deletes a FAQ after confirming', async () => {
    mock.onDelete('/assistant/questions/11').reply(200, {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderWithIntl(<AssistantSettingsPage />);

    await screen.findByText('Working hours?');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
  });

  it('edits a wording, previews it, and shows the server message under the field when it is refused', async () => {
    mock.onPut('/assistant/questions/2').reply(422, {
      message: 'invalid',
      errors: { 'answers.default.en': ['The answer must contain {remaining}.'] },
    });
    const user = userEvent.setup();
    renderWithIntl(<AssistantSettingsPage />);

    await screen.findByText('How much do I still owe?');
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1]); // [0] is the general settings

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('You owe 12,500.00 SAR')).toBeInTheDocument();

    const field = within(dialog).getByLabelText('Answer (English)');
    await user.clear(field);
    await user.type(field, 'You owe money');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('The answer must contain {remaining}.')).toBeInTheDocument();
    expect(JSON.parse(mock.history.put[0].data).answers.default.en).toBe('You owe money');
  });

  it('blocks saving while the preview reports a problem', async () => {
    mock.onPost('/assistant/preview').reply(200, {
      ar: { text: '', error: 'الرد لازم يحتوي على {remaining}.' },
      en: { text: 'x', error: null },
    });
    const user = userEvent.setup();
    renderWithIntl(<AssistantSettingsPage />);

    await screen.findByText('How much do I still owe?');
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1]);

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled());
  });
});
