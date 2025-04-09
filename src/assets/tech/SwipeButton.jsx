// SwipeButton.jsx
import React, { useRef, useState, useEffect } from "react";
import "./SwipeButton.css";

function SwipeButton({ text, onSwipe }) {
  const [isSwiped, setIsSwiped] = useState(false);
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging || !containerRef.current || !handleRef.current) return;

      e.preventDefault();
      const containerRect = containerRef.current.getBoundingClientRect();
      const handleWidth = handleRef.current.offsetWidth;

      // Calculamos la posición horizontal relativa al contenedor
      let newLeft = e.clientX - containerRect.left - handleWidth / 2;

      // Limites para que no se salga
      if (newLeft < 0) newLeft = 0;
      if (newLeft > containerRect.width - handleWidth) {
        newLeft = containerRect.width - handleWidth;
      }

      // Movemos el handle
      handleRef.current.style.left = `${newLeft}px`;
    };

    const handleMouseUp = () => {
      if (!dragging || !containerRef.current || !handleRef.current) return;
      setDragging(false);

      // Verificamos si llegó al final (umbral)
      const containerRect = containerRef.current.getBoundingClientRect();
      const handleRect = handleRef.current.getBoundingClientRect();
      const threshold = containerRect.width - handleRect.width - 10;

      if (handleRect.left - containerRect.left >= threshold) {
        // Se considera "swipe" completo
        setIsSwiped(true);
        onSwipe(); // Llamamos la acción principal (handleCreate)
      } else {
        // Si no llegó al final, volvemos el handle a la posición inicial
        handleRef.current.style.left = "0px";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, onSwipe]);

  // Iniciamos el arrastre
  const handleMouseDown = (e) => {
    if (isSwiped) return; // Si ya se ha deslizado, no permitimos volver a arrastrar
    setDragging(true);
  };

  return (
    <div className="swipe-button-container" ref={containerRef}>
      <div className="swipe-button-track">
        <span className="swipe-button-text">
          {isSwiped ? "¡CREADO!" : text}
        </span>
      </div>
      <div
        className="swipe-button-handle"
        ref={handleRef}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

export default SwipeButton;
