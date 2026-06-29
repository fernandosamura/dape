import React, { useEffect, useState } from "react";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard/";
import TicketResponsiveContainer from "../pages/TicketResponsiveContainer";
import Signup from "../pages/Signup/";
import Login from "../pages/Login/";
import Connections from "../pages/Connections/";
import SettingsCustom from "../pages/SettingsCustom/";
import Financeiro from "../pages/Financeiro/";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts/";
import Queues from "../pages/Queues/";
import Tags from "../pages/Tags/";
import MessagesAPI from "../pages/MessagesAPI/";
import Helps from "../pages/Helps/";
import ContactLists from "../pages/ContactLists/";
import ContactListItems from "../pages/ContactListItems/";
// import Companies from "../pages/Companies/";
import QuickMessages from "../pages/QuickMessages/";
import Kanban from "../pages/Kanban";
import { AuthProvider } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";
import Schedules from "../pages/Schedules";
import Campaigns from "../pages/Campaigns";
import CampaignsConfig from "../pages/CampaignsConfig";
import CampaignReport from "../pages/CampaignReport";
import Annoucements from "../pages/Annoucements";
import Chat from "../pages/Chat";
import ToDoList from "../pages/ToDoList/";
import Subscription from "../pages/Subscription/";
import Files from "../pages/Files/";
import Prompts from "../pages/Prompts";
import QueueIntegration from "../pages/QueueIntegration";
import ForgetPassword from "../pages/ForgetPassWord/"; // Reset PassWd
import Landing from "../pages/Landing";
import CampaignsPhrase from "../pages/CampaignsPhrase";
import FlowBuilder from "../pages/FlowBuilder";
import FlowBuilderConfig from "../pages/FlowBuilderConfig";
import DapeMasterPanel from "../pages/dape/master/DapeMasterPanel";
import DapePipelinePage from "../pages/dape/DapePipelinePage";
import DapeAnalyticsPage from "../pages/dape/DapeAnalytics";
import DapeGrowthPage from "../pages/dape/DapeGrowth";
import DapeIntelligencePage from "../pages/dape/DapeIntelligencePage";
import DapeRadarPage from "../pages/dape/DapeRadarPage";
import DapeKanbanPage from "../pages/dape/DapeKanbanPage";
import DapeBillingPage from "../pages/dape/DapeBillingPage";
import DapeShieldPage from "../pages/dape/DapeShieldPage";

const Routes = () => {
  const [showCampaigns, setShowCampaigns] = useState(false);

  useEffect(() => {
    const cshow = localStorage.getItem("cshow");
    if (cshow !== undefined) {
      setShowCampaigns(true);
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <TicketsContextProvider>
          <Switch>
            <Route exact path="/daple" component={Landing} />
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />
            <Route exact path="/forgetpsw" component={ForgetPassword} />
            {/* <Route exact path="/create-company" component={Companies} /> */}
            <WhatsAppsProvider>
              <LoggedInLayout>
                <Route exact path="/" component={Dashboard} isPrivate />
                <Route
                  exact
                  path="/tickets/:ticketId?"
                  component={TicketResponsiveContainer}
                  isPrivate
                />
                <Route
                  exact
                  path="/connections"
                  component={Connections}
                  isPrivate
                />
                <Route
                  exact
                  path="/quick-messages"
                  component={QuickMessages}
                  isPrivate
                />
                <Route exact path="/todolist" component={ToDoList} isPrivate />
                <Route
                  exact
                  path="/schedules"
                  component={Schedules}
                  isPrivate
                />
                <Route exact path="/tags" component={Tags} isPrivate />
                <Route exact path="/contacts" component={Contacts} isPrivate />
                <Route exact path="/helps" component={Helps} isPrivate />
                <Route exact path="/users" component={Users} isPrivate />
                <Route exact path="/files" component={Files} isPrivate />
                <Route exact path="/prompts" component={Prompts} isPrivate />
                <Route
                  exact
                  path="/queue-integration"
                  component={QueueIntegration}
                  isPrivate
                />

                <Route
                  exact
                  path="/messages-api"
                  component={MessagesAPI}
                  isPrivate
                />
                <Route
                  exact
                  path="/settings"
                  component={SettingsCustom}
                  isPrivate
                />
                <Route exact path="/kanban" component={Kanban} isPrivate />
                <Route
                  exact
                  path="/financeiro"
                  component={Financeiro}
                  isPrivate
                />
                <Route exact path="/queues" component={Queues} isPrivate />
                <Route
                  exact
                  path="/announcements"
                  component={Annoucements}
                  isPrivate
                />
                <Route
                  exact
                  path="/subscription"
                  component={Subscription}
                  isPrivate
                />
                <Route exact path="/chats/:id?" component={Chat} isPrivate />
                <Route exact path="/dape/pipeline" component={DapePipelinePage} isPrivate />
                <Route exact path="/dape/analytics" component={DapeAnalyticsPage} isPrivate />
                <Route exact path="/dape/growth" component={DapeGrowthPage} isPrivate />
                <Route exact path="/dape/intelligence" component={DapeIntelligencePage} isPrivate />
                <Route exact path="/dape/radar" component={DapeRadarPage} isPrivate />
                <Route exact path="/dape/kanban" component={DapeKanbanPage} isPrivate />
                <Route exact path="/dape/master" component={DapeMasterPanel} isPrivate />
                <Route exact path="/dape/billing" component={DapeBillingPage} isPrivate />
                <Route exact path="/dape/shield" component={DapeShieldPage} isPrivate />
                {showCampaigns && (
                  <>
                    <Route
                      exact
                      path="/contact-lists"
                      component={ContactLists}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/contact-lists/:contactListId/contacts"
                      component={ContactListItems}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/campaigns"
                      component={Campaigns}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/campaign/:campaignId/report"
                      component={CampaignReport}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/campaigns-config"
                      component={CampaignsConfig}
                      isPrivate
                    />

                    <Route
                      exact
                      path="/phrase-lists"
                      component={CampaignsPhrase}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/flowbuilders"
                      component={FlowBuilder}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/flowbuilder/:id?"
                      component={FlowBuilderConfig}
                      isPrivate
                    />

                  </>
                )}
              </LoggedInLayout>
            </WhatsAppsProvider>
          </Switch>
          <ToastContainer autoClose={3000} />
        </TicketsContextProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
