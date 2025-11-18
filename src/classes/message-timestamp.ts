export enum MessageTimestampFormat {
  /** @example `18/08/2021` */
  SHORT_DATE = 'd',
  /** @example `18 August 2021 09:52` */
  SHORT_FULL = 'f',
  /** @example `09:52` */
  SHORT_TIME = 't',
  /** @example `18 August 2021` */
  LONG_DATE = 'D',
  /** @example `Wednesday, 18 August 2021 09:52` */
  LONG_FULL = 'F',
  /** @example `18/08/2021 09:52` */
  SHORT_COMPACT = 's',
  /** @example `18/08/2021 09:52:00` */
  LONG_COMPACT = 'S',
  /** @example `8 minutes ago` */
  RELATIVE = 'R',
  /** @example `09:52:00` */
  LONG_TIME = 'T',
}

export const validFormatsSet = new Set<MessageTimestampFormat>([
  MessageTimestampFormat.SHORT_DATE,
  MessageTimestampFormat.SHORT_FULL,
  MessageTimestampFormat.SHORT_TIME,
  MessageTimestampFormat.LONG_DATE,
  MessageTimestampFormat.LONG_FULL,
  MessageTimestampFormat.LONG_COMPACT,
  MessageTimestampFormat.SHORT_COMPACT,
  MessageTimestampFormat.RELATIVE,
  MessageTimestampFormat.LONG_TIME,
]);

export class MessageTimestamp {
  constructor(private date: Date) {
  }

  toString<F extends MessageTimestampFormat>(tsFormat: F): `<t:${string}:${F}>`;
  toString(tsFormat?: undefined): `<t:${string}:${MessageTimestampFormat.LONG_FULL}>`;

  toString<F extends MessageTimestampFormat>(tsFormat?: F): `<t:${string}:${F | MessageTimestampFormat.LONG_FULL}>` {
    return MessageTimestamp.fromTimestamp(this.getUnixSeconds(), tsFormat);
  }

  getUnixSeconds(): number {
    return Math.floor(this.date.getTime() / 1000);
  }

  static fromTimestamp<F extends MessageTimestampFormat>(unixTimestamp: string | number, tsFormat?: F): `<t:${string}:${F | MessageTimestampFormat.LONG_FULL}>` {
    return `<t:${unixTimestamp}:${tsFormat || MessageTimestampFormat.LONG_FULL}>`;
  }

  static isValidFormat(input: string | null): input is MessageTimestampFormat {
    if (typeof input !== 'string') return false;
    return validFormatsSet.has(input as unknown as MessageTimestampFormat);
  }
}
