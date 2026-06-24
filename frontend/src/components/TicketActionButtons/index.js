import React, { useContext, useState, useEffect } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import { IconButton, Tooltip } from "@material-ui/core";
import { MoreVert, Replay, Group, ExitToApp } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import TicketOptionsMenu from "../TicketOptionsMenu";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
	actionButtons: {
		marginRight: 6,
		flex: "none",
		alignSelf: "center",
		marginLeft: "auto",
		"& > *": {
			marginRight: theme.spacing(1),
			marginLeft: theme.spacing(1),
		},
	},
}));

const TicketActionButtons = ({ ticket }) => {
	const classes = useStyles();
	const history = useHistory();
	const [anchorEl, setAnchorEl] = useState(null);
	const [loading, setLoading] = useState(false);
	const [groupLoading, setGroupLoading] = useState(false);
	const [isInGroup, setIsInGroup] = useState(false);
	const ticketOptionsMenuOpen = Boolean(anchorEl);
	const { user } = useContext(AuthContext);

	// Verifica se o usuário logado já está no grupo
	useEffect(() => {
		if (!ticket?.isGroup) return;
		api.get(`/tickets/${ticket.id}/users`)
			.then(({ data }) => {
				setIsInGroup(data.some(u => u.id === user?.id));
			})
			.catch(() => {});
	}, [ticket?.id, ticket?.isGroup, user?.id]);

	const handleJoinGroup = async () => {
		setGroupLoading(true);
		try {
			await api.post(`/tickets/${ticket.id}/join`);
			setIsInGroup(true);
			history.push(`/tickets/${ticket.id}`);
		} catch (err) {
			toastError(err);
		} finally {
			setGroupLoading(false);
		}
	};

	const handleLeaveGroup = async () => {
		setGroupLoading(true);
		try {
			await api.post(`/tickets/${ticket.id}/leave`);
			setIsInGroup(false);
		} catch (err) {
			toastError(err);
		} finally {
			setGroupLoading(false);
		}
	};

	const handleOpenTicketOptionsMenu = e => {
		setAnchorEl(e.currentTarget);
	};

	const handleCloseTicketOptionsMenu = e => {
		setAnchorEl(null);
	};

	const handleUpdateTicketStatus = async (e, status, userId) => {
		setLoading(true);
		try {
			await api.put(`/tickets/${ticket.id}`, {
				status: status,
				userId: userId || null,
			});

			setLoading(false);
			if (status === "open") {
				history.push(`/tickets/${ticket.id}`);
			} else {
				history.push("/tickets");
			}
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
	};

	return (
		<div className={classes.actionButtons}>
			{ticket.status === "closed" && (
				<ButtonWithSpinner
					loading={loading}
					startIcon={<Replay />}
					size="small"
					onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
				>
					{i18n.t("messagesList.header.buttons.reopen")}
				</ButtonWithSpinner>
			)}
			{ticket.status === "open" && (
				<>
					<ButtonWithSpinner
						loading={loading}
						startIcon={<Replay />}
						size="small"
						onClick={e => handleUpdateTicketStatus(e, "pending", null)}
					>
						{i18n.t("messagesList.header.buttons.return")}
					</ButtonWithSpinner>
					<ButtonWithSpinner
						loading={loading}
						size="small"
						variant="contained"
						color="primary"
						onClick={e => handleUpdateTicketStatus(e, "closed", user?.id)}
					>
						{i18n.t("messagesList.header.buttons.resolve")}
					</ButtonWithSpinner>
					<IconButton onClick={handleOpenTicketOptionsMenu}>
						<MoreVert />
					</IconButton>
					<TicketOptionsMenu
						ticket={ticket}
						anchorEl={anchorEl}
						menuOpen={ticketOptionsMenuOpen}
						handleClose={handleCloseTicketOptionsMenu}
					/>
				</>
			)}
			{ticket.status === "pending" && (
				ticket.isGroup ? (
					isInGroup ? (
						<Tooltip title="Sair do Grupo">
							<ButtonWithSpinner
								loading={groupLoading}
								size="small"
								variant="outlined"
								color="secondary"
								startIcon={<ExitToApp />}
								onClick={handleLeaveGroup}
							>
								Sair do Grupo
							</ButtonWithSpinner>
						</Tooltip>
					) : (
						<Tooltip title="Entrar no Grupo">
							<ButtonWithSpinner
								loading={groupLoading}
								size="small"
								variant="contained"
								color="primary"
								startIcon={<Group />}
								onClick={handleJoinGroup}
							>
								Entrar no Grupo
							</ButtonWithSpinner>
						</Tooltip>
					)
				) : (
					<ButtonWithSpinner
						loading={loading}
						size="small"
						variant="contained"
						color="primary"
						onClick={e => handleUpdateTicketStatus(e, "open", user?.id)}
					>
						{i18n.t("messagesList.header.buttons.accept")}
					</ButtonWithSpinner>
				)
			)}
		</div>
	);
};

export default TicketActionButtons;