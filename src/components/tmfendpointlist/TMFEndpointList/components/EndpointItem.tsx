import React, { useState } from 'react';
import { Box, Typography, Button, TextField, Paper } from '@mui/material';
import { Endpoint } from '../types';
import CodeDisplay from './CodeDisplay';

interface EndpointItemProps {
  endpoint: Endpoint;
  onSubmit?: (data: any) => void;
  onSubmitError?: (error: any) => void;
}

const EndpointItem: React.FC<EndpointItemProps> = ({ 
  endpoint, 
  onSubmit, 
  onSubmitError 
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResponse(null);
    setError(null);
    
    try {
      // Mock API call for now
      const mockResponse = {
        status: 200,
        data: {
          id: '123',
          name: 'Example Response',
          timestamp: new Date().toISOString()
        }
      };
      
      setResponse(mockResponse);
      
      if (onSubmit) {
        onSubmit(mockResponse);
      }
    } catch (err) {
      setError(err);
      
      if (onSubmitError) {
        onSubmitError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="body1" paragraph>
        {endpoint.description || 'No description available.'}
      </Typography>

      <Typography variant="subtitle1" gutterBottom>
        Endpoint URL: {endpoint.url}
      </Typography>

      {endpoint.fields && endpoint.fields.length > 0 && (
        <Box my={3}>
          <Typography variant="h6" gutterBottom>
            Request Parameters
          </Typography>
          
          {endpoint.fields.map(field => (
            <TextField
              key={field.name}
              label={field.label || field.name}
              margin="normal"
              fullWidth
              required={field.required}
              onChange={(e) => handleChange(field.name, e.target.value)}
              helperText={field.description}
            />
          ))}
          
          <Box mt={2}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Request'}
            </Button>
          </Box>
        </Box>
      )}

      {response && (
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>
            Response
          </Typography>
          <Paper elevation={2} sx={{ p: 2 }}>
            <CodeDisplay code={JSON.stringify(response, null, 2)} />
          </Paper>
        </Box>
      )}

      {error && (
        <Box mt={3}>
          <Typography variant="h6" color="error" gutterBottom>
            Error
          </Typography>
          <Paper elevation={2} sx={{ p: 2, bgcolor: '#ffebee' }}>
            <CodeDisplay code={JSON.stringify(error, null, 2)} />
          </Paper>
        </Box>
      )}

      {endpoint.responses && endpoint.responses.length > 0 && (
        <Box mt={3}>
          <Typography variant="h6" gutterBottom>
            Example Responses
          </Typography>
          
          {endpoint.responses.map((response, index) => (
            <Box key={index} mt={2}>
              <Typography variant="subtitle2">
                Status: {response.status} - {response.description}
              </Typography>
              {response.example && (
                <Paper elevation={1} sx={{ p: 1, mt: 1 }}>
                  <CodeDisplay code={JSON.stringify(response.example, null, 2)} />
                </Paper>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default EndpointItem; 