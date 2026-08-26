import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";

// Componente NOVO e INDEPENDENTE do EmbeddedSignupButton.js (fluxo Cloud
// API tradicional, ja aprovado pela Meta - nao tocado por este arquivo).
// Usa um config_id proprio (Coexistence), featureType especifico, e uma
// rota de backend separada (/meta-cloud/coexistence-signup). Escuta os
// dois nomes de evento possiveis (FINISH e FINISH_WHATSAPP_BUSINESS_APP_
// ONBOARDING) de forma defensiva, ja que a documentacao atual da Meta nao
// deixa 100% claro qual sera usado nesse fluxo - loga o payload bruto
// (sem token/code) no primeiro teste real pra confirmar o formato antes de
// travar suposicoes.
const CoexistenceSignupButton = ({ whatsappId, companyId, onSuccess }) => {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState(null);
	const sessionInfoRef = useRef({ wabaId: null, phoneNumberId: null });

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
				if (data.type !== "WA_EMBEDDED_SIGNUP") return;

				// Log seguro pro primeiro teste real - so estrutura do evento,
				// nunca token/code (que a Meta nem envia por essa via de
				// qualquer forma, mas por precaucao nunca logamos o objeto
				// "data" inteiro sem filtrar).
				// eslint-disable-next-line no-console
				console.log("[Coexistence] postMessage recebido:", {
					event: data.event,
					hasWabaId: !!data.data?.waba_id,
					hasPhoneNumberId: !!data.data?.phone_number_id,
				});

				if (
					data.event === "FINISH" ||
					data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
				) {
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
		const configId = process.env.REACT_APP_META_COEXISTENCE_CONFIG_ID;
		if (!configId) {
			toast.error("Configuração de Coexistence (config_id) não definida.");
			return;
		}
		sessionInfoRef.current = { wabaId: null, phoneNumberId: null };
		setLoading(true);
		const onLoginResponse = (response) => {
			if (response.authResponse) {
				(async () => {
					try {
						const { data } = await api.post("/meta-cloud/coexistence-signup", {
							code: response.authResponse.code || response.authResponse.accessToken,
							whatsappId,
							companyId,
							wabaId: sessionInfoRef.current.wabaId,
							phoneNumberId: sessionInfoRef.current.phoneNumberId,
						});
						setResult(data);
						toast.success(`WhatsApp Business conectado: ${data.phoneNumber}`);
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
					featureType: "whatsapp_business_app_onboarding",
					sessionInfoVersion: "3",
				},
			}
		);
	};

	if (!open) {
		return (
			<button
				onClick={() => setOpen(true)}
				title="Mantenha este número no WhatsApp Business e conecte-o também ao DAPLE."
				style={{
					padding: "8px 16px",
					borderRadius: 8,
					border: "none",
					background: "#128C7E",
					color: "#fff",
					fontWeight: "bold",
					fontSize: 13,
					cursor: "pointer",
					marginLeft: 8,
				}}
			>
				Conectar WhatsApp Business + DAPLE
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
					Conectar WhatsApp Business + DAPLE
				</h2>
				<p style={{ color: "#6B7280", fontSize: 14, marginBottom: 20 }}>
					Mantenha este número no WhatsApp Business e conecte-o também ao DAPLE.
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
							"Selecione seu número já ativo no WhatsApp Business App",
							"Autorize a conexão com o DAPLE",
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
										background: "#128C7E",
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

export default CoexistenceSignupButton;
