import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SockJS from 'sockjs-client/dist/sockjs'; // npm install sockjs-client
import { Stomp } from '@stomp/stompjs';         // npm install @stomp/stompjs
import { logout, getUserProfile } from '../services/authService';
import { setPlayerStatus} from '../services/gameService';
import axios from 'axios';

const BOARD_SIZE = 15;
const SOCKET_URL = 'http://localhost:8080/ws-gomoku'; // Link backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const GamePage = () => {
    const navigate = useNavigate();
    
    // --- STATE QUẢN LÝ USER ---
    const [user, setUser] = useState(null);
    const [opponent, setOpponent] = useState({ username: "Đang chờ...", elo: "???" , avatar: "https://cafef.vn/streamer-do-mixi-thanh-lap-cong-ty-quang-cao-von-dieu-le-500-trieu-dong-tru-so-o-tphcm-188241226082116588.chn"});
    
    // --- STATE SOCKET & GAME ---
    const stompClientRef = useRef(null); // Dùng ref để giữ kết nối không bị mất khi render lại
    const [gameState, setGameState] = useState("IDLE"); // IDLE, MATCHING, MATCHED, PLAYING
    const [roomId, setRoomId] = useState(null);
    
    // Bàn cờ
    const [board, setBoard] = useState(Array(BOARD_SIZE * BOARD_SIZE).fill(null));
    const [isMyTurn, setIsMyTurn] = useState(false);
    const [needcurrent, setNeedCurrent] = useState(true); // 'X' hoặc 'O'
    // Ready Phase
    const [isMyReady, setIsMyReady] = useState(false);
    const [isOpReady, setIsOpReady] = useState(false);
    const [countdown, setCountdown] = useState(10);
    const [p1Username, setP1Username] = useState(null);
    const [p1TimeLeft, setP1TimeLeft] = useState(600000);
    const [p2TimeLeft, setP2TimeLeft] = useState(600000);
    const [currentTurnSymbol, setCurrentTurnSymbol] = useState(null); // 'X' hoặc 'O'
    const [winnerName, setWinnerName] = useState(null);
    const p1UsernameRef = useRef(null);
    const currentTurnSymbolRef = useRef(null); // Để Interval luôn đọc được Symbol mới nhất
    const lastTickRef = useRef(Date.now());
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    // 1. KẾT NỐI SOCKET & LẤY INFO KHI VÀO TRANG
   useEffect(() => {
        const init = async () => {
            try {
                const userData = await getUserProfile();
                setUser(userData);
                // Sau khi có user mới kết nối socket và check game
                connectSocket(userData.username, () => {
                    // Callback này chạy sau khi socket connected
                    checkCurrentGame(stompClientRef.current, userData.username).finally(() => {
                        setIsInitialLoading(false);
                    });
                });
            } catch (error) {
                console.error(error);
                setIsInitialLoading(false);
            }
        };
        init();
    }, []);

    // 2. HÀM KẾT NỐI SOCKET
    const connectSocket = (myUsername, onConnect) => {
        const socket = new SockJS(SOCKET_URL);
        const client = Stomp.over(socket);
        
        // Tắt log debug cho đỡ rác console
        //client.debug = () => {}; 
        const token = localStorage.getItem('token');

        client.connect({'Authorization': `Bearer ${token}`}, () => {
            console.log("Đã kết nối Socket!");
            stompClientRef.current = client;

            // Lắng nghe tin báo tìm thấy trận (Kênh riêng tư)
            client.subscribe('/user/queue/match', (msg) => {
                const data = JSON.parse(msg.body);
                if (data.roomId === "TIMEOUT") {
                    console.log("Không tìm thấy đối thủ, vui lòng thử lại!");
                    setGameState("IDLE");
                } else {
                    console.log("Tìm thấy trận! Phòng: " + data.roomId);
                    setRoomId(data.roomId);
                    setOpponent({ username: data.opponent, elo: data.opponentElo, avatar: data.opponentAvatar}); // Tạm thời
                    const remaining = Math.floor((data.readyDeadline - Date.now()) / 1000);
                    setCountdown(remaining > 0 ? remaining : 0);

                    setGameState("MATCHED");
                    
                    // Sau khi có phòng -> Nghe tiếp kênh của phòng đó
                    subscribeRoomChannel(client, data.roomId, myUsername);
                }
            });
            if (needcurrent) {
                checkCurrentGame(client, myUsername);
                setNeedCurrent(false);
            }
            if (onConnect) onConnect();
        });
    };

    // 3. LẮNG NGHE KÊNH PHÒNG CHUNG
    const subscribeRoomChannel = (client, roomId, myUsername) => {
        client.subscribe(`/topic/room/${roomId}/ready`, (msg) => {
            const data = JSON.parse(msg.body);
            console.log("Tin nhắn Ready từ:", data.username);
            console.log("Tôi là:", myUsername);
            console.log(`'${data.username}' vs '${myUsername}'`);
            console.log("Giống nhau không?", data.username === myUsername);
            console.log("ready không?", isOpReady);
            if (data.username !== myUsername) {
                setIsOpReady(data.isReady);  
            }
        });
        client.subscribe(`/topic/room/${roomId}/start`, (msg) => {
            const data = JSON.parse(msg.body);
            // Server báo ai đi trước (p1 đi trước)
            setIsMyTurn(data.p1 === myUsername); 
            setP1Username(data.p1);
            p1UsernameRef.current = data.p1; // Lưu vào ref
            setCurrentTurnSymbol('X'); // Luôn luôn p1 là X
            currentTurnSymbolRef.current = 'X'; // Mặc định P1 là X
            setGameState("PLAYING");
            lastTickRef.current = Date.now(); // Bắt đầu tính giờ
        });

        client.subscribe(`/topic/room/${roomId}/move`, (msg) => {
            const move = JSON.parse(msg.body);
            handleReceiveMove(move, myUsername);
        });

    };

    // 4. XỬ LÝ LOGIC NÚT BẤM
    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleMatching = async () => {
        if (gameState === "IDLE") {
            connectSocket(user.username, async () => {
                // Socket nối xong mới chạy đoạn này
                setGameState("MATCHING");
                await setPlayerStatus('MATCHING'); // Giờ mới báo Backend
            });
        } else {
            setGameState("IDLE");
        }
    };

    const toggleReady = () => {
        const newStatus = !isMyReady;
        setIsMyReady(newStatus);
        stompClientRef.current.send("/app/game/ready", {}, JSON.stringify({
            roomId: roomId,
            username: user.username, // Dùng username thật
            isReady: newStatus
        }));
    };

    const handleCellClick = (index) => {
        if (gameState !== "PLAYING" || !isMyTurn || board[index]) return;
        
        const x = Math.floor(index / BOARD_SIZE);
        const y = index % BOARD_SIZE;
        stompClientRef.current.send("/app/game/move", {}, JSON.stringify({ 
            roomId, x, y, username: user.username 
        }));
    };

    const handleReceiveMove = (gameState, myUsername) => {
        console.log("Nhận nước đi từ Server:", gameState);
        
        // 1. Cập nhật bàn cờ
        const flatBoard = gameState.board.flat().map(cell => {
            if (cell === 0) return null;
            return cell === 1 ? 'X' : 'O';
        });
        setBoard(flatBoard);

        // 2. QUAN TRỌNG: Cập nhật thời gian từ Server để đồng bộ
        setP1TimeLeft(gameState.p1TimeLeft);
        setP2TimeLeft(gameState.p2TimeLeft);

        // 3. XÁC ĐỊNH LƯỢT TIẾP THEO (Dùng Ref để không bị lỗi giá trị cũ)
        // Nếu người vừa đánh là P1 -> Người tiếp theo là O. Ngược lại là X.
        const isLastMoveByP1 = gameState.playername === p1UsernameRef.current;
        const nextSymbol = isLastMoveByP1 ? 'O' : 'X';

        // Cập nhật State để UI thay đổi
        setCurrentTurnSymbol(nextSymbol);
        // Cập nhật Ref để cái setInterval (đồng hồ) nhận ra ngay lập tức
        currentTurnSymbolRef.current = nextSymbol; 

        setIsMyTurn(gameState.playername !== myUsername);

        // 4. Kiểm tra thắng thua
        if (gameState.winner) {
            setWinnerName(gameState.winner);
            setGameState("ENDED");
            setTimeout(() => setGameState("IDLE"), 2000);
        }
    };
    const handleSurrender = () => {
        stompClientRef.current.send("/app/game/move", {}, JSON.stringify({ 
            roomId, 
            x: -1, 
            y: -1, 
            username: user.username 
        }));
    };

    const formatTime = (ms) => {
        if (ms < 0) ms = 0;
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10); // Lấy 2 số đầu của ms

        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}`;
    };
    const checkCurrentGame = async (client, myUsername) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/api/game/current`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.status === 200 && res.data) {
                const data = res.data;
                console.log("Dữ liệu khôi phục:", data);

                setRoomId(data.roomId);
                setOpponent({ 
                    username: data.opponent, 
                    elo: data.opponentElo, 
                    avatar: data.opponentAvatar 
                });

                // 1. Cập nhật Player 1 (người cầm quân X)
                const p1 = data.p1Username;
                setP1Username(p1);
                p1UsernameRef.current = p1; 

                // 2. Xác định Symbol hiện tại dựa trên P1
                const turnSymbol = (data.currentTurn === p1) ? 'X' : 'O';
                setCurrentTurnSymbol(turnSymbol);
                currentTurnSymbolRef.current = turnSymbol; 

                // 3. Đồng bộ thời gian chơi
                setP1TimeLeft(data.p1TimeLeft);
                setP2TimeLeft(data.p2TimeLeft);
                lastTickRef.current = Date.now();

                // 4. Vẽ bàn cờ
                const flatBoard = data.board.flat().map(cell => {
                    if (cell === 0) return null;
                    return cell === 1 ? 'X' : 'O';
                });
                setBoard(flatBoard);

                // 5. Xác định lượt của tôi
                setIsMyTurn(data.currentTurn === myUsername);

                // 6. XỬ LÝ PHẦN READY (COUNTDOWN)
                if (data.gameState === "WAITING") {
                    // Tính toán số giây còn lại từ deadline của Server
                    const remaining = Math.floor((data.readyDeadline - Date.now()) / 1000);
                    
                    if (remaining > 0) {
                        setCountdown(remaining); // Cập nhật lại số giây thực tế
                        setGameState("MATCHED");
                    } else {
                        // Nếu quá hạn thì đưa về sảnh
                        setGameState("IDLE");
                        setIsInitialLoading(false);
                        return;
                    }
                } else {
                    setGameState("PLAYING"); 
                }

                subscribeRoomChannel(client, data.roomId, myUsername);
                
                // Tắt màn hình loading sau khi đã setup xong mọi thứ
                setIsInitialLoading(false);
            }
        } catch (e) {
            console.error("Lỗi khôi phục:", e);
            setIsInitialLoading(false);
        }
    };
    // 5. LOGIC ĐẾM NGƯỢC
    useEffect(() => {
        let timer;
        
        // Trường hợp 1: Đang đếm
        if (gameState === "MATCHED" && countdown > 0) {
            timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
        } 
        // Trường hợp 2: Hết giờ (Về 0) -> ĐÁ VỀ IDLE NGAY
        else if (gameState === "MATCHED" && countdown === 0) {
            
            setGameState("IDLE"); // <--- QUAN TRỌNG NHẤT
            // (Cái useEffect dọn rác nó sẽ lo phần còn lại như reset state, setPlayerStatus...)
        }
        
        return () => clearInterval(timer);
    }, [gameState, countdown]);


    useEffect(() => {
        if (gameState === "IDLE") {
            console.log("Game về IDLE -> Reset toàn bộ state...");
            if (stompClientRef.current) {
                stompClientRef.current.deactivate(); // Cắt đứt luôn
                stompClientRef.current = null;
                console.log("Đã ngắt kết nối Socket.");
            }

            getUserProfile().then(data => {
                setUser(data);
            });

            // 1. Báo Backend (Quan trọng)
            setPlayerStatus('IDLE');

            // 2. Reset Đối thủ & Phòng
            setOpponent({ username: "Đang chờ...", elo: "???" , avatar: "https://cafef.vn/streamer-do-mixi-thanh-lap-cong-ty-quang-cao-von-dieu-le-500-trieu-dong-tru-so-o-tphcm-188241226082116588.chn"});
            setRoomId(null);
            
            // 3. Reset Bàn cờ & Luật chơi
            setBoard(Array(BOARD_SIZE * BOARD_SIZE).fill(null));
            setIsMyTurn(false);
            setWinnerName(null);
            setCurrentTurnSymbol(null);
            setP1Username(null);

            // 4. Reset Thời gian
            setP1TimeLeft(600000);
            setP2TimeLeft(600000);
            // setP1TimeLeft/p2TimeLeft nếu ông dùng biến riêng thì reset nốt
            
            // 5. Reset Ready Phase
            setIsMyReady(false);
            setIsOpReady(false);
            setCountdown(10);
        }
    }, [gameState]);


    useEffect(() => {
        let interval;
        if (gameState === "PLAYING") {
            // Ghi nhận mốc bắt đầu ngay lập tức
            lastTickRef.current = Date.now();
            
            interval = setInterval(() => {
                const now = Date.now();
                const delta = now - lastTickRef.current; // Tính thời gian thực tế đã trôi qua
                lastTickRef.current = now; // Cập nhật mốc mới cho lần sau

                // Lấy Symbol từ Ref để tránh lỗi Closure (Stale State)
                const currentSymbol = currentTurnSymbolRef.current;

                if (currentSymbol === 'X') {
                    setP1TimeLeft(prev => {
                        const newTime = Math.max(0, prev - delta);
                        // Kiểm tra hết giờ cho mình (nếu mình là P1)
                        if (newTime === 0 && isMyTurn && user?.username === p1UsernameRef.current) {
                            handleSurrender();
                        }
                        return newTime;
                    });
                } else if (currentSymbol === 'O') {
                    setP2TimeLeft(prev => {
                        const newTime = Math.max(0, prev - delta);
                        // Kiểm tra hết giờ cho mình (nếu mình là P2)
                        if (newTime === 0 && isMyTurn && user?.username !== p1UsernameRef.current) {
                            handleSurrender();
                        }
                        return newTime;
                    });
                }
            }, 100); // 10ms để centiseconds chạy mượt
        }
        return () => clearInterval(interval);
    }, [gameState]); // Chỉ phụ thuộc vào trạng thái game (IDLE -> PLAYING)

    // --- RENDER GIAO DIỆN ---


    const myRealUsername = user?.username;
    const p1Name = p1Username || p1UsernameRef.current;
    const isIAmP1 = myRealUsername === p1Name;

    // 2. Xác định hiển thị thời gian
    const myTimeDisplay = isIAmP1 ? p1TimeLeft : p2TimeLeft;
    const opTimeDisplay = isIAmP1 ? p2TimeLeft : p1TimeLeft;

    // 3. MÀN HÌNH LOADING (Chặn render sai lệch khi chưa xong API)
    if (isInitialLoading && gameState !== "IDLE") {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <div className="loading-text">ĐANG CHUẨN BỊ VÕ ĐÀI...</div>
            </div>
        );
    }
    // GIAO DIỆN 1: SẢNH CHỜ (LOBBY)
    if (gameState === "IDLE" || gameState === "MATCHING") {
        return (
            <div style={styles.container}>
                <div style={styles.boardArea}>
                    <h1 style={styles.title}>Bàn Cờ Gomoku</h1>
                    <p style={{marginBottom: '30px', fontSize: '18px'}}>
                        Xin chào, <span style={{fontWeight: 'bold', color: '#3e2723'}}>{user?.username || "Đại hiệp"}</span>!
                    </p>
                    <div style={styles.profileCard}>
                        {/* Avatar */}
                        <img 
                            src={user?.avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${user?.username}`} 
                            alt="Avatar" 
                            style={styles.bigAvatar}
                        />
                        
                        {/* Tên & Email */}
                        <h2 style={styles.profileName}>{user?.username || "Đại hiệp"}</h2>
                        <p style={styles.profileEmail}>{user?.email}</p>
                        
                        {/* Elo */}
                        <div style={styles.eloBadge}>ELO: {user?.elo || 1000}</div>

                        {/* Thống kê Win/Loss/Draw */}
                        <div style={styles.statsRow}>
                            <div style={styles.statItem}>
                                <span style={{color: '#2e7d32'}}>W: {user?.wins || 0}</span>
                            </div>
                            <div style={styles.statItem}>
                                <span style={{color: '#d32f2f'}}>L: {user?.losses || 0}</span>
                            </div>
                            <div style={styles.statItem}>
                                <span style={{color: '#f57c00'}}>D: {user?.draws || 0}</span>
                            </div>
                        </div>
                    </div>
                    {gameState === "MATCHING" && (
                        <div style={{marginBottom: '20px'}}>
                            <div className="loader"></div>
                            <span style={{color: '#5d4037', fontWeight: 'bold'}}>Đang tìm đối thủ...</span>
                        </div>
                    )}

                    <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                        <button 
                            onClick={toggleMatching} 
                            style={{
                                ...styles.btn, 
                                background: gameState === "MATCHING" ? '#ff9800' : '#2e7d32'
                            }}
                        >
                            {gameState === "MATCHING" ? "Ngừng Khiêu Chiến" : "Khiêu Chiến"}
                        </button>

                        <button 
                            onClick={handleLogout} 
                            style={{
                                ...styles.btn, 
                                background: '#d32f2f',
                                opacity: gameState === "MATCHING" ? 0.5 : 1,
                                cursor: gameState === "MATCHING" ? 'not-allowed' : 'pointer'
                            }}
                            disabled={gameState === "MATCHING"}
                        >
                            Đăng Xuất (Rút Lui)
                        </button>
                        
                        {gameState === "MATCHING" && (
                            <p style={{color: '#d32f2f', fontSize: '13px', fontStyle: 'italic'}}>
                                * Đang chiến đấu thì không thể quay đầu
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // GIAO DIỆN 2: BÀN CỜ (ARENA)
    return (
        <div style={styles.container}>
            {gameState === "ENDED" && (
                <div style={styles.overlay}>
                    <h1 style={{
                        fontSize: '80px', 
                        // Nếu DRAW thì màu xám, thắng xanh, thua đỏ
                        color: winnerName === "DRAW" ? '#9e9e9e' : (user.username === winnerName ? '#4caf50' : '#d32f2f'),
                        textShadow: '2px 2px 0px #000'
                    }}>
                        {winnerName === "DRAW" ? "DRAW" : (user.username === winnerName ? "VICTORY" : "DEFEAT")}
                    </h1>
                </div>
            )}
            {gameState === "MATCHED" && (
                <div style={styles.overlay}>
                    <div style={styles.overlayBox}>
                        <div style={styles.playerSection}>
                            <div style={{...styles.readyIndicator, background: isOpReady ? '#4caf50' : '#ccc'}}></div>
                            <img 
                                src={opponent.avatar} 
                                alt="OpAvatar" 
                                style={styles.avatarCircle} // Dùng lại style cũ hoặc chỉnh lại tí
                            />
                            <div>
                                <p style={styles.playerName}>{opponent.username}</p>
                                <p>ELO: {opponent.elo}</p>
                            </div>
                        </div>

                        <h1 style={{fontSize: '50px', margin: '20px 0', color: '#d32f2f'}}>{countdown}s</h1>
                        <div style={{width: '100%', height: '2px', background: '#3e2723'}}></div>

                        <button onClick={toggleReady} style={{
                            ...styles.readyBtn,
                            background: isMyReady ? '#d32f2f' : '#4caf50'
                        }}>
                            {isMyReady ? "NOT READY" : "READY"}
                        </button>
                    </div>
                </div>
            )}

            <div style={{...styles.gameArea, filter: gameState === "MATCHED" ? 'blur(5px)' : 'none'}}>
                
                {/* THÔNG TIN ĐỐI THỦ (TOP) */}
                <div style={styles.playerInfoTop }>
                    <img 
                        src={opponent.avatar} 
                        alt="OpAvatar" 
                        style={styles.avatarCircleSmall} 
                    />
                    <div><b>{opponent.username}</b> <span>(ELO: {opponent.elo})</span></div>
                    
                    {/* ĐỒNG HỒ ĐỐI THỦ: Nếu mình là P1 thì hiện giờ P2, và ngược lại */}
                    <div style={styles.timer}>
                        {formatTime(opTimeDisplay)}
                    </div>
                </div>

                {/* BÀN CỜ */}
                <div style={styles.board}>
                    {board.map((cell, index) => (
                        <div key={index} style={styles.cell} onClick={() => handleCellClick(index)}>
                            {cell === 'X' && <div className="piece-x"></div>}
                            {cell === 'O' && <div className="piece-o"></div>}
                        </div>
                    ))}
                </div>

                {/* THÔNG TIN CỦA MÌNH (BOTTOM) */}
                <div style={styles.playerInfoBottom}>
                    <button 
                        onClick={handleSurrender}
                        disabled={!isMyTurn}
                        style={{
                            ...styles.surrenderBtn,
                            opacity: isMyTurn ? 1 : 0.5,
                            cursor: isMyTurn ? 'pointer' : 'not-allowed',
                            background: isMyTurn ? '#333' : '#9e9e9e'
                        }}
                    >
                        🏳️ Đầu Hàng
                    </button>

                    {/* ĐỒNG HỒ CỦA MÌNH: Nếu mình là P1 thì hiện giờ P1, và ngược lại */}
                    <div style={styles.timer}>
                        {formatTime(myTimeDisplay)}
                    </div>

                    <div style={{textAlign: 'right'}}>
                        <b>{user?.username}</b> <span>(ELO: {user?.elo})</span>
                    </div>
                    <img 
                        src={user?.avatar || `https://api.dicebear.com/9.x/adventurer/svg?seed=${user?.username}`} 
                        alt="MyAvatar" 
                        style={styles.avatarCircleSmall} 
                    />
                </div>
            </div>
        </div>
    );
};

// --- CSS STYLES (GỘP CẢ 2 PHẦN) ---
const styles = {
    container: {
        width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#e6b87c', position: 'relative', overflow: 'hidden'
    },
    // Style Sảnh
    boardArea: {
        textAlign: 'center', background: '#fff8e1', padding: '30px', borderRadius: '10px', border: '5px solid #5d4037', boxShadow: '10px 10px 0px #3e2723', width: '400px',
        maxHeight: '90vh', // Giới hạn chiều cao nếu màn hình bé
        overflowY: 'auto'
    },
    title: { color: '#3e2723', fontFamily: 'Courier New, monospace', marginBottom: '10px' },
    btn: {
        padding: '12px 20px', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '16px', transition: '0.3s', cursor: 'pointer', width: '100%'
    },
    // Style Overlay Ready
    overlay: {
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center'
    },
    overlayBox: {
        background: '#fff8e1', padding: '30px', borderRadius: '15px', border: '5px solid #5d4037', width: '400px', textAlign: 'center'
    },
    readyBtn: {
        width: '100%', padding: '15px', fontSize: '24px', fontWeight: 'bold', color: 'white', border: 'none', borderRadius: '10px', marginTop: '20px', cursor: 'pointer'
    },
    readyIndicator: { width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #333' },
    playerSection: { display: 'flex', alignItems: 'center', justifyContent: 'space-around', marginBottom: '20px' },
    
    // Style Bàn cờ
    gameArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' },
    board: {
        display: 'grid', gridTemplateColumns: `repeat(${BOARD_SIZE}, 30px)`, gap: '1px', background: '#000', border: '5px solid #5d4037', padding: '5px'
    },
    cell: { width: '30px', height: '30px', background: '#e6b87c', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },
    playerInfoTop: { display: 'flex', justifyContent: 'space-between', width: '470px', marginBottom: '10px', background: '#fff8e1', padding: '10px', borderRadius: '5px', border: '2px solid #5d4037' },
    playerInfoBottom: { display: 'flex', justifyContent: 'space-between', width: '470px', marginTop: '10px', background: '#fff8e1', padding: '10px', borderRadius: '5px', border: '2px solid #5d4037' },
    avatarCircle: { width: '80px', height: '80px', background: '#ccc', borderRadius: '50%' },
    avatarCircleSmall: { 
    width: '50px', 
    height: '50px', 
    borderRadius: '50%', 
    border: '2px solid #5d4037',
    backgroundColor: '#fff',
    objectFit: 'cover' // Để ảnh không méo
    },
    timer: { fontSize: '20px', fontFamily: 'monospace', fontWeight: 'bold', background: '#333', color: '#0f0', padding: '0 10px' },
    surrenderBtn: { background: '#333', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' },

    profileCard: {
        marginBottom: '30px',
        borderBottom: '2px dashed #5d4037',
        paddingBottom: '20px'
    },
    bigAvatar: {
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        border: '4px solid #5d4037',
        backgroundColor: '#fff',
        marginBottom: '10px',
        objectFit: 'cover' // Để ảnh không bị méo
    },
    profileName: {
        fontFamily: 'Courier New, monospace',
        color: '#3e2723',
        margin: '5px 0',
        fontSize: '28px',
        fontWeight: 'bold'
    },
    profileEmail: {
        color: '#795548',
        fontSize: '14px',
        margin: '0 0 15px 0',
        fontStyle: 'italic'
    },
    eloBadge: {
        display: 'inline-block',
        background: '#3e2723',
        color: '#ffecb3',
        padding: '5px 15px',
        borderRadius: '20px',
        fontWeight: 'bold',
        fontSize: '20px',
        marginBottom: '15px',
        border: '2px solid #ffecb3'
    },
    statsRow: {
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        fontSize: '18px',
        fontWeight: 'bold',
        fontFamily: 'monospace'
    },
    statItem: {
        background: '#fff',
        padding: '5px 10px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        minWidth: '60px'
    },
};

export default GamePage;