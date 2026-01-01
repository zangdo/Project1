import { useState } from 'react';
import { register, verifyOtp , validateEmail, validateUsername, validatePassword} from '../services/authService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const RegisterPage = () => {
    const [step, setStep] = useState(1); // 1: Nhập info, 2: Nhập OTP
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        // Validate trước khi gửi
        if (!validateUsername(username)) {
            toast.error("Tên kiếm khách không hợp lệ! (3-20 ký tự, không dấu, không ký tự đặc biệt)");
            return;
        }
        if (!validateEmail(email)) {
            toast.error("Thư tín (Email) không đúng định dạng!");
            return;
        }
        if (!validatePassword(password)) {
            toast.error("Mật tự bí truyền yếu quá! (ít nhất 6 ký tự)");
            return;
        }
        try {
            const msg = await register({ username, email, password });
            toast.success(msg);
            setStep(2); // Chuyển sang bước nhập OTP
        } catch (err) {
            toast.error(err);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        try {
            const msg = await verifyOtp({ email, otpCode: otp });
            toast.success(msg);
            // Sau này sẽ chuyển hướng sang trang Login
            setTimeout(() => window.location.href = '/', 2000);
        } catch (err) {
            toast.error(err);
        }
    };

    return (
        <div className="auth-container" style={styles.container}>
            <ToastContainer />
            <div className="auth-box" style={styles.box}>
                <h2 style={styles.title}>GOMOKU LEGEND</h2>
                
                {step === 1 ? (
                    <form onSubmit={handleRegister} style={styles.form}>
                        <h3 style={styles.subtitle}>Đăng Ký</h3>
                        <input 
                            style={styles.input} 
                            placeholder="Tên kiếm khách (Username)" 
                            value={username} onChange={e => setUsername(e.target.value)} required 
                        />
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
                        <button type="submit" style={styles.button}>Nhận Mã OTP</button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify} style={styles.form}>
                        <h3 style={styles.subtitle}>Xác Thực Tiên Lệnh</h3>
                        <p style={{color: '#5d4037'}}>Đã gửi mã đến: {email}</p>
                        <input 
                            style={styles.input} 
                            placeholder="Nhập mã OTP 6 số" 
                            value={otp} onChange={e => setOtp(e.target.value)} required 
                        />
                        <button type="submit" style={styles.button}>Kích Hoạt Tài Khoản</button>
                    </form>
                )}
            </div>
        </div>
    );
};

// Style CSS-in-JS nhanh (Sau này tách ra file css riêng cũng được)
const styles = {
    container: {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#e6b87c', // Màu gỗ nền
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

export default RegisterPage;