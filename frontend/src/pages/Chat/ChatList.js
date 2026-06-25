import React, { useContext, useState } from "react";
import {
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  makeStyles,
} from "@material-ui/core";

import { useHistory, useParams } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";

import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";

import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    height: "calc(100% - 58px)",
    overflow: "hidden",
    borderRadius: 0,
    backgroundColor: theme.palette.boxlist, //DARK MODE PLW DESIGN//
  },
  chatList: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  listItem: {
    cursor: "pointer",
    borderRadius: 8,
    margin: "4px 8px",
    padding: "8px 12px",
    transition: "background 0.2s, box-shadow 0.2s",
    "&:hover": {
      backgroundColor: "rgba(0, 45, 110, 0.06)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    },
  },
}));

export default function ChatList({
  chats,
  handleSelectChat,
  handleDeleteChat,
  handleEditChat,
  pageInfo,
  loading,
}) {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();

  const [confirmationModal, setConfirmModalOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState({});

  const { id } = useParams();

  const goToMessages = async (chat) => {
    if (unreadMessages(chat) > 0) {
      try {
        await api.post(`/chats/${chat.id}/read`, { userId: user.id });
      } catch (err) {}
    }

    if (id !== chat.uuid) {
      history.push(`/chats/${chat.uuid}`);
      handleSelectChat(chat);
    }
  };

  const handleDelete = () => {
    handleDeleteChat(selectedChat);
  };

  const unreadMessages = (chat) => {
    const currentUser = chat.users.find((u) => u.userId === user.id);
    return currentUser.unreads;
  };

  const getPrimaryText = (chat) => {
    const mainText = chat.title;
    const unreads = unreadMessages(chat);
    return (
      <>
        {mainText}
        {unreads > 0 && (
          <Chip
            size="small"
            style={{ marginLeft: 5 }}
            label={unreads}
            color="secondary"
          />
        )}
      </>
    );
  };

  const getSecondaryText = (chat) => {
    return chat.lastMessage !== ""
      ? `${datetimeToClient(chat.updatedAt)}: ${chat.lastMessage}`
      : "";
  };

  const getItemStyle = (chat) => {
    return {
      borderLeft: chat.uuid === id ? "4px solid #1976d2" : "4px solid transparent",
      backgroundColor: chat.uuid === id ? "rgba(25, 118, 210, 0.08)" : undefined,
      borderRadius: 8,
      boxShadow: chat.uuid === id ? "0 2px 8px rgba(25,118,210,0.12)" : undefined,
    };
  };

  return (
    <>
      <ConfirmationModal
        title={i18n.t("chat.confirm.title")}
        open={confirmationModal}
        onClose={setConfirmModalOpen}
        onConfirm={handleDelete}
      >
        {i18n.t("chat.confirm.message")}
      </ConfirmationModal>
      <div className={classes.mainContainer}>
        <div className={classes.chatList}>
          <List>
            {Array.isArray(chats) &&
              chats.length > 0 &&
              chats.map((chat, key) => (
                <ListItem
                  onClick={() => goToMessages(chat)}
                  key={key}
                  className={classes.listItem}
                  style={getItemStyle(chat)}
                  button
                >
                  <ListItemText
                    primary={getPrimaryText(chat)}
                    secondary={getSecondaryText(chat)}
                  />
                  {chat.ownerId === user.id && (
                    <ListItemSecondaryAction>
                      <IconButton
                        onClick={() => {
                          goToMessages(chat).then(() => {
                            handleEditChat(chat);
                          });
                        }}
                        edge="end"
                        aria-label="delete"
                        size="small"
                        style={{ marginRight: 5 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          setSelectedChat(chat);
                          setConfirmModalOpen(true);
                        }}
                        edge="end"
                        aria-label="delete"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
          </List>
        </div>
      </div>
    </>
  );
}
