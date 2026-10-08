const fallback = 'http://localhost:8000/api/v1';

export const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? fallback;
