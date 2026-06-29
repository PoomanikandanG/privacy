/**
 * Main App Component
 * 
 * Sets up React Router for the two main views:
 * - "/" -> PresenterDashboard (for the teacher/presenter)
 * - "/vote" -> StudentBooth (for students to cast votes)
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PresenterDashboard from './pages/PresenterDashboard.jsx';
import StudentBooth from './pages/StudentBooth.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PresenterDashboard />} />
        <Route path="/vote" element={<StudentBooth />} />
      </Routes>
    </Router>
  );
}

export default App;
