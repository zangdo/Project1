import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/authService';
import { setPlayerStatus } from '../services/gameService'; // Import service mới

const GamePage = () => {
    const navigate = useNavigate();
    const username = localStorage.getItem('username') || "Đại hiệp";
    
    // State quản lý trạng thái tìm trận
    const [isMatching, setIsMatching] = useState(false);

    const handleLogout = () => {
        if (isMatching) return; // Đang tìm trận thì chặn không cho thoát
        logout();
        navigate('/login');
    };

    const toggleMatching = async () => {
        if (!isMatching) {
            // Bắt đầu khiêu chiến
            setIsMatching(true);
            await setPlayerStatus('MATCHING');
        } else {
            // Hủy khiêu chiến
            setIsMatching(false);
            await setPlayerStatus('IDLE');
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.boardArea}>
                <h1 style={styles.title}>Bàn Cờ Gomoku</h1>
                <p style={{marginBottom: '30px', fontSize: '18px'}}>
                    Xin chào, <span style={{fontWeight: 'bold', color: '#3e2723'}}>{username}</span>!
                </p>

                {/* Khu vực trạng thái tìm trận */}
                {isMatching && (
                    <div style={{marginBottom: '20px'}}>
                        <div className="loader"></div>
                        <span style={{color: '#5d4037', fontWeight: 'bold'}}>Đang tìm đối thủ...</span>
                    </div>
                )}

                {/* Các nút bấm */}
                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                    
                    {/* Nút Khiêu Chiến */}
                    <button 
                        onClick={toggleMatching} 
                        style={{
                            ...styles.btn, 
                            background: isMatching ? '#ff9800' : '#2e7d32' // Cam khi hủy, Xanh khi bắt đầu
                        }}
                    >
                        {isMatching ? "Ngừng Khiêu Chiến" : "Khiêu Chiến"}
                    </button>

                    {/* Nút Đăng Xuất */}
                    <button 
                        onClick={handleLogout} 
                        style={{
                            ...styles.btn, 
                            background: '#d32f2f',
                            opacity: isMatching ? 0.5 : 1, // Mờ đi khi đang tìm trận
                            cursor: isMatching ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isMatching}
                    >
                        Đăng Xuất (Rút Lui)
                    </button>
                    
                    {/* Dòng chữ cảnh báo */}
                    {isMatching && (
                        <p style={{color: '#d32f2f', fontSize: '13px', fontStyle: 'italic'}}>
                            * Đang chiến đấu thì không thể quay đầu
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#e6b87c',
    },
    boardArea: {
        textAlign: 'center',
        background: '#fff8e1',
        padding: '50px',
        borderRadius: '10px',
        border: '5px solid #5d4037',
        boxShadow: '10px 10px 0px #3e2723',
        width: '400px'
    },
    title: { color: '#3e2723', fontFamily: 'Courier New, monospace', marginBottom: '10px' },
    btn: {
        padding: '12px 20px',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        fontWeight: 'bold',
        fontSize: '16px',
        transition: '0.3s'
    }
};

export default GamePage;