import axios from "axios";

const api = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL,
	withCredentials: true,
});

export const openApi = axios.create({
	baseURL: process.env.REACT_APP_BACKEND_URL
});

// ── CSRF token management ────────────────────────────────────────────────────
// O backend usa Double Submit Cookie (csrf-csrf).
// O frontend busca o token via GET /csrf-token e o envia em X-CSRF-Token
// em toda requisição de mutação (POST / PUT / DELETE / PATCH).

let csrfToken = null;

async function fetchCsrfToken() {
	try {
		const resp = await axios.get(
			`${process.env.REACT_APP_BACKEND_URL}/csrf-token`,
			{ withCredentials: true }
		);
		csrfToken = resp.data?.token || null;
	} catch (_) {
		csrfToken = null;
	}
}

// Busca o token CSRF antes da primeira mutação
const MUTATION_METHODS = new Set(["post", "put", "delete", "patch"]);

api.interceptors.request.use(async (config) => {
	if (!MUTATION_METHODS.has((config.method || "").toLowerCase())) {
		return config;
	}

	// Busca o token se ainda não tiver um
	if (!csrfToken) {
		await fetchCsrfToken();
	}

	if (csrfToken) {
		config.headers = config.headers || {};
		config.headers["x-csrf-token"] = csrfToken;
	}

	return config;
});

// Se o backend retornar 403 com CSRF_INVALID, busca token novo e tenta uma vez
api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;

		if (
			error.response?.status === 403 &&
			error.response?.data?.error === "CSRF_INVALID" &&
			!originalRequest._csrfRetried
		) {
			originalRequest._csrfRetried = true;
			csrfToken = null;
			await fetchCsrfToken();

			if (csrfToken) {
				originalRequest.headers["x-csrf-token"] = csrfToken;
				return api(originalRequest);
			}
		}

		return Promise.reject(error);
	}
);
// ────────────────────────────────────────────────────────────────────────────

export default api;
