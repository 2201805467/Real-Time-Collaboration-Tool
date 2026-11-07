export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest(path, { token, body, headers, ...options } = {}) {
  const requestHeaders = { ...headers };
  let requestBody = body;

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: requestHeaders,
      body: requestBody
    });
  } catch (error) {
    throw new ApiError('تعذر الاتصال بالسيرفر. تأكد أنه يعمل على المنفذ 4000.', 0, { cause: error });
  }

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    await response.text();
    throw new ApiError(
      `استلم التطبيق رداً غير صالح من السيرفر (HTTP ${response.status}).`,
      response.status
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.message || 'تعذر إكمال الطلب.', response.status, data);
  }

  return data;
}
