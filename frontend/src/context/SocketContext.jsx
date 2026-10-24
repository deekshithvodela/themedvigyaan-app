import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children, user, backendUrl }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user || !backendUrl) {
      if (socket) {
        try {
          socket.disconnect();
        } catch (e) {}
        setSocket(null);
      }
      return;
    }

    const newSocket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    });

    newSocket.on('connect', () => {
      newSocket.emit('join_room', { user_id: user.id });
    });

    setSocket(newSocket);

    return () => {
      try {
        if (newSocket) {
          if (newSocket.connected) {
            newSocket.disconnect();
          } else {
            newSocket.on('connect', () => {
              try { newSocket.disconnect(); } catch (e) {}
            });
            setTimeout(() => {
              try { newSocket.disconnect(); } catch (e) {}
            }, 1000);
          }
        }
      } catch (e) {}
    };
  }, [user?.id, backendUrl]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
