import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://project1-ogf1.onrender.com';

// Hàm lấy token từ kho (để Backend biết ai đang gọi)
const getAuthHeader = () => {
    const token = localStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
};

// Gọi API đổi trạng thái
export const setPlayerStatus = async (status) => {
    // status là 'MATCHING' hoặc 'IDLE'
    try {
        const response = await axios.post(
            `${API_URL}/api/game/status`, 
            null, 
            { 
                params: { status },
                ...getAuthHeader()
            }
        );
        return response.data;
    } catch (error) {
        console.error(error);
    }
};

export const getLeaderboard = async () => {
    try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/api/game/leaderboard`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(error);
        return [];
    }
};