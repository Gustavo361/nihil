/** Local Angular development talks to its local Spring API; deployed builds use Render. */
export const API_BASE_URL =
  typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8080'
    : 'https://nihil-api.onrender.com';
