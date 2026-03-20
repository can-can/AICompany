import { Routes, Route } from 'react-router-dom'
import ProjectListView from './views/ProjectListView'

function Placeholder({ label }: { label: string }) {
  return <div className="p-8 text-lg text-gray-600">{label} — coming soon</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectListView />} />
      <Route path="/:project" element={<Placeholder label="Dashboard" />} />
      <Route path="/:project/chat/:role" element={<Placeholder label="Chat" />} />
    </Routes>
  )
}
