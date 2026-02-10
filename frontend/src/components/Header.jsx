import { Link } from "react-router-dom";

export default function Header() {
  return (
    <nav style={{ padding: "10px", borderBottom: "1px solid #ccc" }}>
      <Link to="/">Queue</Link> |{" "}
      <Link to="/enqueue">Take Token</Link> |{" "}
      <Link to="/admin">Admin</Link> |{" "}
      <Link to="/counter">Counter</Link>
    </nav>
  );
}
