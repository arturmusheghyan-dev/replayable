import { z } from 'zod';

import { dimensionNameSchema, requiredStringSchema } from './base.js';
import { networkSchema } from './variants.js';

const eventNameSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/, 'Event names must use lower_snake_case')
  .refine((value) => !value.startsWith('replayable_'), {
    message: 'The replayable_ prefix is reserved for engine events',
  });

const eventDefinitionSchema = z.strictObject({
  description: requiredStringSchema.optional(),
  integer: z
    .strictObject({
      min: z.number().int(),
      max: z.number().int(),
    })
    .refine(({ min, max }) => min <= max, {
      message: 'Integer event minimum must be less than or equal to its maximum',
    })
    .optional(),
});

const postHogDestinationSchema = z.strictObject({
  type: z.literal('posthog'),
  endpoint: z.url().refine((value) => value.startsWith('https://'), {
    message: 'Analytics endpoints must use HTTPS',
  }),
  projectToken: z.string().regex(/^phc_[A-Za-z0-9]+$/, 'Invalid PostHog project token'),
});

/** A boolean sets all networks; a map overrides only the named networks. */
const networkSwitchSchema = z.union([z.boolean(), z.partialRecord(networkSchema, z.boolean())]);

export const analyticsSchema = z
  .union([
    z.literal(false),
    z
      .strictObject({
        buildId: requiredStringSchema,
        destinations: z.record(dimensionNameSchema, postHogDestinationSchema).default({}),
        logging: networkSwitchSchema.default(false),
        sending: networkSwitchSchema.default(true),
        routes: z
          .partialRecord(networkSchema, z.union([dimensionNameSchema, z.literal(false)]))
          .default({}),
        events: z.record(eventNameSchema, eventDefinitionSchema).default({}),
      })
      .superRefine(({ destinations, routes }, context) => {
        for (const [network, destination] of Object.entries(routes)) {
          if (
            destination !== false &&
            destination !== undefined &&
            !(destination in destinations)
          ) {
            context.addIssue({
              code: 'custom',
              message: `Unknown analytics destination: ${destination}`,
              path: ['routes', network],
            });
          }
        }
      }),
  ])
  .default(false);

export type AnalyticsDestination = z.infer<typeof postHogDestinationSchema>;
export type AnalyticsEventDefinition = z.infer<typeof eventDefinitionSchema>;
