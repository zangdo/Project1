import { useState } from 'react';
import { forgotPassword, resetPassword, validateEmail, validatePassword } from '../services/authService';
import { toast, ToastContainer } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';

const ForgotPasswordPage = () => {
    const [step, setStep] = useState(1); // 1: Nhập Email, 2: Nhập OTP + Pass mới
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const navigate = useNavigate();

    // Xử lý Bước 1: Gửi Email
    const handleRequestOtp = async (e) => {
        e.preventDefault();
        if (!validateEmail(email)) {
            toast.error("Thư tín (Email) không đúng định dạng!");
            return;
        }
        try {
            const msg = await forgotPassword(email);
            toast.success(msg);
            setStep(2); // Chuyển sang bước 2
        } catch (err) {
            toast.error(err);
        }
    };

    // Xử lý Bước 2: Đổi Pass
    const handleResetPass = async (e) => {
        e.preventDefault();
        if (!validatePassword(newPassword)) {
            toast.error("Mật tự bí truyền yếu quá! (ít nhất 6 ký tự)");
            return;
        }
        try {
            const msg = await resetPassword({ email, otpCode: otp, newPassword });
            toast.success(msg);
            
            // Đợi 2s rồi chuyển về trang Login
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            toast.error(err);
        }
    };

    return (
        <div style={styles.container}>
            <ToastContainer />
            <div style={styles.box}>
                <h2 style={styles.title}>GOMOKU LEGEND</h2>
                <h3 style={styles.subtitle}>Khôi Phục Mật Tịch</h3>

                {step === 1 ? (
                    <form onSubmit={handleRequestOtp} style={styles.form}>
                        <p style={{color: '#5d4037', fontSize: '14px'}}>
                            Nhập thư tín (Email) đã đăng ký để nhận mã xác thực.
                        </p>
                        <input 
                            style={styles.input} 
                            type="email" placeholder="Email của bạn" 
                            value={email} onChange={e => setEmail(e.target.value)} required 
                        />
                        <button type="submit" style={styles.button}>Gửi Mã OTP</button>
                    </form>
                ) : (
                    <form onSubmit={handleResetPass} style={styles.form}>
                        <p style={{color: '#5d4037', fontSize: '14px'}}>
                            Mã OTP đã gửi về: <b>{email}</b>
                        </p>
                        <input 
                            style={styles.input} 
                            placeholder="Mã OTP 6 số" 
                            value={otp} onChange={e => setOtp(e.target.value)} required 
                        />
                        <input 
                            style={styles.input} 
                            type="password" placeholder="Mật khẩu mới" 
                            value={newPassword} onChange={e => setNewPassword(e.target.value)} required 
                        />
                        <button type="submit" style={styles.button}>Đổi Mật Khẩu</button>
                    </form>
                )}
            </div>
        </div>
    );
};

// Style (Copy y hệt Login/Register cho nhanh)
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

export default ForgotPasswordPage;