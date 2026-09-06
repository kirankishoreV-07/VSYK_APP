import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import ta from './locales/ta.json';

export type AppLanguage = 'en' | 'ta';

const LANGUAGE_STORAGE_KEY = 'vsyk_customer_language';

const resources = {
  en: { translation: en },
  ta: { translation: ta },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    supportedLngs: ['en', 'ta'],
    nonExplicitSupportedLngs: true,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export async function initializeAppLanguage(): Promise<AppLanguage> {
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  const deviceLanguage = Intl.DateTimeFormat().resolvedOptions().locale
    .toLowerCase()
    .split(/[-_]/)[0];
  const language: AppLanguage = savedLanguage === 'ta' || savedLanguage === 'en'
    ? savedLanguage
    : deviceLanguage === 'ta' ? 'ta' : 'en';

  await i18n.changeLanguage(language);
  return language;
}

export async function setAppLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export function localeForLanguage(language = i18n.resolvedLanguage): 'ta-IN' | 'en-IN' {
  return language === 'ta' ? 'ta-IN' : 'en-IN';
}

export default i18n;
