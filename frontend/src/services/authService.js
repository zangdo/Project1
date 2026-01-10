import axios from 'axios';

// Lấy link backend từ biến môi trường (hoặc mặc định localhost)
const API_URL = import.meta.env.VITE_API_URL || 'https://project1-ogf1.onrender.com';

export const register = async (userData) => {
    try {
        const response = await axios.post(`${API_URL}/api/auth/register`, userData);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error.message;
    }
};

export const verifyOtp = async (otpData) => {
    try {
        const response = await axios.post(`${API_URL}/api/auth/verify-otp`, otpData);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error.message;
    }
};
export const login = async (credentials) => {
    try {
        const response = await axios.post(`${API_URL}/api/auth/login`, credentials);
        // Lưu token vào LocalStorage để dùng dần
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('username', response.data.username);
        }
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error.message;
    }
};

// Hàm đăng xuất (Xóa token)
export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
};
export const forgotPassword = async (email) => {
    try {
        // API này dùng @RequestParam nên truyền params
        const response = await axios.post(`${API_URL}/api/auth/forgot-password`, null, {
            params: { email }
        });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error.message;
    }
};

// Đổi mật khẩu mới
export const resetPassword = async (data) => {
    try {
        const response = await axios.post(`${API_URL}/api/auth/reset-password`, data);
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error.message;
    }
};
export const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

// 2. Kiểm tra Username (Từ 3-20 ký tự, không chứa ký tự đặc biệt)
export const validateUsername = (username) => {
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(username);
};

// 3. Kiểm tra Mật khẩu (Ít nhất 6 ký tự)
export const validatePassword = (password) => {
    return password.length >= 6;
};
// Hàm đa năng: Truyền username vào thì lấy người đó, không truyền thì lấy chính mình
export const getUserProfile = async (username = null) => {
    try {
        const token = localStorage.getItem('token');
        
        // Tạo params nếu có username
        const params = username ? { username } : {};

        const response = await axios.get(`${API_URL}/api/game/user`, {
            headers: { Authorization: `Bearer ${token}` },
            params: params
        });
        return response.data;
    } catch (error) {
        throw error.response ? error.response.data : error.message;
    }
};