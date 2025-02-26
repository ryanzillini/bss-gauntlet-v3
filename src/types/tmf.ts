export interface TMFField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface TMFObject {
  name: string;
  description?: string;
  fields: TMFField[];
} 