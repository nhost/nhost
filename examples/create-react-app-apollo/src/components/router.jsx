import React from "react";
import { BrowserRouter, Switch, Route } from "react-router-dom";

import { AuthGate } from "components/auth-gate";
import { Layout } from "components/app/layout/layout";
import { Dashboard } from "components/app/dashboard";
import { Settings } from "components/app/settings";

import { Register } from "components/register";
import { Login } from "components/login";

function RouterApp() {
  return (
    <AuthGate>
      <Layout>
        <Switch>
          <Route exact path="/">
            <Dashboard />
          </Route>
          <Route exact path="/settings">
            <Settings />
          </Route>
        </Switch>
      </Layout>
    </AuthGate>
  );
}

export function Router() {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/register">
          <Register />
        </Route>
        <Route exact path="/login">
          <Login />
        </Route>
        <Route path="/">
          <RouterApp />
        </Route>
      </Switch>
    </BrowserRouter>
  );
}
