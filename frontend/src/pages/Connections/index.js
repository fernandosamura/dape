import React, { useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
	Button,
	TableBody,
	TableRow,
	TableCell,
	IconButton,
	Table,
	TableHead,
	Paper,
	Tooltip,
	Typography,
	CircularProgress,
	Chip,
} from "@material-ui/core";
import {
	Edit,
	CheckCircle,
	SignalCellularConnectedNoInternet2Bar,
	SignalCellularConnectedNoInternet0Bar,
	SignalCellular4Bar,
	CropFree,
	DeleteOutline,
} from "@material-ui/icons";
import { Facebook, Instagram, WhatsApp } from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";

import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { Can } from "../../components/Can";
import EmbeddedSignupButton from "../../components/EmbeddedSignupButton";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(1),
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},
	customTableCell: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	tooltip: {
		backgroundColor: "#f5f5f9",
		color: "rgba(0, 0, 0, 0.87)",
		fontSize: theme.typography.pxToRem(14),
		border: "1px solid #dadde9",
		maxWidth: 450,
	},
	tooltipPopper: {
		textAlign: "center",
	},
	buttonProgress: {
		color: green[500],
	},
	channelChip: {
		height: 24,
		fontSize: 11,
		fontWeight: 700,
	},
}));

const CustomToolTip = ({ title, content, children }) => {
	const classes = useStyles();

	return (
		<Tooltip
			arrow
			classes={{
				tooltip: classes.tooltip,
				popper: classes.tooltipPopper,
			}}
			title={
				<React.Fragment>
					<Typography gutterBottom color="inherit">
						{title}
					</Typography>
					{content && <Typography>{content}</Typography>}
				</React.Fragment>
			}
		>
			{children}
		</Tooltip>
	);
};

const ChannelBadge = ({ channel, providerType }) => {
	const classes = useStyles();
	if (channel === "facebook") {
		return (
			<Chip
				icon={<Facebook style={{ color: "#1877F2", fontSize: 16 }} />}
				label="Facebook"
				size="small"
				className={classes.channelChip}
				style={{ background: "#e3f0ff", color: "#1877F2", borderColor: "#1877F2" }}
				variant="outlined"
			/>
		);
	}
	if (channel === "instagram") {
		return (
			<Chip
				icon={<Instagram style={{ color: "#E1306C", fontSize: 16 }} />}
				label="Instagram"
				size="small"
				className={classes.channelChip}
				style={{ background: "#fce4ec", color: "#E1306C", borderColor: "#E1306C" }}
				variant="outlined"
			/>
		);
	}
	if (providerType === "meta_cloud") {
		return (
			<>
				<Chip
					icon={<WhatsApp style={{ color: "#25D366", fontSize: 16 }} />}
					label="WhatsApp"
					size="small"
					className={classes.channelChip}
					style={{ background: "#e8f5e9", color: "#25D366", borderColor: "#25D366" }}
					variant="outlined"
				/>
				<Chip
					label="Meta Cloud"
					size="small"
					className={classes.channelChip}
					style={{ background: "#DBEAFE", color: "#1E40AF", borderColor: "#1E40AF", marginLeft: 4 }}
					variant="outlined"
				/>
			</>
		);
	}
	return (
		<Chip
			icon={<WhatsApp style={{ color: "#25D366", fontSize: 16 }} />}
			label="WhatsApp"
			size="small"
			className={classes.channelChip}
			style={{ background: "#e8f5e9", color: "#25D366", borderColor: "#25D366" }}
			variant="outlined"
		/>
	);
};

const Connections = () => {
	const classes = useStyles();

	const { user } = useContext(AuthContext);
	const { whatsApps, loading } = useContext(WhatsAppsContext);
	const { getPlanCompany } = usePlans();
	const [planChannels, setPlanChannels] = React.useState({ useFacebook: true, useInstagram: true });

	React.useEffect(() => {
		if (user?.companyId) {
			getPlanCompany(undefined, user.companyId)
				.then(data => {
					if (data?.plan) {
						setPlanChannels({
							useFacebook: data.plan.useFacebook !== false,
							useInstagram: data.plan.useInstagram !== false,
						});
					}
				})
				.catch(() => {});
		}
	}, [user]);
	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [qrModalOpen, setQrModalOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const confirmationModalInitialState = {
		action: "",
		title: "",
		message: "",
		whatsAppId: "",
		open: false,
	};
	const [confirmModalInfo, setConfirmModalInfo] = useState(
		confirmationModalInitialState
	);

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleRequestNewQrCode = async whatsAppId => {
		try {
			await api.put(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenWhatsAppModal = () => {
		setSelectedWhatsApp(null);
		setWhatsAppModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
	}, [setSelectedWhatsApp, setWhatsAppModalOpen]);

	const handleOpenQrModal = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setQrModalOpen(true);
	};

	const handleCloseQrModal = useCallback(() => {
		setSelectedWhatsApp(null);
		setQrModalOpen(false);
	}, [setQrModalOpen, setSelectedWhatsApp]);

	const handleEditWhatsApp = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setWhatsAppModalOpen(true);
	};

	const handleOpenConfirmationModal = (action, whatsAppId) => {
		if (action === "disconnect") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.disconnectTitle"),
				message: i18n.t("connections.confirmationModal.disconnectMessage"),
				whatsAppId: whatsAppId,
			});
		}
		if (action === "delete") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.deleteTitle"),
				message: i18n.t("connections.confirmationModal.deleteMessage"),
				whatsAppId: whatsAppId,
			});
		}
		setConfirmModalOpen(true);
	};

	const handleSubmitConfirmationModal = async () => {
		if (confirmModalInfo.action === "disconnect") {
			try {
				await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
			} catch (err) {
				toastError(err);
			}
		}
		if (confirmModalInfo.action === "delete") {
			try {
				await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
				toast.success(i18n.t("connections.toasts.deleted"));
			} catch (err) {
				toastError(err);
			}
		}
		setConfirmModalInfo(confirmationModalInitialState);
	};

	const renderActionButtons = whatsApp => {
		const isMeta = whatsApp.channel === "facebook" || whatsApp.channel === "instagram";
		const isMetaCloud = whatsApp.providerType === "meta_cloud";

		if (isMetaCloud) {
			return (
				<Chip
					label="Meta Cloud Ativo"
					size="small"
					style={{ background: "#DBEAFE", color: "#1E40AF", fontWeight: 700 }}
				/>
			);
		}

		if (isMeta) {
			// Meta channels show "Conectado" when facebookToken is set
			if (whatsApp.facebookToken) {
				return (
					<Chip
						label="Conectado"
						size="small"
						style={{ background: "#e8f5e9", color: "#388e3c", fontWeight: 700 }}
					/>
				);
			}
			return (
				<Chip
					label="Token não configurado"
					size="small"
					color="secondary"
					variant="outlined"
				/>
			);
		}

		return (
			<>
				{whatsApp.status === "qrcode" && (
					<Button
						size="small"
						variant="contained"
						color="primary"
						onClick={() => handleOpenQrModal(whatsApp)}
					>
						{i18n.t("connections.buttons.qrcode")}
					</Button>
				)}
				{whatsApp.status === "DISCONNECTED" && (
					<>
						<Button
							size="small"
							variant="outlined"
							color="primary"
							onClick={() => handleStartWhatsAppSession(whatsApp.id)}
						>
							{i18n.t("connections.buttons.tryAgain")}
						</Button>{" "}
						<Button
							size="small"
							variant="outlined"
							color="secondary"
							onClick={() => handleRequestNewQrCode(whatsApp.id)}
						>
							{i18n.t("connections.buttons.newQr")}
						</Button>
					</>
				)}
				{(whatsApp.status === "CONNECTED" ||
					whatsApp.status === "PAIRING" ||
					whatsApp.status === "TIMEOUT") && (
					<Button
						size="small"
						variant="outlined"
						color="secondary"
						onClick={() => handleOpenConfirmationModal("disconnect", whatsApp.id)}
					>
						{i18n.t("connections.buttons.disconnect")}
					</Button>
				)}
				{whatsApp.status === "OPENING" && (
					<Button size="small" variant="outlined" disabled color="default">
						{i18n.t("connections.buttons.connecting")}
					</Button>
				)}
			</>
		);
	};

	const renderStatusToolTips = whatsApp => {
		const isMeta = whatsApp.channel === "facebook" || whatsApp.channel === "instagram";

		if (isMeta) {
			if (whatsApp.facebookToken) {
				return (
					<div className={classes.customTableCell}>
						<CustomToolTip title="Webhook ativo — aguardando mensagens">
							<SignalCellular4Bar style={{ color: green[500] }} />
						</CustomToolTip>
					</div>
				);
			}
			return (
				<div className={classes.customTableCell}>
					<CustomToolTip title="Configure o Token de Acesso nas configurações da conexão">
						<SignalCellularConnectedNoInternet0Bar color="secondary" />
					</CustomToolTip>
				</div>
			);
		}

		return (
			<div className={classes.customTableCell}>
				{whatsApp.status === "DISCONNECTED" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.disconnected.title")}
						content={i18n.t("connections.toolTips.disconnected.content")}
					>
						<SignalCellularConnectedNoInternet0Bar color="secondary" />
					</CustomToolTip>
				)}
				{whatsApp.status === "OPENING" && (
					<CircularProgress size={24} className={classes.buttonProgress} />
				)}
				{whatsApp.status === "qrcode" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.qrcode.title")}
						content={i18n.t("connections.toolTips.qrcode.content")}
					>
						<CropFree />
					</CustomToolTip>
				)}
				{whatsApp.status === "CONNECTED" && (
					<CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
						<SignalCellular4Bar style={{ color: green[500] }} />
					</CustomToolTip>
				)}
				{(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.timeout.title")}
						content={i18n.t("connections.toolTips.timeout.content")}
					>
						<SignalCellularConnectedNoInternet2Bar color="secondary" />
					</CustomToolTip>
				)}
			</div>
		);
	};

	return (
		<MainContainer>
			<ConfirmationModal
				title={confirmModalInfo.title}
				open={confirmModalOpen}
				onClose={setConfirmModalOpen}
				onConfirm={handleSubmitConfirmationModal}
			>
				{confirmModalInfo.message}
			</ConfirmationModal>
			<QrcodeModal
				open={qrModalOpen}
				onClose={handleCloseQrModal}
				whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
			/>
			<WhatsAppModal
				open={whatsAppModalOpen}
				onClose={handleCloseWhatsAppModal}
				whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
				planChannels={planChannels}
			/>
			<MainHeader>
				<Title>{i18n.t("connections.title")}</Title>
				<MainHeaderButtonsWrapper>
					<Can
						role={user.profile}
						perform="connections-page:addConnection"
						yes={() => (
							<Button
								variant="contained"
								color="primary"
								onClick={handleOpenWhatsAppModal}
							>
								{i18n.t("connections.buttons.add")}
							</Button>
						)}
					/>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			<Paper className={classes.mainPaper} variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell align="center">Canal</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.name")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.status")}
							</TableCell>
							<Can
								role={user.profile}
								perform="connections-page:actionButtons"
								yes={() => (
									<TableCell align="center">
										{i18n.t("connections.table.session")}
									</TableCell>
								)}
							/>
							<TableCell align="center">
								{i18n.t("connections.table.lastUpdate")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.default")}
							</TableCell>
							<Can
								role={user.profile}
								perform="connections-page:editOrDeleteConnection"
								yes={() => (
									<TableCell align="center">
										{i18n.t("connections.table.actions")}
									</TableCell>
								)}
							/>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							<TableRowSkeleton />
						) : (
							<>
								{whatsApps?.length > 0 &&
									whatsApps
										.filter(w => {
											if (w.channel === "facebook" && !planChannels.useFacebook) return false;
											if (w.channel === "instagram" && !planChannels.useInstagram) return false;
											return true;
										})
										.map(whatsApp => (
										<TableRow key={whatsApp.id}>
											<TableCell align="center">
												<ChannelBadge channel={whatsApp.channel || "whatsapp"} providerType={whatsApp.providerType} />
											</TableCell>
											<TableCell align="center">{whatsApp.name}</TableCell>
											<TableCell align="center">
												{renderStatusToolTips(whatsApp)}
											</TableCell>
											<Can
												role={user.profile}
												perform="connections-page:actionButtons"
												yes={() => (
													<TableCell align="center">
														{renderActionButtons(whatsApp)}
													</TableCell>
												)}
											/>
											<TableCell align="center">
												{format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}
											</TableCell>
											<TableCell align="center">
												{whatsApp.isDefault && (
													<div className={classes.customTableCell}>
														<CheckCircle style={{ color: green[500] }} />
													</div>
												)}
											</TableCell>
											<Can
												role={user.profile}
												perform="connections-page:editOrDeleteConnection"
												yes={() => (
													<TableCell align="center">
														{(!whatsApp.providerType || whatsApp.providerType === "session") && whatsApp.channel === "whatsapp" && (
															<EmbeddedSignupButton
																whatsappId={whatsApp.id}
																companyId={whatsApp.companyId}
																onSuccess={() => {}}
															/>
														)}
														<IconButton
															size="small"
															onClick={() => handleEditWhatsApp(whatsApp)}
														>
															<Edit />
														</IconButton>
														<IconButton
															size="small"
															onClick={e => {
																handleOpenConfirmationModal("delete", whatsApp.id);
															}}
														>
															<DeleteOutline />
														</IconButton>
													</TableCell>
												)}
											/>
										</TableRow>
									))}
							</>
						)}
					</TableBody>
				</Table>
			</Paper>
		</MainContainer>
	);
};

export default Connections;
