import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

type ThemeType = 'light' | 'dark' | 'oled';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeType>('light');
  
  // Load theme from system preference or saved preference
  useEffect(() => {
    const systemTheme = Appearance.getColorScheme() as ThemeType;
    // You could also load from async storage here if you want to persist user selection
    setTheme(systemTheme || 'dark'); // Set dark theme as default
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'dark') return 'oled';
      if (prev === 'oled') return 'light';
      return 'dark'; // Cycle back to dark from light
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};