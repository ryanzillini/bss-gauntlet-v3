import { z } from 'zod';

/**
 * Site information schema using Zod for validation
 */
export const SiteInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  features: z.array(z.string()),
  lastUpdated: z.string().optional()
});

/**
 * Site information update schema
 */
export const SiteInfoUpdateSchema = SiteInfoSchema.partial();

/**
 * TypeScript type for site information
 */
export type SiteInfo = z.infer<typeof SiteInfoSchema>;

/**
 * TypeScript type for site information update
 */
export type SiteInfoUpdate = z.infer<typeof SiteInfoUpdateSchema>;

/**
 * Validate site information
 * @param data Data to validate
 * @returns Validated data or throws an error
 */
export const validateSiteInfo = (data: unknown): SiteInfo => {
  return SiteInfoSchema.parse(data);
};

/**
 * Validate site information update
 * @param data Data to validate
 * @returns Validated data or throws an error
 */
export const validateSiteInfoUpdate = (data: unknown): SiteInfoUpdate => {
  return SiteInfoUpdateSchema.parse(data);
}; 