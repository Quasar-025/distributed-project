import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicQueue from "./pages/PublicQueue";
import Enqueue from "./pages/Enqueue";
import AdminDashboard from "./pages/AdminDashboard";
import CounterView from "./pages/CounterView";
import Header from "./components/Header";

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<PublicQueue />} />
        <Route path="/enqueue" element={<Enqueue />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/counter" element={<CounterView />} />
      </Routes>
    </BrowserRouter>
  );
}
