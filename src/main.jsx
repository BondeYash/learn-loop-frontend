import React, { Suspense } from "react";
import PageBoundary from "./components/PageBoundary.jsx";
import LoadingSkeleton from "./components/LoadingSkeleton.jsx";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import Notifications from "./components/Notifications.jsx";

import { ThemeProvider } from "./theme/ThemeProvider.jsx";
import App from "./App.jsx";
import DecisionProvider from "./components/DecisionProvider.jsx";
import { store } from "./store/store.js";
import "./index.css";
import "./readability.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider><BrowserRouter>
        <DecisionProvider><PageBoundary><Suspense fallback={<LoadingSkeleton variant="detail" label="Opening your page…" />}><App /></Suspense></PageBoundary></DecisionProvider>
        <Notifications />
      </BrowserRouter></ThemeProvider>
    </Provider>
  </React.StrictMode>
);
