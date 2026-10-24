const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;

  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('attendance_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      'Unable to connect to the server. Please check your network connection or verify that the server is running.',
      0,
      'NETWORK_ERROR'
    );
  }

  // Handle CSV/XLSX/blob downloads
  const contentType = response.headers.get('content-type');
  if (
    contentType &&
    (contentType.includes('text/csv') ||
      contentType.includes('spreadsheetml') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('application/vnd.openxmlformats'))
  ) {
    if (!response.ok) {
      throw new ApiError(`Download failed with status ${response.status}`, response.status);
    }
    const blob = await response.blob();
    return blob as unknown as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data.message ||
      (response.status === 401
        ? 'Invalid email/phone or password. Please try again.'
        : `Request failed with status ${response.status}`);
    throw new ApiError(
      message,
      response.status,
      data.error || (response.status === 401 ? 'INVALID_CREDENTIALS' : undefined),
      data.details
    );
  }

  return data;
}

export async function uploadPhotoRequest(
  photoBlob: Blob,
  uploadAuth: { uploadUrl: string; fields: { photoObjectKey: string; token: string } }
): Promise<{ photoObjectKey: string; photoUrl: string }> {
  const formData = new FormData();
  formData.append('photo', photoBlob, 'selfie.jpg');
  formData.append('photoObjectKey', uploadAuth.fields.photoObjectKey);
  formData.append('token', uploadAuth.fields.token);

  const token = localStorage.getItem('attendance_token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/attendance/upload-photo`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.message || 'Photo upload failed', response.status, data.error);
  }

  return data;
}

export async function downloadFile(endpoint: string, filename: string): Promise<void> {
  const blob = await apiRequest<Blob>(endpoint);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
