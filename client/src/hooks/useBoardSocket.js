import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { socketUrl } from '../api/client.js';

const boardEvents = [
  'board:updated',
  'board:deleted',
  'board:column-created',
  'board:column-updated',
  'board:column-deleted',
  'board:card-created',
  'board:card-moved',
  'board:card-updated',
  'board:card-deleted',
  'board:member-removed',
  'board:member-updated',
  'board:comment-created',
  'board:access-revoked',
  'notification:created'
];

export default function useBoardSocket({
  token,
  user,
  boardId,
  handlers,
  onUnauthorized,
  onJoinError
}) {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);
  const onUnauthorizedRef = useRef(onUnauthorized);
  const onJoinErrorRef = useRef(onJoinError);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState([]);

  useEffect(() => {
    handlersRef.current = handlers;
    onUnauthorizedRef.current = onUnauthorized;
    onJoinErrorRef.current = onJoinError;
  });

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      setPresenceUsers([]);
      return undefined;
    }

    const socket = io(socketUrl, { auth: { token } });
    socketRef.current = socket;

    const listeners = Object.fromEntries(
      boardEvents.map((eventName) => [
        eventName,
        (payload) => handlersRef.current?.[eventName]?.(payload)
      ])
    );

    function handleConnect() {
      setIsConnected(true);
    }

    function handleDisconnect() {
      setIsConnected(false);
      setPresenceUsers([]);
    }

    function handleConnectError(error) {
      setIsConnected(false);

      if (error.message === 'Unauthorized') {
        onUnauthorizedRef.current?.();
      }
    }

    function handlePresence(payload) {
      setPresenceUsers(payload.users || []);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('board:presence', handlePresence);
    boardEvents.forEach((eventName) => socket.on(eventName, listeners[eventName]));

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('board:presence', handlePresence);
      boardEvents.forEach((eventName) => socket.off(eventName, listeners[eventName]));
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!boardId || !user || !isConnected || !socket) {
      setPresenceUsers([]);
      return undefined;
    }

    socket.emit('board:join', { boardId }, (result) => {
      if (!result?.ok) {
        onJoinErrorRef.current?.(result?.message);
      }
    });

    return () => {
      if (socket.connected) {
        socket.emit('board:leave', boardId);
      }
      setPresenceUsers([]);
    };
  }, [boardId, user, isConnected]);

  return { isConnected, presenceUsers, setPresenceUsers };
}
