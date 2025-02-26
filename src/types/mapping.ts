import { z } from 'zod';

// HTTP Method types
export const HttpMethod = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
export type HttpMethod = z.infer<typeof HttpMethod>;

// Transformation expression schema
export const TransformExpression = z.string();
export type TransformExpression = z.infer<typeof TransformExpression>;

// Downstream API call configuration
export const DownstreamCall = z.object({
  name: z.string().optional(),
  method: HttpMethod,
  path: z.string(),
  condition: TransformExpression.optional(),
  transform: z.record(z.string(), TransformExpression),
  merge: z.boolean().optional(),
});
export type DownstreamCall = z.infer<typeof DownstreamCall>;

// Upstream API configuration
export const UpstreamApi = z.object({
  method: HttpMethod,
  path: z.string(),
});
export type UpstreamApi = z.infer<typeof UpstreamApi>;

// Complete mapping configuration
export const MappingConfig = z.object({
  name: z.string(),
  upstream: UpstreamApi,
  downstream: z.array(DownstreamCall),
});
export type MappingConfig = z.infer<typeof MappingConfig>;

// Full ontology mapping
export const OntologyMapping = z.object({
  mappings: z.array(MappingConfig),
});
export type OntologyMapping = z.infer<typeof OntologyMapping>; 