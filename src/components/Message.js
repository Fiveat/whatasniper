// src/components/Message.js
import React, { useState } from 'react';
import { FiInfo } from 'react-icons/fi';
import './Message.css';

function Message({ text }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="message-icon-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <FiInfo className="message-icon" />
      {visible && <div className="tooltip">{text}</div>}
    </span>
  );
}

export default Message;
