import { MessageTimestamp, MessageTimestampFormat } from '@went.tf/hammertime-core';
import { EmbedTextData, findEmbedsTextFields, findTextComponentContentsRecursively } from './messaging.js';
import { ComponentType, TopLevelComponent } from 'discord.js';
import { describe, expect, it } from 'vitest';

describe('messaging', () => {
  const now = new Date();
  const shortTimeTs = new MessageTimestamp(now).toString(MessageTimestampFormat.SHORT_TIME);
  const longTimeTs = new MessageTimestamp(now).toString(MessageTimestampFormat.SHORT_TIME);
  const shortDateTs = new MessageTimestamp(now).toString(MessageTimestampFormat.SHORT_DATE);
  const shortFullTs = new MessageTimestamp(now).toString(MessageTimestampFormat.SHORT_FULL);
  const longFullTs = new MessageTimestamp(now).toString(MessageTimestampFormat.LONG_FULL);
  const relativeTs = new MessageTimestamp(now).toString(MessageTimestampFormat.RELATIVE);

  describe('findEmbedsTextFields', () => {
    it('should extract timestamps from embeds correctly', () => {
      const embeds: EmbedTextData[] = [
        {
          title: shortTimeTs,
          description: shortDateTs,
          footer: {
            text: shortFullTs,
          },
          fields: [
            {
              name: longTimeTs,
              value: longFullTs,
            },
          ],
        },
        {
          description: relativeTs,
        },
      ];

      const result = findEmbedsTextFields(embeds);
      expect(result).toEqual([
        shortTimeTs,
        shortDateTs,
        shortFullTs,
        longTimeTs,
        longFullTs,
        relativeTs,
      ]);
    });
  });

  describe('findTextComponentContentsRecursively', () => {
    it('should extract timestamps from text components correctly', () => {
      const components = [
        {
          type: ComponentType.TextDisplay,
          content: shortTimeTs,
        },
        {
          type: ComponentType.Section,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: shortDateTs,
            },
          ],
        },
        {
          type: ComponentType.Container,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: shortFullTs,
            },
            {
              type: ComponentType.TextDisplay,
              content: longFullTs,
            },
          ],
        },
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.TextDisplay,
              content: relativeTs,
            },
          ],
        },
      ] as TopLevelComponent[];

      const result = findTextComponentContentsRecursively(components);
      expect(result).toEqual([
        shortTimeTs,
        shortDateTs,
        shortFullTs,
        longFullTs,
        relativeTs,
      ]);
    });
  });
});
