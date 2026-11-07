import { useCallback, useEffect, useState } from 'react';

const storageKey = 'tadafuq-theme';

function getInitialTheme() {
  const savedTheme = window.localStorage.getItem(storageKey);
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = theme;
}

export default function useTheme() {
  const [theme, setTheme] = useState(() => {
    const initialTheme = getInitialTheme();
    applyTheme(initialTheme);
    return initialTheme;
  });

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== storageKey || !['dark', 'light'].includes(event.newValue)) return;
      applyTheme(event.newValue);
      setTheme(event.newValue);
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(storageKey, nextTheme);
      applyTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  return {
    theme,
    isDarkMode: theme === 'dark',
    toggleTheme
  };
}
