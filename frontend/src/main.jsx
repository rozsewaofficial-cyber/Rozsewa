import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./lib/keyboardAvoidance.js";

createRoot(document.getElementById("root")).render(<App />);

