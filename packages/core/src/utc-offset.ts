import { pad } from './numbers.js';

export class UtcOffset {
  get totalMinutes(): number {
    return (60 * this.hours) + (this.hours < 0 ? -1 : 1) * this.minutes;
  }

  constructor(public readonly hours: number = 0, public readonly minutes: number = 0) {
  }

  toString(padHours = true): string {
    let outputHours: number | string = Math.abs(this.hours);
    if (padHours) {
      outputHours = pad(outputHours, 2);
    }
    return `${this.hours < 0 ? '-' : '+'}${outputHours}:${pad(this.minutes, 2)}`;
  }
}
