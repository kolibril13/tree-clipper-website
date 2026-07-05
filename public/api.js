// Centralized API client with consistent error handling and auth
import { supabase } from '/auth.js';
import { error as logError } from '/logger.js';

class APIError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.body = body;
  }
}

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

async function request(endpoint, options = {}) {
  const { method = 'GET', body, params, headers: customHeaders = {} } = options;

  // Build URL with query params
  let url = endpoint;
  if (params && method === 'GET') {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) query.append(k, v);
    });
    const queryStr = query.toString();
    url = queryStr ? `${endpoint}?${queryStr}` : endpoint;
  }

  // Get auth headers if needed
  const authHeaders = await getAuthHeader();
  const headers = {
    ...authHeaders,
    ...customHeaders
  };

  // Build fetch options
  const fetchOptions = {
    method,
    headers
  };

  if (body) {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(url, fetchOptions);

    // Parse response
    let data;
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    // Handle errors
    if (!res.ok) {
      const message = typeof data === 'object' && data.message
        ? data.message
        : typeof data === 'string' ? data : `HTTP ${res.status}`;
      const apiError = new APIError(message, res.status, data);
      logError(`API Error: ${method} ${url} (${res.status})`, {
        endpoint: url,
        method,
        status: res.status,
        message
      });
      throw apiError;
    }

    return data;
  } catch (error) {
    if (error instanceof APIError) throw error;

    // Network error or parse error
    const message = error.message || 'Request failed';
    logError(`API Request Failed: ${method} ${url}`, {
      endpoint: url,
      method,
      message,
      type: error.name
    });
    throw new APIError(message, 0, null);
  }
}

// User endpoints
export const users = {
  getMe: () => request('/api/users/me'),
  check: (username) => request('/api/users/check', { params: { username } }),
  claim: (username) => request('/api/users/claim', { method: 'POST', body: { username } }),
  delete: () => request('/api/users/me', { method: 'DELETE' }),
  getProfile: (username) => request(`/api/users/${username}`)
};

// Entries endpoints
export const entries = {
  list: (options = {}) => request('/api/entries', { params: options }),
  listMine: () => request('/api/entries', { params: { mine: 'true' } }),
  listByAuthor: (author) => request('/api/entries', { params: { author } }),
  get: (username, slug) => request(`/api/asset/${username}/${slug}`),
  create: (data) => request('/api/entries', { method: 'POST', body: data }),
  update: (username, slug, data) => request('/api/entries', {
    method: 'PUT',
    params: { author: username, slug },
    body: data
  }),
  delete: (username, slug) => request('/api/entries', {
    method: 'DELETE',
    params: { author: username, slug }
  })
};

// Slug endpoints
export const slugs = {
  check: (title) => request('/api/slug/check', { params: { title } })
};

export { APIError };
