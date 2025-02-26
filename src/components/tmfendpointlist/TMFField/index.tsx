import React from 'react';

/**
 * Base interface for TMFField properties
 */
export interface TMFField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox' | 'date' | 'textarea';
  defaultValue?: any;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  
  // Validation rules
  pattern?: {
    value: RegExp;
    message: string;
  };
  minLength?: {
    value: number;
    message: string;
  };
  maxLength?: {
    value: number;
    message: string;
  };
  min?: number;
  max?: number;
  
  // For select fields
  options?: Array<{
    label: string;
    value: string | number | boolean;
  }>;
  
  // Custom render function
  renderComponent?: (field: TMFField) => React.ReactNode;
}

export default TMFField; 