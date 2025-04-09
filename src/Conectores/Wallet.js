// src/Wallet.js
import React from 'react';
import { useWallet } from '@buidlerlabs/hashgraph-react-wallets';
import { HWCConnector } from '@buidlerlabs/hashgraph-react-wallets/connectors';

const Wallet = () => {
  const { isConnected, connect, disconnect } = useWallet(HWCConnector); // Usamos el conector HWCConnector

  return (
    <div>
      {isConnected ? (
        <button onClick={disconnect}>Desconectar Wallet</button> // Botón para desconectar si ya está conectada
      ) : (
        <button onClick={connect}>Conectar Wallet</button> // Botón para conectar si no está conectada
      )}
    </div>
  );
};

export default Wallet;
