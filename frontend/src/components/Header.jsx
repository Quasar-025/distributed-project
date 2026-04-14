import { NavLink, Link } from "react-router-dom";

export default function Header({ connected }) {
  return (
    <nav>
      <Link to="/" className="brand">ShardForge Lab</Link>
      <div className="nav-links">
        <NavLink to="/" end>Cluster Monitor</NavLink>
        <NavLink to="/token">Benchmark</NavLink>
        <NavLink to="/counter">Node Progress</NavLink>
        <NavLink to="/admin">Control Center</NavLink>
      </div>
      <div className="status-dot">
        <span className={`dot ${connected ? "online" : "offline"}`} />
        {connected ? "Cluster Live" : "Offline"}
      </div>
    </nav>
  );
}
