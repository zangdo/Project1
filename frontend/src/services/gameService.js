import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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