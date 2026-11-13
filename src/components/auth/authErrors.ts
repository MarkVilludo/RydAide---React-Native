import axios from 'axios';

/** First validation message per field from a Laravel 422 response ({ errors: { email: ['…'] } }). */
export function authFieldErrors(error: unknown): Record<string, string> {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) return {};
  const errors = (error.response.data as { errors?: Record<string, string[] | string> } | undefined)?.errors ?? {};
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(errors)) {
    const msg = Array.isArray(val) ? val[0] : val;
    if (msg) out[key] = msg;
  }
  return out;
}
