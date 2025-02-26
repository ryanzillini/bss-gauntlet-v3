import React from 'react';
import ApiInputForm from '../components/ApiInputForm';
import { validateApiInputs } from '../utils/validation';
import type { ApiFormData } from '../components/ApiInputForm';

const InputCollection: React.FC = () => {
  const handleFormSubmit = async (formData: ApiFormData) => {
    const validationResult = validateApiInputs(
      formData?.apiDocUrl,
      formData?.graphqlBaseUrl,
      formData?.authType,
      formData?.authCredentials
    );

    if (!validationResult.isValid) {
      alert(`Validation errors:\n${validationResult.errors.join('\n')}`);
      return;
    }

    // TODO: Store the inputs securely and proceed to documentation processing
    console.log('Form data validated successfully:', formData);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        API Documentation Mapping Tool
      </h1>
      <ApiInputForm onSubmit={handleFormSubmit} />
    </div>
  );
};

export default InputCollection; 