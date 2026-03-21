import { Routes, Route } from 'react-router-dom'
import ProjectListView from './views/ProjectListView'
import DashboardView from './views/DashboardView'
import ChatView from './views/ChatView'
import TaskDetailView from './views/TaskDetailView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectListView />} />
      <Route path="/:project" element={<DashboardView />} />
      <Route path="/:project/chat/:role" element={<ChatView />} />
      <Route path="/:project/task/:taskId" element={<TaskDetailView />} />
    </Routes>
  )
}
