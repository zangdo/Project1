import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import PrivateRoute from './components/PrivateRoute'; // Nhớ import
import GamePage from './pages/GamePage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Trang Login/Register/Forgot ai cũng vào được */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        
        {/* Trang Game BẮT BUỘC phải có Token mới được vào */}
        <Route 
            path="/game" 
            element={
                <PrivateRoute>
                    <GamePage />
                </PrivateRoute>
            } 
        />

        {/* Mặc định vào Game luôn (nếu chưa login nó sẽ tự đá về login) */}
        <Route path="/" element={<Navigate to="/game" />} />
      </Routes>
    </Router>
  );
}

export default App;