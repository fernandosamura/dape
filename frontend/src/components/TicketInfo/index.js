import React, { useState, useEffect } from "react";

import { Avatar, CardHeader } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

const TicketInfo = ({ contact, ticket, onClick }) => {
	const { user } = ticket
	const [userName, setUserName] = useState('')
	const [contactName, setContactName] = useState('')

	// ticket.chatbot só reflete o fluxo de menu (queue.options); um ticket
	// atendido por Prompt de IA (sem menu) tem chatbot=false mas useIntegration+promptId
	const isBotAttending = ticket.chatbot || (ticket.useIntegration && !!ticket.promptId);

	useEffect(() => {
		if (contact) {
			setContactName(contact.name);
			if(document.body.offsetWidth < 600) {
				if (contact.name.length > 10) {
					const truncadName = contact.name.substring(0, 10) + '...';
					setContactName(truncadName);
				}
			}
		}

		if (user && contact) {
			setUserName(`${i18n.t("messagesList.header.assignedTo")} ${user.name}`);

			if(document.body.offsetWidth < 600) {
				setUserName(`${user.name}`);
			}
		} else if (!user && isBotAttending && ticket.queue?.prompt?.name && contact) {
			setUserName(`${i18n.t("messagesList.header.assignedTo")} ${ticket.queue.prompt.name} 🤖`);

			if(document.body.offsetWidth < 600) {
				setUserName(`${ticket.queue.prompt.name} 🤖`);
			}
		} else {
			setUserName('');
		}
	}, [ticket, contact, user, isBotAttending])

	const hasAssignee = user || (isBotAttending && ticket.queue?.prompt?.name);

	return (
		<CardHeader
			onClick={onClick}
			style={{ cursor: "pointer" }}
			titleTypographyProps={{ noWrap: true }}
			subheaderTypographyProps={{ noWrap: true }}
			avatar={<Avatar src={contact.profilePicUrl} alt="contact_image" imgProps={{ onError: (e) => { e.currentTarget.src = "/nopicture.png"; } }} />}
			title={`${contactName} #${ticket.id}`}
			subheader={hasAssignee && `${userName}`}
		/>
	);
};

export default TicketInfo;
