import { useState } from 'react';
import { login, validateEmail, validatePassword} from '../services/authService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from "jwt-decode";
import { useEffect } from 'react';
const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                if (decoded.exp * 1000 > Date.now()) {
                    navigate('/game'); // Còn hạn mới cho vào
                } else {
                    // Hết hạn thì xóa đi để người dùng đăng nhập lại
                    localStorage.removeItem('token');
                }
            } catch (e) {
                localStorage.removeItem('token');
            }
        }
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!validateEmail(email)) {
            toast.error("Thư tín (Email) không đúng định dạng!");
            return;
        }
        if (!validatePassword(password)) {
            toast.error("Mật tự bí truyền yếu quá! (ít nhất 6 ký tự)");
            return;
        }
        try {
            const data = await login({ email, password });
            toast.success(`Chào mừng đại hiệp ${data.username} quay lại!`);
            
            // Sau này chuyển hướng vào trang Game
            setTimeout(() => {
                navigate('/game'); // <--- DÙNG CÁI NÀY
            }, 1500);
            
            console.log("Token nhận được:", data.token); // Check thử console xem có token chưa
        } catch (err) {
            toast.error("Đăng nhập thất bại: " + (err.message || "Sai tài khoản hoặc mật khẩu"));
        }
    };

    return (
        <div style={styles.container}>
            <ToastContainer />
            <div style={styles.box}>
                <h2 style={styles.title}>GOMOKU LEGEND</h2>
                <h3 style={styles.subtitle}>Đăng Nhập</h3>
                
                <form onSubmit={handleLogin} style={styles.form}>
                    <input 
                        style={styles.input} 
                        type="email" placeholder="Thư tín (Email)" 
                        value={email} onChange={e => setEmail(e.target.value)} required 
                    />
                    <input 
                        style={styles.input} 
                        type="password" placeholder="Mật khẩu bí truyền" 
                        value={password} onChange={e => setPassword(e.target.value)} required 
                    />
                    <button type="submit" style={styles.button}>Vào Giang Hồ</button>
                </form>

                <p style={{marginTop: '20px', color: '#5d4037'}}>
                    Chưa có danh phận? <a href="/register" style={{fontWeight: 'bold', color: '#3e2723'}}>Đăng ký ngay</a>
                </p>
                <p style={{marginTop: '5px'}}>
                     <a href="/forgot-password" style={{fontSize: '14px', color: '#5d4037'}}>Quên mật khẩu?</a>
                </p>
            </div>
        </div>
    );
};

// Style dùng lại của RegisterPage cho nhanh
const styles = {
    container: {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#e6b87c',
        backgroundImage: 'radial-gradient(#d4a366 10%, transparent 11%), radial-gradient(#d4a366 10%, transparent 11%)',
        backgroundSize: '30px 30px',
    },
    box: {
        background: '#fff8e1',
        padding: '40px',
        borderRadius: '10px',
        border: '5px solid #5d4037',
        boxShadow: '10px 10px 0px #3e2723',
        width: '400px',
        textAlign: 'center',
    },
    title: { color: '#3e2723', fontFamily: 'Courier New, monospace', fontSize: '30px', marginBottom: '20px', fontWeight: 'bold' },
    subtitle: { color: '#5d4037', marginBottom: '20px' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    input: { padding: '12px', border: '2px solid #8d6e63', borderRadius: '5px', outline: 'none', background: '#efebe9' },
    button: { padding: '12px', background: '#5d4037', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }
};

export default LoginPage;