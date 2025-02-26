export interface EndpointInfo {
  path: string;
  method: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  responses?: Array<{
    code: string;
    description: string;
    schema?: any;
  }>;
  matchReason?: string;
  confidenceScore?: number;
} 