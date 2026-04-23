import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-quill', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((_props, ref) => {
      return <textarea ref={ref} data-testid="quill" />;
    }),
  };
});

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import toast from 'react-hot-toast';
import RichTextEditor from './RichTextEditor';

describe('RichTextEditor', () => {
  it('opens the AI modal and validates file uploads', async () => {
    const user = userEvent.setup();
    vi.clearAllMocks();
    render(<RichTextEditor value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /توليد المحتوى بالذكاء الاصطناعي/ }));
    expect(screen.getByRole('heading', { name: /توليد المحتوى بالذكاء الاصطناعي/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /رفع ملف/ }));

    const fileInput = screen.getByLabelText(/اختر ملف البحث أو النص/) as HTMLInputElement;
    const invalidFile = new File(['data'], 'image.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('يرجى اختيار ملف PDF أو نص فقط');
    });

    const validFile = new File(['data'], 'paper.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [validFile] } });
    expect(await screen.findByText('paper.pdf')).toBeInTheDocument();
  });
});
