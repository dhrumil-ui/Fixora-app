import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/routes";
import "./styles/index.css";
import { getSocket } from "./app/lib/socket";
import PWAUpdatePrompt from "./app/components/PWAUpdatePrompt";
import "./i18n";

getSocket();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
    <PWAUpdatePrompt />
  </React.StrictMode>,
);
