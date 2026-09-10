import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

function App() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [author, setAuthor] = useState('مستخدم تجريبي');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const socket = io(socketUrl);
    socketRef.current = socket;

    function handleConnect() {
      setIsConnected(true);
    }

    function handleDisconnect() {
      setIsConnected(false);
    }

    function handleMessage(message) {
      setMessages((currentMessages) => [message, ...currentMessages]);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('demo:message', handleMessage);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('demo:message', handleMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    if (!socketRef.current) {
      return;
    }

    socketRef.current.emit('demo:message', {
      author: author.trim() || 'Anonymous',
      text: trimmedText
    });

    setText('');
  }

  return (
    <main className="app-shell">
      <section className="intro">
        <div className="mark">
          RT
        </div>
        <div>
          <p className="eyebrow">Real-Time Collaboration Tool</p>
          <h1>تجربة التحديث الفوري</h1>
          <p className="lede">
            افتح الصفحة في نافذتين، واكتب رسالة هنا. ستظهر الرسالة فوراً في
            النافذتين عبر Socket.io.
          </p>
        </div>
      </section>

      <section className="status-grid" aria-label="Project setup status">
        <article>
          <span className="status-icon" aria-hidden="true">OK</span>
          <div>
            <h2>React جاهز</h2>
            <p>واجهة أولية تعمل عبر Vite.</p>
          </div>
        </article>
        <article>
          <span className="status-icon" aria-hidden="true">API</span>
          <div>
            <h2>Express جاهز</h2>
            <p>API أولي على المسار /api/health.</p>
          </div>
        </article>
        <article>
          <span className="status-icon" aria-hidden="true">{isConnected ? 'ON' : 'OFF'}</span>
          <div>
            <h2>{isConnected ? 'Socket متصل' : 'Socket غير متصل'}</h2>
            <p>{isConnected ? 'التحديثات الفورية تعمل.' : 'تأكد من تشغيل السيرفر.'}</p>
          </div>
        </article>
      </section>

      <section className="demo-panel" aria-label="Real-time message demo">
        <form onSubmit={handleSubmit} className="message-form">
          <label>
            الاسم
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="اكتب اسمك"
            />
          </label>
          <label>
            الرسالة
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="اكتب رسالة تجريبية"
            />
          </label>
          <button type="submit" disabled={!isConnected}>
            إرسال
          </button>
        </form>

        <div className="messages">
          {messages.length === 0 ? (
            <p className="empty-state">لا توجد رسائل بعد.</p>
          ) : (
            messages.map((message) => (
              <article key={message.id} className="message">
                <strong>{message.author}</strong>
                <p>{message.text}</p>
                <time dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleTimeString('ar')}
                </time>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
