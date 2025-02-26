import { TMFField } from '../TMField';

export interface TMFEndpointListProps {
  title?: string;
  endpoints: Endpoint[];
  onSubmit?: (data: any) => void;
  onSubmitError?: (error: any) => void;
}

export interface Endpoint {
  id: string;
  title: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  description?: string;
  fields?: TMFField[];
  responses?: EndpointResponse[];
  authentication?: boolean;
}

export interface EndpointResponse {
  status: number;
  description: string;
  example?: any;
} 