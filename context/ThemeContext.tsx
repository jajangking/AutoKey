import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { loadSetting, saveSetting, SETTINGS_KEYS } from '@/utils/settingsManager';

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
  const [theme, setTheme] = useState<ThemeType>('dark'); // Set dark as initial theme

  // Load theme from saved preference or system preference
  useEffect(() => {
    const loadSavedTheme = async () => {
      try {
        // Load saved theme from AsyncStorage
        const savedTheme = await loadSetting(SETTINGS_KEYS.THEME, null);
        
        if (savedTheme) {
          // If we have a saved theme, use it
          setTheme(savedTheme as ThemeType);
        } else {
          // Otherwise, use system theme preference
          const systemTheme = Appearance.getColorScheme() as ThemeType;
          setTheme(systemTheme || 'dark');
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        // Fallback to system theme or default
        const systemTheme = Appearance.getColorScheme() as ThemeType;
        setTheme(systemTheme || 'dark');
      }
    };

    loadSavedTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'oled' : 
                     theme === 'oled' ? 'light' : 'dark';
    
    setTheme(newTheme);
    
    // Save the new theme to AsyncStorage
    try {
      await saveSetting(SETTINGS_KEYS.THEME, newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};