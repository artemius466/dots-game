import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { SocketProvider } from "./socketContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </StrictMode>,
);
