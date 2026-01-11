import React from 'react';

const LeaderboardModal = ({ isOpen, onClose, data }) => {
    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h2 style={styles.title}>🏆 BẢNG PHONG THẦN 🏆</h2>
                
                <div style={styles.tableContainer}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={{background: '#5d4037', color: '#ffecb3'}}>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>Đại Hiệp</th>
                                <th style={styles.th}>ELO</th>
                                <th style={styles.th}>W/L/D</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((user, index) => (
                                <tr key={index} style={{background: index % 2 === 0 ? '#fff8e1' : '#ffe0b2'}}>
                                    <td style={styles.td}>
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                    </td>
                                    <td style={{...styles.td, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <img src={user.avatar} style={{width: '30px', height: '30px', borderRadius: '50%'}} alt=""/>
                                        {user.username}
                                    </td>
                                    <td style={{...styles.td, fontWeight: 'bold'}}>{user.elo}</td>
                                    <td style={styles.td}>
                                        <span style={{color: 'green'}}>{user.wins}</span> / 
                                        <span style={{color: 'red'}}>{user.losses}</span> / 
                                        <span style={{color: 'orange'}}>{user.draws}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <button onClick={onClose} style={styles.closeBtn}>Đóng</button>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.7)', zIndex: 100,
        display: 'flex', justifyContent: 'center', alignItems: 'center'
    },
    modal: {
        background: '#fff3e0', padding: '20px', borderRadius: '15px',
        border: '5px solid #5d4037', width: '500px', textAlign: 'center'
    },
    title: { color: '#bf360c', fontFamily: 'Courier New, monospace', marginBottom: '20px' },
    tableContainer: { maxHeight: '300px', overflowY: 'auto', border: '2px solid #8d6e63' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { padding: '10px', position: 'sticky', top: 0 },
    td: { padding: '8px', borderBottom: '1px solid #d7ccc8' },
    closeBtn: {
        marginTop: '20px', padding: '10px 20px', background: '#5d4037', color: 'white',
        border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
    }
};

export default LeaderboardModal;