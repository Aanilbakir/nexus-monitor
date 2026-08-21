import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { HistoryQueryDto } from './history-query.dto.js';

describe('HistoryQueryDto', () => {
  it.each(['1h', '6h', '24h', '7d', '30d'])(
    'accepts the supported %s range',
    async (range) => {
      await expect(
        validate(plainToInstance(HistoryQueryDto, { range })),
      ).resolves.toHaveLength(0);
    },
  );

  it.each([undefined, '', '90d', '24hours'])(
    'rejects unsupported range %s',
    async (range) => {
      const errors = await validate(
        plainToInstance(HistoryQueryDto, { range }),
      );
      expect(errors.map((error) => error.property)).toContain('range');
    },
  );
});
