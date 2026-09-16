const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const useFrontendProxy =
  typeof window !== 'undefined' && window.location.port === '8080';

export const API_URL = useFrontendProxy
  ? ''
  : configuredApiUrl
  ? configuredApiUrl.replace(/\/$/, '')
  : '';
