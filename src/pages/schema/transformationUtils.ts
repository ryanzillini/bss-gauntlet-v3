import { CondensedMapping } from './types';

export const insertTransformationTemplate = (
    mapping: CondensedMapping | undefined,
    templateType: string
): string | undefined => {
    if (!mapping || mapping.sources.length === 0) return undefined;

    // Create source references based on available sources
    const source1 = mapping.sources[0];
    const source1Ref = `sourceData.${source1.table}.${source1.column}`;

    // Get a second source if available for concatenation examples
    const source2 = mapping.sources.length > 1 ? mapping.sources[1] : null;
    const source2Ref = source2 ? `sourceData.${source2.table}.${source2.column}` : null;

    switch (templateType) {
        case 'uppercase':
            return `${source1Ref}.toUpperCase()`;
        case 'lowercase':
            return `${source1Ref}.toLowerCase()`;
        case 'concat':
            return source2
                ? `${source1Ref} + " " + ${source2Ref}`
                : `${source1Ref} + " additional text"`;
        case 'conditional':
            return `${source1Ref} ? "True value" : "False value"`;
        case 'substring':
            return `${source1Ref}.substring(0, 10)`;
        case 'default':
            return `${source1Ref} || "Default value"`;
        default:
            return undefined;
    }
};

export const toggleTransformSection = (
    expandedTransforms: Set<string>,
    mappingId: string
): Set<string> => {
    const updated = new Set(expandedTransforms);
    if (updated.has(mappingId)) {
        updated.delete(mappingId);
    } else {
        updated.add(mappingId);
    }
    return updated;
}; 