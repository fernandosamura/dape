import React, { useState, useEffect, useContext, useRef } from "react";
import { useParams, useHistory } from "react-router-dom";

import { toast } from "react-toastify";
import clsx from "clsx";

import { Paper, makeStyles } from "@material-ui/core";

import ContactDrawer from "../ContactDrawer";
import MessageInput from "../MessageInputCustom/";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtonsCustom";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { SocketContext } from "../../context/Socket/SocketContext";
import { i18n } from "../../translate/i18n";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const { user } = useContext(AuthContext);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});

  const socketManager = useContext(SocketContext);

  useEffect(() => {
    // Aguarda o router carregar o parâmetro antes de disparar a requisição
    if (!ticketId || ticketId === "undefined") return;

    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {
          const { data } = await api.get("/tickets/u/" + ticketId);
          const { queueId, userId: ticketUserId, isGroup } = data;
          const { queues, profile, id: currentUserId, allTicket } = user;

          // Regras de acesso ao ticket:
          // 1. Admin sempre tem acesso
          // 2. allTicket="enabled" tem acesso a todos
          // 3. Ticket atribuído ao próprio usuário: sempre tem acesso
          // 4. Ticket de grupo: sempre tem acesso
          // 5. Ticket com fila: apenas se a fila estiver nas filas do usuário
          // 6. Ticket sem fila (queueId=null) e não atribuído: apenas allTicket/admin
          const isTicketOwner = ticketUserId === currentUserId;
          const hasQueueAccess = queueId !== null && queues.find((q) => q.id === queueId) !== undefined;
          const hasAllTicketAccess = allTicket === "enabled";

          const canAccess =
            profile === "admin" ||
            hasAllTicketAccess ||
            isTicketOwner ||
            isGroup ||
            hasQueueAccess;

          if (!canAccess) {
            toast.error(i18n.t("tickets.toasts.unauthorized"));
            history.push("/tickets");
            return;
          }

          setContact(data.contact);
          setTicket(data);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, user, history]);

  // Ref para acesso ao ticket.id sem colocar `ticket` nas deps do socket effect.
  // Sem isso, qualquer update do ticket (ex: lastMessage) re-executaria o effect,
  // removendo o listener de appMessage por um instante e fazendo a mensagem
  // recém-enviada ser perdida (race condition).
  const ticketIdRef = useRef(null);
  useEffect(() => {
    ticketIdRef.current = ticket.id ?? null;
  }, [ticket.id]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on("ready", () => socket.emit("joinChatBox", `${ticketId}`));

    socket.on(`company-${companyId}-ticket`, (data) => {
      if (data.action === "update" && data.ticket.id === ticketIdRef.current) {
        setTicket(data.ticket);
      }

      if (data.action === "delete" && data.ticketId === ticketIdRef.current) {
        // toast.success("Ticket deleted sucessfully.");
        history.push("/tickets");
      }
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            return { ...prevState, ...data.contact };
          }
          return prevState;
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, history, socketManager]);

  const handleDrawerOpen = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
  };

  const renderTicketInfo = () => {
    if (ticket.user !== undefined) {
      return (
        <TicketInfo
          contact={contact}
          ticket={ticket}
          onClick={handleDrawerOpen}
        />
      );
    }
  };

  const renderMessagesList = () => {
    return (
      <>
        <MessagesList
          ticket={ticket}
          ticketId={ticket.id}
          isGroup={ticket.isGroup}
        ></MessagesList>
        <MessageInput ticketId={ticket.id} ticketStatus={ticket.status} />
      </>
    );
  };

  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        variant="outlined"
        elevation={0}
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
      >
        <TicketHeader loading={loading}>
          {renderTicketInfo()}
          <TicketActionButtons ticket={ticket} />
        </TicketHeader>
        <Paper>
          <TagsContainer ticket={ticket} />
        </Paper>
        <ReplyMessageProvider>{renderMessagesList()}</ReplyMessageProvider>
      </Paper>
      <ContactDrawer
        open={drawerOpen}
        handleDrawerClose={handleDrawerClose}
        contact={contact}
        loading={loading}
        ticket={ticket}
      />
    </div>
  );
};

export default Ticket;
