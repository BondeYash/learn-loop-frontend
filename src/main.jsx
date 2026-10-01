import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { ThemeProvider } from "./theme/ThemeProvider.jsx";
import App from "./App.jsx";
import { store } from "./store/store.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider><BrowserRouter>
        <App />
        <ToastContainer position="top-right" autoClose={3500} newestOnTop theme="colored" />
      </BrowserRouter></ThemeProvider>
    </Provider>
  </React.StrictMode>
);
