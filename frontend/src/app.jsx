import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import PublicQueue from "./pages/PublicQueue";
import Enqueue from "./pages/Enqueue";
import AdminDashboard from "./pages/AdminDashboard";
import CounterView from "./pages/CounterView";
import Header from "./components/Header";
import Toast from "./components/Toast";
import useToast from "./hooks/useToast";
import { connectSocket, disconnectSocket, subscribe } from "./services/socket";

export default function App() {
  const { toasts, addToast, removeToast } = useToast();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    connectSocket();

    const unsub = subscribe(msg => {
      if (msg.type === "_CONNECTED") {
        setConnected(true);
      }
      if (msg.type === "_DISCONNECTED") {
        setConnected(false);
      }
    });

    return () => {
      unsub();
      disconnectSocket();
    };
  }, []);

  return (
    <BrowserRouter>
      <Header connected={connected} />
      <Toast toasts={toasts} removeToast={removeToast} />
      <Routes>
        <Route path="/" element={<PublicQueue />} />
        <Route path="/token" element={<Enqueue addToast={addToast} />} />
        <Route path="/counter" element={<CounterView addToast={addToast} />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
