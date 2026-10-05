import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import Notifications from "./components/Notifications.jsx";

import { ThemeProvider } from "./theme/ThemeProvider.jsx";
import App from "./App.jsx";
import DecisionProvider from "./components/DecisionProvider.jsx";
import { store } from "./store/store.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider><BrowserRouter>
        <DecisionProvider><App /></DecisionProvider>
        <Notifications />
      </BrowserRouter></ThemeProvider>
    </Provider>
  </React.StrictMode>
);
