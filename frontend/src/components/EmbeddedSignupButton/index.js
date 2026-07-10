import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

const EmbeddedSignupButton = ({ whatsappId, companyId, onSuccess }) => {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState(null);
	const sessionInfoRef = useRef({ wabaId: null, phoneNumberId: null });

	// A Meta envia o waba_id/phone_number_id exatos selecionados pelo usuario
	// via postMessage durante o fluxo do Embedded Signup - mais confiavel do
	// que o backend "adivinhar" pegando a primeira conta/numero via API.
	useEffect(() => {
		const handleMessage = (event) => {
			if (
				event.origin !== "https://www.facebook.com" &&
				event.origin !== "https://web.facebook.com"
			) {
				return;
			}
			try {
				const data = JSON.parse(event.data);
				if (data.type === "WA_EMBEDDED_SIGNUP" && data.event === "FINISH") {
					sessionInfoRef.current = {
						wabaId: data.data?.waba_id || null,
						phoneNumberId: data.data?.phone_number_id || null,
					};
				}
			} catch (e) {
				// mensagens que nao sao JSON do embedded signup - ignorar
			}
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, []);

	const handleMetaLogin = () => {
		if (!window.FB) {
			toast.error("SDK do Facebook não carregado. Verifique as configurações.");
			return;
		}
		const configId = process.env.REACT_APP_META_CONFIG_ID;
		if (!configId) {
			toast.error("Configuração de Embedded Signup (config_id) não definida.");
			return;
		}
		sessionInfoRef.current = { wabaId: null, phoneNumberId: null };
		setLoading(true);
		// O FB.login rejeita callback async diretamente ("Expression is of type
		// asyncfunction, not function") - por isso o callback e uma funcao comum
		// que so dispara a logica assincrona internamente.
		const onLoginResponse = (response) => {
			if (response.authResponse) {
				(async () => {
					try {
						const { data } = await api.post("/meta-cloud/embedded-signup", {
							code: response.authResponse.code || response.authResponse.accessToken,
							whatsappId,
							companyId,
							wabaId: sessionInfoRef.current.wabaId,
							phoneNumberId: sessionInfoRef.current.phoneNumberId,
						});
						setResult(data);
						toast.success(`WhatsApp Oficial conectado: ${data.phoneNumber}`);
						if (onSuccess) onSuccess(data);
					} catch (err) {
						toastError(err);
					}
					setLoading(false);
				})();
			} else {
				toast.warn("Login cancelado ou sem permissão.");
				setLoading(false);
			}
		};
		window.FB.login(
			onLoginResponse,
			{
				config_id: configId,
				response_type: "code",
				override_default_response_type: true,
				extras: {
					setup: {},
					featureType: "",
					sessionInfoVersion: "3",
				},
			}
		);
	};

	if (!open) {
		return (
			<button
				onClick={() => setOpen(true)}
				style={{
					padding: "8px 16px",
					borderRadius: 8,
					border: "none",
					background: "#25D366",
					color: "#fff",
					fontWeight: "bold",
					fontSize: 13,
					cursor: "pointer",
				}}
			>
				Conectar WhatsApp Oficial
			</button>
		);
	}

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				background: "rgba(0,0,0,0.5)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 9999,
			}}
		>
			<div
				style={{
					background: "#fff",
					borderRadius: 16,
					padding: 32,
					maxWidth: 480,
					width: "90%",
					boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
				}}
			>
				<h2 style={{ margin: "0 0 12px", fontSize: 20, color: "#111827" }}>
					Conectar WhatsApp Oficial
				</h2>
				<p style={{ color: "#6B7280", fontSize: 14, marginBottom: 20 }}>
					Use a Meta Cloud API para enviar mensagens com a API oficial do WhatsApp
					Business. Você precisará de uma conta Meta Business verificada.
				</p>

				{result ? (
					<div
						style={{
							background: "#D1FAE5",
							borderRadius: 8,
							padding: 16,
							marginBottom: 16,
						}}
					>
						<div style={{ fontWeight: "bold", color: "#065F46" }}>
							Conectado com sucesso!
						</div>
						<div style={{ fontSize: 13, color: "#065F46", marginTop: 4 }}>
							{result.businessName} — {result.phoneNumber}
						</div>
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						{[
							"Faça login com sua conta Meta Business",
							"Selecione a conta WhatsApp Business",
							"Autorize o acesso",
						].map((step, i) => (
							<div
								key={i}
								style={{ display: "flex", gap: 12, alignItems: "center" }}
							>
								<div
									style={{
										width: 28,
										height: 28,
										borderRadius: "50%",
										background: "#3B82F6",
										color: "#fff",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontWeight: "bold",
										fontSize: 13,
										flexShrink: 0,
									}}
								>
									{i + 1}
								</div>
								<span style={{ fontSize: 14, color: "#374151" }}>{step}</span>
							</div>
						))}
					</div>
				)}

				<div style={{ display: "flex", gap: 10, marginTop: 24 }}>
					{!result && (
						<button
							onClick={handleMetaLogin}
							disabled={loading}
							style={{
								flex: 1,
								padding: "10px 0",
								borderRadius: 8,
								border: "none",
								background: loading ? "#9CA3AF" : "#1877F2",
								color: "#fff",
								fontWeight: "bold",
								fontSize: 14,
								cursor: loading ? "not-allowed" : "pointer",
							}}
						>
							{loading ? "Conectando..." : "Continuar com Meta"}
						</button>
					)}
					<button
						onClick={() => {
							setOpen(false);
							setResult(null);
						}}
						style={{
							flex: 1,
							padding: "10px 0",
							borderRadius: 8,
							border: "1px solid #D1D5DB",
							background: "#fff",
							color: "#374151",
							fontWeight: "bold",
							fontSize: 14,
							cursor: "pointer",
						}}
					>
						{result ? "Fechar" : "Cancelar"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default EmbeddedSignupButton;
