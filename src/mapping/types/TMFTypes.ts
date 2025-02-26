export interface EndpointContext {
  alternativeTerms: string[];
  useCases: string[];
  businessProcesses: string[];
  relatedConcepts: string[];
  semanticProfile: {
    domain: string;
    purpose: string;
    dataModel: string;
  };
}

export interface MappingContext {
  endpointContext: EndpointContext;
  confidence: number;
  reasoning: string;
}

export interface ContextAnalysisResult {
  success: boolean;
  context?: EndpointContext;
  error?: string;
}

export interface DocumentationMatch {
  path: string;
  method: string;
  confidence: number;
  matchedTerms: string[];
  reasoning: string;
} 