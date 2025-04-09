// src/components/Header.js
import React, { useEffect } from "react";
import whatalogo from "../assets/whatalogo.svg";
import gearIcon from "../assets/Gear.svg";
import powerIcon from "../assets/Power.svg";

// Importamos hooks de @buidlerlabs
import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import {
  KabilaConnector,
  HashpackConnector,
} from "@buidlerlabs/hashgraph-react-wallets/connectors";

import "./Header.css";

function Header({ onOpenModal, setParentAccountId }) {
  // 1) Obtenemos "isConnected" y "accountId" de Kabila
  const { isConnected: isConnectedKabila } = useWallet(KabilaConnector);
  const { data: accountIdKabila } = useAccountId({ connector: KabilaConnector });

  // 2) Obtenemos "isConnected" y "accountId" de Hashpack
  const { isConnected: isConnectedHashpack } = useWallet(HashpackConnector);
  const { data: accountIdHashpack } = useAccountId({ connector: HashpackConnector });

  // 3) Unificamos isConnected y accountId
  const isConnected = isConnectedKabila || isConnectedHashpack;
  const accountId = accountIdKabila || accountIdHashpack;

  // 4) Cada vez que cambie el estado de conexión o accountId, lo pasamos a App.js
  useEffect(() => {
    if (isConnected && accountId) {
      console.log("Wallet conectada con ID:", accountId);
      setParentAccountId(accountId);
    } else {
      setParentAccountId(null);
    }
  }, [isConnected, accountId, setParentAccountId]);

  return (
    <header className="header">
      <img className="logo" src={whatalogo} alt="Logo" />
      <div className="header-controls">
        <button className="header-btn" onClick={onOpenModal}>
          {isConnected && accountId ? accountId : "Connect"}
        </button>
        <button className="header-btn header-icon-btn">
          <img src={gearIcon} alt="Gear" className="icon" />
        </button>
        <button className="header-btn header-icon-btn">
          <img src={powerIcon} alt="On/Off" className="icon" />
        </button>
      </div>
    </header>
  );
}

export default Header;
