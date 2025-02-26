import React, { ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, ThemeOptions } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

interface TMFThemeProviderProps {
  children: ReactNode;
  themeOptions?: ThemeOptions;
}

const defaultThemeOptions: ThemeOptions = {
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiAccordion: {
      styleOverrides: {
        root: {
          '&:before': {
            display: 'none',
          },
          boxShadow: 'none',
          borderRadius: 4,
          marginBottom: 16,
          border: '1px solid rgba(0, 0, 0, 0.12)',
        },
      },
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
        },
      },
    },
  },
};

export const TMFThemeProvider: React.FC<TMFThemeProviderProps> = ({ 
  children, 
  themeOptions = {} 
}) => {
  const theme = createTheme({
    ...defaultThemeOptions,
    ...themeOptions,
  });

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
};

export default TMFThemeProvider; 