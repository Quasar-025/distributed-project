import { NavLink, Link } from "react-router-dom";

export default function Header({ connected }) {
  return (
    <nav>
      <Link to="/" className="brand">QueueSync</Link>
      <div className="nav-links">
        <NavLink to="/" end>Queue</NavLink>
        <NavLink to="/token">Get Token</NavLink>
        <NavLink to="/counter">Counter</NavLink>
        <NavLink to="/admin">Admin</NavLink>
      </div>
      <div className="status-dot">
        <span className={`dot ${connected ? "online" : "offline"}`} />
        {connected ? "Live" : "Offline"}
      </div>
    </nav>
  );
}
