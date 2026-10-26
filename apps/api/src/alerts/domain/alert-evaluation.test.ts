import {
  buildDedupeKey,
  evaluateAlertRule,
  type AlertRule,
  type MetricSample,
} from './alert-evaluation.js';

const baseRule: AlertRule = {
  comparison: '>',
  durationSeconds: 60,
  id: '11111111-1111-4111-8111-111111111111',
  threshold: 80,
};

function sample(secondsFromEpoch: number, value: number): MetricSample {
  return { collectedAt: new Date(secondsFromEpoch * 1_000), value };
}

describe('evaluateAlertRule', () => {
  it('reports insufficient data when there are no samples', () => {
    expect(evaluateAlertRule(baseRule, [])).toEqual({
      state: 'INSUFFICIENT_DATA',
    });
  });

  it('breaches on duration 0 using only the latest sample', () => {
    const rule = { ...baseRule, durationSeconds: 0 };
    const samples = [sample(0, 10), sample(60, 90)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 90,
      state: 'BREACHING',
    });
  });

  it('clears on duration 0 when the latest sample does not breach', () => {
    const rule = { ...baseRule, durationSeconds: 0 };
    const samples = [sample(0, 90), sample(60, 10)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 10,
      state: 'CLEAR',
    });
  });

  it('clears when any sample inside the duration window does not breach', () => {
    const rule = { ...baseRule, durationSeconds: 60 };
    const samples = [sample(0, 90), sample(30, 79), sample(60, 95)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 95,
      state: 'CLEAR',
    });
  });

  it('breaches when every sample inside the duration window breaches', () => {
    const rule = { ...baseRule, durationSeconds: 60 };
    const samples = [sample(0, 90), sample(30, 85), sample(60, 95)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 95,
      state: 'BREACHING',
    });
  });

  it('excludes samples older than the window boundary', () => {
    const rule = { ...baseRule, durationSeconds: 60 };
    const samples = [sample(-1, 10), sample(0, 90), sample(60, 95)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 95,
      state: 'BREACHING',
    });
  });

  it('includes a sample exactly at the window boundary', () => {
    const rule = { ...baseRule, durationSeconds: 60 };
    const samples = [sample(0, 10), sample(60, 95)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 95,
      state: 'CLEAR',
    });
  });

  it('produces the same result when samples are given in descending order', () => {
    const rule = { ...baseRule, durationSeconds: 60 };
    const samples = [sample(60, 95), sample(30, 85), sample(0, 90)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 95,
      state: 'BREACHING',
    });
  });

  it('produces the same result when samples are given in shuffled order', () => {
    const rule = { ...baseRule, durationSeconds: 60 };
    const samples = [sample(30, 85), sample(0, 90), sample(60, 95)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 95,
      state: 'BREACHING',
    });
  });

  it('reports insufficient data when a sample inside the window is NaN', () => {
    const rule = { ...baseRule, durationSeconds: 60 };
    const samples = [sample(0, 90), sample(30, NaN), sample(60, 95)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      state: 'INSUFFICIENT_DATA',
    });
  });

  it('reports insufficient data when a sample inside the window is infinite', () => {
    const rule: AlertRule = {
      ...baseRule,
      comparison: '<',
      durationSeconds: 60,
    };
    const samples = [sample(0, 10), sample(30, Infinity), sample(60, 5)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      state: 'INSUFFICIENT_DATA',
    });
  });

  it('ignores a NaN sample outside the duration window', () => {
    const rule = { ...baseRule, durationSeconds: 60 };
    const samples = [sample(-100, NaN), sample(0, 90), sample(60, 95)];

    expect(evaluateAlertRule(rule, samples)).toEqual({
      observedValue: 95,
      state: 'BREACHING',
    });
  });

  it('breaches with the > comparison only when the value exceeds the threshold', () => {
    const rule: AlertRule = {
      ...baseRule,
      comparison: '>',
      durationSeconds: 0,
    };

    expect(evaluateAlertRule(rule, [sample(0, 81)]).state).toBe('BREACHING');
    expect(evaluateAlertRule(rule, [sample(0, 80)]).state).toBe('CLEAR');
  });

  it('breaches with the >= comparison when the value meets or exceeds the threshold', () => {
    const rule: AlertRule = {
      ...baseRule,
      comparison: '>=',
      durationSeconds: 0,
    };

    expect(evaluateAlertRule(rule, [sample(0, 80)]).state).toBe('BREACHING');
    expect(evaluateAlertRule(rule, [sample(0, 79)]).state).toBe('CLEAR');
  });

  it('breaches with the < comparison only when the value is below the threshold', () => {
    const rule: AlertRule = {
      ...baseRule,
      comparison: '<',
      durationSeconds: 0,
    };

    expect(evaluateAlertRule(rule, [sample(0, 79)]).state).toBe('BREACHING');
    expect(evaluateAlertRule(rule, [sample(0, 80)]).state).toBe('CLEAR');
  });

  it('breaches with the <= comparison when the value is at or below the threshold', () => {
    const rule: AlertRule = {
      ...baseRule,
      comparison: '<=',
      durationSeconds: 0,
    };

    expect(evaluateAlertRule(rule, [sample(0, 80)]).state).toBe('BREACHING');
    expect(evaluateAlertRule(rule, [sample(0, 81)]).state).toBe('CLEAR');
  });

  it('builds the dedupe key from the rule and agent identifiers', () => {
    expect(buildDedupeKey('rule-1', 'agent-1')).toBe('rule-1:agent-1');
  });
});
