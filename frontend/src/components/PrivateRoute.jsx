import { Navigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode"; // Import thư viện vừa cài

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');

    if (!token) {
        return <Navigate to="/login" />;
    }

    try {
        // Giải mã token
        const decoded = jwtDecode(token);
        
        // Kiểm tra thời gian hết hạn (exp tính bằng giây, Date.now tính bằng mili-giây)
        if (decoded.exp * 1000 < Date.now()) {
            // Hết hạn -> Xóa token và đá về Login
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            return <Navigate to="/login" />;
        }
    } catch (error) {
        // Token rác/lỗi -> Xóa và đá về Login
        localStorage.removeItem('token');
        return <Navigate to="/login" />;
    }

    // Token xịn -> Cho vào
    return children;
};

export default PrivateRoute;