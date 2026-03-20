import { Routes, Route } from 'react-router-dom'
import ProjectListView from './views/ProjectListView'
import DashboardView from './views/DashboardView'
import ChatView from './views/ChatView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectListView />} />
      <Route path="/:project" element={<DashboardView />} />
      <Route path="/:project/chat/:role" element={<ChatView />} />
    </Routes>
  )
}
