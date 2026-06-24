import { App } from "./app/app.js";
import "./styles/main.css";
import { initAppViewport, syncAppViewport } from "./ui/viewport.js";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app root element.");
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    // Tizen multitasking: player continues; no action needed for MVP.
  }
});

const app = new App(root);
app.start();

initAppViewport(() => {
  app.onViewportChange();
});
syncAppViewport();