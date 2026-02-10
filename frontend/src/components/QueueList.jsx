export default function QueueList({ queue }) {
  if (!queue.length) return <p>No one in queue</p>;

  return (
    <ul>
      {queue.map(item => (
        <li key={item.id}>
          Token: {item.id} ({item.status})
        </li>
      ))}
    </ul>
  );
}
