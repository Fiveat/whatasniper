// src/modal.js
import React, { useEffect } from "react";
import { useWallet } from "@buidlerlabs/hashgraph-react-wallets";
import {
  KabilaConnector,
  HashpackConnector,
} from "@buidlerlabs/hashgraph-react-wallets/connectors";

import kabilaLogo from "./assets/kabilaLogo.png";
import hashpackLogo from "./assets/hashpackLogo.png";
import "./modal.css";

// Importamos nuestro cliente de supabase
import { supabase } from "./config/supabaseClient";

function Modal({ isOpen, onClose }) {
  // 1) Obtenemos las instancias de wallet
  const kabilaWallet = useWallet(KabilaConnector);
  const hashpackWallet = useWallet(HashpackConnector);

  // 2) Decidimos "conectado" si cualquiera de los dos lo está
  const isConnected = kabilaWallet.isConnected || hashpackWallet.isConnected;

  // 3) Obtenemos el accountId de la wallet conectada (el primero que aparezca)
  const accountId = kabilaWallet.accountId || hashpackWallet.accountId;

  // Función para registrar o actualizar al usuario en Supabase
  const upsertUserInSupabase = async (walletId) => {
    try {
      // Verificamos si existe un registro previo
      const { data: existing, error: selectError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("wallet_id", walletId);

      if (selectError) {
        console.error("Error al buscar usuario:", selectError);
        return;
      }

      if (!existing || existing.length === 0) {
        // Si no existe, creamos un nuevo usuario
        const { data: insertedUser, error: insertError } = await supabase
          .from("usuarios")
          .insert([
            {
              wallet_id: walletId,
              usos: 0,
              usos_totales: 0,
              booster: 0,
            },
          ]);

        if (insertError) {
          console.error("Error al insertar usuario:", insertError);
        } else {
          console.log("Usuario creado en Supabase:", insertedUser);
        }
      } else {
        // Si ya existía, puedes decidir si actualizas algo
        console.log("El usuario ya existe en la base de datos.");
      }
    } catch (error) {
      console.error("Error en upsertUserInSupabase:", error);
    }
  };

  // 4) Efecto para “registrar” al usuario en cuanto tengamos conexión y accountId
  useEffect(() => {
    if (isConnected && accountId) {
      console.log("Modal: Wallet conectada con ID:", accountId);
      upsertUserInSupabase(accountId);
    }
  }, [isConnected, accountId]);

  // 5) No renderizamos nada si el modal está cerrado
  if (!isOpen) return null;

  // Función de desconexión
  const handleDisconnect = () => {
    if (kabilaWallet.isConnected) kabilaWallet.disconnect();
    if (hashpackWallet.isConnected) hashpackWallet.disconnect();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h3>Connect your Wallet</h3>

        <div className="modal-buttons">
          {isConnected ? (
            <button onClick={handleDisconnect}>Desconectar Wallet</button>
          ) : (
            <>
              <button
                onClick={() => {
                  kabilaWallet
                    .connect()
                    .then(() => {
                      console.log("Conexión exitosa con Kabila");
                    })
                    .catch((error) => {
                      console.error("Error al conectar con Kabila:", error);
                    });
                  onClose();
                }}
              >
                <img
                  src={kabilaLogo}
                  alt="Kabila Logo"
                  style={{ width: "50px", height: "50px", marginRight: "8px" }}
                />
                Connect Kabila
              </button>

              <button
                onClick={() => {
                  hashpackWallet
                    .connect()
                    .then(() => {
                      console.log("Conexión exitosa con Hashpack");
                    })
                    .catch((error) => {
                      console.error("Error al conectar con Hashpack:", error);
                    });
                  onClose();
                }}
              >
                <img
                  src={hashpackLogo}
                  alt="Hashpack Logo"
                  style={{ width: "50px", height: "50px", marginRight: "8px" }}
                />
                Connect Hashpack
              </button>
            </>
          )}
        </div>

        <button className="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default Modal;
