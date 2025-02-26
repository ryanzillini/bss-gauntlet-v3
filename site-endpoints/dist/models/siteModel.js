"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSiteInfoUpdate = exports.validateSiteInfo = exports.SiteInfoUpdateSchema = exports.SiteInfoSchema = void 0;
const zod_1 = require("zod");
/**
 * Site information schema using Zod for validation
 */
exports.SiteInfoSchema = zod_1.z.object({
    name: zod_1.z.string(),
    version: zod_1.z.string(),
    description: zod_1.z.string(),
    features: zod_1.z.array(zod_1.z.string()),
    lastUpdated: zod_1.z.string().optional()
});
/**
 * Site information update schema
 */
exports.SiteInfoUpdateSchema = exports.SiteInfoSchema.partial();
/**
 * Validate site information
 * @param data Data to validate
 * @returns Validated data or throws an error
 */
const validateSiteInfo = (data) => {
    return exports.SiteInfoSchema.parse(data);
};
exports.validateSiteInfo = validateSiteInfo;
/**
 * Validate site information update
 * @param data Data to validate
 * @returns Validated data or throws an error
 */
const validateSiteInfoUpdate = (data) => {
    return exports.SiteInfoUpdateSchema.parse(data);
};
exports.validateSiteInfoUpdate = validateSiteInfoUpdate;
