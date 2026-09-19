import { render } from "preact";
import { App } from "./app/App.tsx";
import "./index.css";

const root = document.getElementById("app");
if (!root) throw new Error("#app not found");
render(<App />, root);
