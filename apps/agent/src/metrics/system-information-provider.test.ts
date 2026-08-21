import { parseWindowsDriveRoots } from './system-information-provider.js';

describe('parseWindowsDriveRoots', () => {
  it('accepts only unique drive-root lines', () => {
    expect(parseWindowsDriveRoots('C:\\\r\nD:\\\nC:\\\nnot-a-drive\n')).toEqual(
      ['C:\\', 'D:\\'],
    );
  });

  it('rejects output without a fixed-drive root', () => {
    expect(() => parseWindowsDriveRoots('')).toThrow(
      'No fixed Windows drive is available.',
    );
  });
});
