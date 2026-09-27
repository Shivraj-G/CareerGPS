const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  console.warn(
    'VITE_API_BASE_URL is not configured. API integration will be added in a later phase.'
  );
}

export const env = Object.freeze({
  apiBaseUrl: apiBaseUrl ?? '',
});
