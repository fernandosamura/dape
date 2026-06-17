import React, { useState, useContext, useEffect } from "react";
import clsx from "clsx";
import {
  makeStyles, Drawer, AppBar, Toolbar, List, Typography,
  Divider, MenuItem, IconButton, Menu, useTheme, useMediaQuery,
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import AccountCircle from "@material-ui/icons/AccountCircle";
import CachedIcon from "@material-ui/icons/Cached";
import Brightness4Icon from "@material-ui/icons/Brightness4";
import Brightness7Icon from "@material-ui/icons/Brightness7";
import { LanguageOutlined } from "@material-ui/icons";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import NotificationsVolume from "../components/NotificationsVolume";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import AnnouncementsPopover from "../components/AnnouncementsPopover";
import logo from "../assets/daple-logo.png";
import sammy from "../assets/sammy.png";
import { SocketContext } from "../context/Socket/SocketContext";
import ChatPopover from "../pages/Chat/ChatPopover";
import { useDate } from "../hooks/useDate";
import ColorModeContext from "../layout/themeContext";
import LanguageControl from "../components/LanguageControl";

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100vh",
    [theme.breakpoints.down("sm")]: { height: "calc(100vh - 56px)" },
    backgroundColor: theme.palette.fancyBackground,
    "& .MuiButton-outlinedPrimary": {
      color: "#FFF",
      backgroundColor: theme.mode === "light" ? theme.palette.primary.main : "#1c1c1c",
    },
    "& .MuiTab-textColorPrimary.Mui-selected": {
      color: theme.mode === "light" ? "Primary" : "#FFF",
    },
  },
  toolbar: {
    paddingRight: 24,
    color: theme.palette.dark.main,
    background: "linear-gradient(90deg, #1a1a1a 0%, #2D2D2D 100%)",
    borderBottom: "2px solid #F5C300",
  },
  toolbarIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    minHeight: "64px",
    background: "linear-gradient(160deg, #1a1a1a 0%, #2D2D2D 100%)",
    borderBottom: "2px solid #F5C300",
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: { display: "none" },
  },
  menuButton: { marginRight: 36 },
  menuButtonHidden: { display: "none" },
  title: { flexGrow: 1, fontSize: 14, color: "rgba(255,255,255,0.85)" },
  drawerPaper: {
    position: "relative",
    whiteSpace: "nowrap",
    width: drawerWidth,
    background: "linear-gradient(180deg, #1a1a1a 0%, #232323 100%)",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    [theme.breakpoints.down("sm")]: { width: "100%" },
    ...theme.scrollbarStylesSoft,
    display: "flex",
    flexDirection: "column",
  },
  drawerPaperClose: {
    overflowX: "hidden",
    transition: theme.transitions.create("width", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    width: theme.spacing(7),
    [theme.breakpoints.up("sm")]: { width: theme.spacing(9) },
    [theme.breakpoints.down("sm")]: { width: "100%" },
  },
  appBarSpacer: { minHeight: "48px" },
  content: { flex: 1, overflow: "auto" },
  containerWithScroll: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  logo: {
    width: "75%",
    height: "auto",
    maxWidth: 160,
    filter: "drop-shadow(0 2px 8px rgba(245,195,0,0.3))",
    [theme.breakpoints.down("sm")]: { width: "auto", height: "48px", maxWidth: 160 },
  },
  sammyContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "12px 8px 16px",
    borderTop: "1px solid rgba(245,195,0,0.15)",
    background: "rgba(245,195,0,0.04)",
    overflow: "hidden",
  },
  sammyImg: {
    width: "90px",
    filter: "drop-shadow(0 4px 12px rgba(245,195,0,0.25))",
    transition: "transform 0.3s ease",
    "&:hover": { transform: "scale(1.08) translateY(-4px)" },
  },
  sammyText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "10px",
    marginTop: "4px",
    letterSpacing: "0.5px",
    textAlign: "center",
  },
  sammyContainerClosed: {
    display: "flex",
    justifyContent: "center",
    padding: "8px",
    borderTop: "1px solid rgba(245,195,0,0.15)",
  },
  sammyImgSmall: {
    width: "36px",
    filter: "drop-shadow(0 2px 6px rgba(245,195,0,0.2))",
  },
  chevronBtn: { color: "rgba(255,255,255,0.6)" },
  dividerDark: { backgroundColor: "rgba(245,195,0,0.12)" },
  userGreeting: {
    "& b": { color: "#F5C300" },
  },
}));

const LoggedInLayout = ({ children }) => {
  const classes = useStyles();
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { handleLogout, loading } = useContext(AuthContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVariant, setDrawerVariant] = useState("permanent");
  const { user } = useContext(AuthContext);
  const theme = useTheme();
  const { colorMode } = useContext(ColorModeContext);
  const greaterThenSm = useMediaQuery(theme.breakpoints.up("sm"));
  const [volume, setVolume] = useState(localStorage.getItem("volume") || 1);
  const { dateToClient } = useDate();
  const [anchorElLanguage, setAnchorElLanguage] = useState(null);
  const [menuLanguageOpen, setMenuLanguageOpen] = useState(false);
  const socketManager = useContext(SocketContext);

  useEffect(() => { if (document.body.offsetWidth > 1200) setDrawerOpen(true); }, []);
  useEffect(() => {
    setDrawerVariant(document.body.offsetWidth < 600 ? "temporary" : "permanent");
  }, [drawerOpen]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const userId = localStorage.getItem("userId");
    const socket = socketManager.getSocket(companyId);
    socket.on(`company-${companyId}-auth`, (data) => {
      if (data.user.id === +userId) {
        toastError("Sua conta foi acessada em outro computador.");
        setTimeout(() => { localStorage.clear(); window.location.reload(); }, 1000);
      }
    });
    socket.emit("userStatus");
    const interval = setInterval(() => socket.emit("userStatus"), 1000 * 60 * 5);
    return () => { socket.disconnect(); clearInterval(interval); };
  }, [socketManager]);

  const handleMenu = (e) => { setAnchorEl(e.currentTarget); setMenuOpen(true); };
  const handleCloseMenu = () => { setAnchorEl(null); setMenuOpen(false); };
  const handlemenuLanguage = (e) => { setAnchorElLanguage(e.currentTarget); setMenuLanguageOpen(true); };
  const handleCloseMenuLanguage = () => { setAnchorElLanguage(null); setMenuLanguageOpen(false); };
  const handleOpenUserModal = () => { setUserModalOpen(true); handleCloseMenu(); };
  const handleClickLogout = () => { handleCloseMenu(); handleLogout(); };
  const drawerClose = () => { if (document.body.offsetWidth < 600) setDrawerOpen(false); };
  const handleRefreshPage = () => window.location.reload(false);
  const handleMenuItemClick = () => { if (window.innerWidth <= 600) setDrawerOpen(false); };
  const toggleColorMode = () => colorMode.toggleColorMode();

  if (loading) return <BackdropLoading />;

  return (
    <div className={classes.root}>
      <Drawer
        variant={drawerVariant}
        className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
        classes={{ paper: clsx(classes.drawerPaper, !drawerOpen && classes.drawerPaperClose) }}
        open={drawerOpen}
      >
        {/* LOGO HEADER */}
        <div className={classes.toolbarIcon}>
          <img src={logo} className={classes.logo} alt="DAPLE" />
          <IconButton onClick={() => setDrawerOpen(!drawerOpen)} className={classes.chevronBtn}>
            <ChevronLeftIcon />
          </IconButton>
        </div>

        <Divider className={classes.dividerDark} />

        {/* MENU ITEMS */}
        <List className={classes.containerWithScroll}>
          <MainListItems drawerClose={drawerClose} collapsed={!drawerOpen} />
        </List>

        <Divider className={classes.dividerDark} />

        {/* SAMMY MASCOT */}
        {drawerOpen ? (
          <div className={classes.sammyContainer}>
            <img src={sammy} alt="Sammy" className={classes.sammyImg} />
            <Typography className={classes.sammyText}>Assistente DAPLE</Typography>
          </div>
        ) : (
          <div className={classes.sammyContainerClosed}>
            <img src={sammy} alt="Sammy" className={classes.sammyImgSmall} />
          </div>
        )}
      </Drawer>

      <UserModal open={userModalOpen} onClose={() => setUserModalOpen(false)} userId={user?.id} />

      {/* APP BAR */}
      <AppBar
        position="absolute"
        className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
        color="primary"
      >
        <Toolbar variant="dense" className={classes.toolbar}>
          <IconButton
            edge="start"
            aria-label="open drawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={clsx(classes.menuButton, drawerOpen && classes.menuButtonHidden)}
            style={{ color: "#F5C300" }}
          >
            <MenuIcon />
          </IconButton>

          <Typography component="h2" variant="h6" noWrap className={clsx(classes.title, classes.userGreeting)}>
            {greaterThenSm && user?.profile === "admin" && user?.company?.dueDate ? (
              <>{i18n.t("mainDrawer.appBar.greeting.hello")} <b>{user.name}</b>, {i18n.t("mainDrawer.appBar.greeting.welcome")} <b>{user?.company?.name}</b>! ({i18n.t("mainDrawer.appBar.greeting.active")} {dateToClient(user?.company?.dueDate)})</>
            ) : (
              <>{i18n.t("mainDrawer.appBar.greeting.hello")} <b>{user.name}</b>, {i18n.t("mainDrawer.appBar.greeting.welcome")} <b>{user?.company?.name}</b>!</>
            )}
          </Typography>

          <IconButton edge="start" size="small">
            <LanguageOutlined onClick={handlemenuLanguage} style={{ color: "rgba(255,255,255,0.7)", marginRight: 4 }} />
          </IconButton>
          <Menu anchorEl={anchorElLanguage} getContentAnchorEl={null}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            open={menuLanguageOpen} onClose={handleCloseMenuLanguage}>
            <MenuItem><LanguageControl /></MenuItem>
          </Menu>

          <IconButton edge="start" onClick={toggleColorMode} size="small">
            {theme.mode === "dark"
              ? <Brightness7Icon style={{ color: "rgba(255,255,255,0.7)" }} />
              : <Brightness4Icon style={{ color: "rgba(255,255,255,0.7)" }} />}
          </IconButton>

          <NotificationsVolume setVolume={setVolume} volume={volume} />

          <IconButton onClick={handleRefreshPage} color="inherit" size="small">
            <CachedIcon style={{ color: "rgba(255,255,255,0.7)" }} />
          </IconButton>

          {user.id && <NotificationsPopOver volume={volume} />}
          <AnnouncementsPopover />
          <ChatPopover />

          <IconButton aria-label="account of current user" aria-controls="menu-appbar"
            aria-haspopup="true" onClick={handleMenu} style={{ color: "#F5C300" }}>
            <AccountCircle />
          </IconButton>
          <Menu id="menu-appbar" anchorEl={anchorEl} getContentAnchorEl={null}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            open={menuOpen} onClose={handleCloseMenu}>
            <MenuItem onClick={handleOpenUserModal}>{i18n.t("mainDrawer.appBar.user.profile")}</MenuItem>
            <MenuItem onClick={handleClickLogout}>{i18n.t("mainDrawer.appBar.user.logout")}</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <main className={classes.content}>
        <div className={classes.appBarSpacer} />
        {children ? children : null}
      </main>
    </div>
  );
};

export default LoggedInLayout;
