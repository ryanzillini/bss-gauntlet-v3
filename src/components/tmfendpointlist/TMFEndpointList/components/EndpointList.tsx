import React, { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Typography, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { TMFEndpointListProps } from '../types';
import EndpointItem from './EndpointItem';

const EndpointList: React.FC<TMFEndpointListProps> = ({ 
  title = 'API Endpoints', 
  endpoints, 
  onSubmit,
  onSubmitError 
}) => {
  const [expanded, setExpanded] = useState<string | false>(false);

  const handleChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : false);
  };

  return (
    <Box>
      {title && (
        <Typography variant="h5" component="h2" gutterBottom>
          {title}
        </Typography>
      )}
      {endpoints.map((endpoint) => (
        <Accordion 
          key={endpoint.id} 
          expanded={expanded === endpoint.id}
          onChange={handleChange(endpoint.id)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" width="100%">
              <Typography 
                component="span" 
                sx={{ 
                  backgroundColor: getMethodColor(endpoint.method),
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  marginRight: 2,
                  minWidth: '60px',
                  textAlign: 'center'
                }}
              >
                {endpoint.method}
              </Typography>
              <Typography>{endpoint.title}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <EndpointItem 
              endpoint={endpoint} 
              onSubmit={onSubmit} 
              onSubmitError={onSubmitError}
            />
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

// Utility function to get color based on HTTP method
const getMethodColor = (method: string): string => {
  switch (method) {
    case 'GET':
      return '#2196F3'; // Blue
    case 'POST':
      return '#4CAF50'; // Green
    case 'PUT':
      return '#FF9800'; // Orange
    case 'DELETE':
      return '#F44336'; // Red
    case 'PATCH':
      return '#9C27B0'; // Purple
    default:
      return '#757575'; // Grey
  }
};

export default EndpointList; 