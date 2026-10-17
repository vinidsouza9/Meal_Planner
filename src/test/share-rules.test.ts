import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareFile } from '@/lib/share';

afterEach(() => vi.unstubAllGlobals());
describe('PDF sharing', () => {
  it('sends only the PDF file and title without downloading', async () => {
    const file = new File(['pdf'], 'meal-plan.pdf', { type: 'application/pdf' });
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { canShare: () => true, share });
    expect(await shareFile(file, 'Meal plan')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Meal plan' });
  });
  it('cancelling native sharing is silent', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) });
    expect(await shareFile(new File(['pdf'], 'plan.pdf'), 'Meal plan')).toBe('shared');
  });
  it('unsupported file sharing returns the explicit fallback', async () => {
    const share = vi.fn();
    vi.stubGlobal('navigator', { canShare: () => false, share });
    expect(await shareFile(new File(['pdf'], 'plan.pdf'), 'Meal plan')).toBe('menu');
    expect(share).not.toHaveBeenCalled();
  });
});