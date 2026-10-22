import { MessageTimestamp, MessageTimestampFormat } from './message-timestamp.js';
import { describe, expect, it } from 'vitest';


describe('MessageTimestamp', () => {
  const nowInMilliseconds = 1629274020123;
  const nowInSeconds = Math.floor(nowInMilliseconds / 1000);
  const now = new Date(nowInMilliseconds);
  const ts = new MessageTimestamp(now);

  it('should stringify to the long full format by default', () => {
    expect(String(ts)).toEqual(`<t:${nowInSeconds}:F>`);
    expect(ts.toString()).toEqual(`<t:${nowInSeconds}:F>`);
    expect(`Event date: ${ts} (don't be late!)`)
      .toEqual(`Event date: <t:${nowInSeconds}:F> (don't be late!)`);
  });

  it('should stringify to the provided string representation', () => {
    expect(ts.toString(MessageTimestampFormat.SHORT_DATE)).toEqual(`<t:${nowInSeconds}:d>`);
    expect(ts.toString(MessageTimestampFormat.SHORT_FULL)).toEqual(`<t:${nowInSeconds}:f>`);
    expect(ts.toString(MessageTimestampFormat.SHORT_TIME)).toEqual(`<t:${nowInSeconds}:t>`);
    expect(ts.toString(MessageTimestampFormat.LONG_DATE)).toEqual(`<t:${nowInSeconds}:D>`);
    expect(ts.toString(MessageTimestampFormat.LONG_FULL)).toEqual(`<t:${nowInSeconds}:F>`);
    expect(ts.toString(MessageTimestampFormat.RELATIVE)).toEqual(`<t:${nowInSeconds}:R>`);
    expect(ts.toString(MessageTimestampFormat.LONG_TIME)).toEqual(`<t:${nowInSeconds}:T>`);
  });
});
