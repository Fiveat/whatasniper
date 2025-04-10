//src/components/SniperCard.js
import React, { useState, useEffect } from "react";
import "./SniperCard.css";
import tokensData from "../assets/tech/tokenIDs.json";
import SwipeButton from "../assets/tech/SwipeButton";
import { supabase } from "../config/supabaseClient";

// Importamos hooks de @buidlerlabs y conectores
import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import {
  KabilaConnector,
  HashpackConnector,
} from "@buidlerlabs/hashgraph-react-wallets/connectors";

// SDK de Hedera
import {
  AccountAllowanceApproveTransaction,
  AccountId,
  Hbar,
  AccountInfoQuery,
  TokenAssociateTransaction,
} from "@hashgraph/sdk";

// Leemos la API Key de SentX desde .env
const sentxApiKey = process.env.REACT_APP_SENTX_KEY;

function SniperCard({ handleCreate: externalHandleCreate, boosterUsed }) {
  /*************************************************************
   * 1) ESTADOS Y HOOKS PRINCIPALES
   *************************************************************/
  // Modo por defecto: "asociado"
  const [tokenMode, setTokenMode] = useState("asociado");
  const [tokenManual, setTokenManual] = useState("");
  const [tokenSelect, setTokenSelect] = useState("");
  const [sniperType, setSniperType] = useState("FIXED PRICE");
  const [hbar, setHbar] = useState("");

  // Para resetear el slider (o botón) tras cada inserción
  const [sliderKey, setSliderKey] = useState(0);

  // Mensaje sobre allowance
  const [allowanceMessage, setAllowanceMessage] = useState("");

  // Para mostrar el floor price del token (SentX)
  const [floorPrice, setFloorPrice] = useState(null);

  // Detección de dispositivo móvil: si el ancho de pantalla es menor a 768px
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // tokensData es un objeto con { "Kabila": "0.0.123...", ... }
  const { tokens } = tokensData;
  const tokenEntries = Object.entries(tokens);

  /*************************************************************
   * 2) DETECCIÓN DE WALLET (Kabila o Hashpack)
   * Se hace de forma similar a Header.js
   *************************************************************/
  // Para Kabila
  const { isConnected: isConnectedKabila, signer: signerKabila } =
    useWallet(KabilaConnector);
  const { data: accountIdKabila } = useAccountId({
    connector: KabilaConnector,
  });
  // Para Hashpack
  const { isConnected: isConnectedHashpack, signer: signerHashpack } =
    useWallet(HashpackConnector);
  const { data: accountIdHashpack } = useAccountId({
    connector: HashpackConnector,
  });

  const isConnected = isConnectedKabila || isConnectedHashpack;
  const accountId = accountIdKabila || accountIdHashpack;
  const connectedSigner = isConnectedKabila
    ? signerKabila
    : isConnectedHashpack
    ? signerHashpack
    : null;

  console.log("SniperCard => isConnected:", isConnected);
  console.log("SniperCard => accountId (Kabila):", accountIdKabila);
  console.log("SniperCard => accountId (Hashpack):", accountIdHashpack);
  console.log("SniperCard => final accountId:", accountId);
  console.log("SniperCard => signer:", connectedSigner);

  /*************************************************************
   * Función para resetear el formulario y el botón
   *************************************************************/
  const resetForm = () => {
    setTokenManual("");
    setTokenSelect("");
    setHbar("");
    setSliderKey((prev) => prev + 1);
  };

  /*************************************************************
   * NUEVO CÓDIGO: función que verifica si la cuenta ya está asociada
   * con un token, y en caso negativo firma la asociación.
   *************************************************************/
  const checkAndAssociateTokenIfNeeded = async (token_id) => {
    try {
      if (!connectedSigner || !accountId) {
        setAllowanceMessage("No se ha podido verificar la asociación.");
        return false;
      }

      // 1) Obtenemos la info de la cuenta, incluyendo tokenRelationships
      const accountInfo = await new AccountInfoQuery()
        .setAccountId(AccountId.fromString(accountId))
        .executeWithSigner(connectedSigner);

      // 'tokenRelationships' es un Map, por lo que iteramos sus pares [tid, relationship]
      let isAlreadyAssociated = false;
      for (const [tid] of accountInfo.tokenRelationships) {
        if (tid.toString() === token_id) {
          isAlreadyAssociated = true;
          break;
        }
      }

      if (isAlreadyAssociated) {
        console.log(
          `La cuenta ${accountId} ya está asociada al token ${token_id}`
        );
        return true; // no hace falta asociar de nuevo
      }

      // 2) Como no está asociado, procedemos a asociar
      setAllowanceMessage("Asociando token, por favor firma la transacción...");

      const associateTx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(accountId))
        .setTokenIds([token_id])
        .setMaxTransactionFee(new Hbar(2))
        .setTransactionMemo("Asociando token a la cuenta");

      const populatedTx = await connectedSigner.populateTransaction(associateTx);
      const signedTx = await connectedSigner.signTransaction(populatedTx);
      const response = await signedTx.executeWithSigner(connectedSigner);
      const receipt = await response.getReceiptWithSigner(connectedSigner);

      if (receipt && receipt.status.toString() === "SUCCESS") {
        setAllowanceMessage(`Token ${token_id} asociado correctamente.`);
        return true;
      } else {
        throw new Error("La transacción de asociación no fue confirmada.");
      }
    } catch (error) {
      console.error("Error al asociar token:", error);
      setAllowanceMessage("Error al asociar token: " + error.message);
      return false;
    }
  };

  /*************************************************************
   * 3) CREACIÓN EN SUPABASE + ALLOWANCE
   * AÑADIMOS RETORNO BOOLEANO EN handleSetAllowance
   *************************************************************/
  const handleSetAllowance = async (overrideAllowance) => {
    console.log("handleSetAllowance iniciado");
    if (!isConnected || !accountId || !connectedSigner) {
      setAllowanceMessage("No se ha podido obtener el signer de la wallet.");
      return false;
    }

    let parsedAllowance = parseFloat(hbar);
    if (overrideAllowance !== undefined) {
      parsedAllowance = parseFloat(overrideAllowance);
    }

    if (isNaN(parsedAllowance) || parsedAllowance <= 0) {
      setAllowanceMessage("La cantidad HBAR no es válida para allowance.");
      return false;
    }

    try {
      setAllowanceMessage("Solicitando allowance...");

      const spenderAccountId = "0.0.4351034";

      const allowanceTx = new AccountAllowanceApproveTransaction()
        .approveHbarAllowance(
          AccountId.fromString(accountId),
          AccountId.fromString(spenderAccountId),
          new Hbar(parsedAllowance)
        )
        .setMaxTransactionFee(new Hbar(2))
        .setTransactionMemo("Allowance WhataSniper");

      const populatedTx = await connectedSigner.populateTransaction(allowanceTx);
      const signedTx = await connectedSigner.signTransaction(populatedTx);
      const response = await signedTx.executeWithSigner(connectedSigner);
      const receipt = await response.getReceiptWithSigner(connectedSigner);

      if (receipt && receipt.status.toString() === "SUCCESS") {
        setAllowanceMessage(`Allowance de ${parsedAllowance} HBAR confirmada.`);
        return true;
      } else {
        throw new Error("La transacción de allowance no fue confirmada.");
      }
    } catch (error) {
      console.error("Error al establecer allowance:", error);
      setAllowanceMessage(
        "Error en la transacción de allowance: " + error.message
      );
      return false;
    }
  };

  const handleCreate = async () => {
    console.log("handleCreate iniciado");
    const token_id = tokenMode === "manual" ? tokenManual : tokenSelect;

    if (!isConnected || !accountId) {
      alert("Tu wallet no está conectada.");
      resetForm();
      return;
    }
    if (!token_id || !sniperType || !hbar) {
      alert("Por favor completa todos los campos.");
      resetForm();
      return;
    }

    try {
      /*************************************************************
       * 0) Antes de nada, verificamos la asociación del token:
       *    Si no está asociado, pedimos que se firme la transacción.
       *************************************************************/
      const associationSuccess = await checkAndAssociateTokenIfNeeded(token_id);
      if (!associationSuccess) {
        // Si no se asoció, se cancela.
        setAllowanceMessage("Orden cancelada");
        resetForm();
        return;
      }

      /*************************************************************
       * 1. Revisamos si existen órdenes pendientes (estado=0) de este wallet.
       * 2. Sumamos sus max_price para calcular el allowance acumulativo
       *    (incluyendo la nueva orden que se pretende crear).
       *************************************************************/
      let totalAllowance = parseFloat(hbar);
      try {
        const { data: existingOrders, error: existingError } = await supabase
          .from("snips")
          .select("max_price")
          .eq("wallet_id", accountId)
          .eq("estado", 0);

        if (existingError) {
          console.error("Error al obtener órdenes existentes:", existingError);
        } else if (existingOrders && existingOrders.length > 0) {
          const sumOfPending = existingOrders.reduce(
            (acc, order) => acc + parseFloat(order.max_price || 0),
            0
          );
          // Sumamos el hbar nuevo
          totalAllowance = sumOfPending + parseFloat(hbar);
        }
      } catch (errorFetch) {
        console.error("Error al intentar sumar pendientes:", errorFetch);
      }

      // 2) Pedimos allowance por el total (anterior + nuevo)
      const allowanceSuccess = await handleSetAllowance(totalAllowance);
      if (!allowanceSuccess) {
        // Si no se firma o hay error, marcamos "Orden cancelada"
        setAllowanceMessage("Orden cancelada");
        resetForm();
        return;
      }

      /*************************************************************
       * 3) SOLO si la allowance fue firmada, insertamos en Supabase
       *************************************************************/
      const { error } = await supabase.from("snips").insert([
        {
          wallet_id: accountId,
          token_id,
          type: sniperType,
          max_price: hbar,
          estado: 0,
          boost: boosterUsed,
        },
      ]);

      if (error) {
        console.error("Error al insertar en Supabase:", error);
        alert("Ocurrió un error al registrar la operación.");
        return;
      }

      alert("Registro en Supabase exitoso.");
      setAllowanceMessage("");
    } catch (err) {
      console.error("Error en handleCreate:", err);
      alert("No se pudo completar el registro en Supabase.");
    } finally {
      resetForm();
    }
  };

  /*************************************************************
   * 4) OBTENER el floor price del token (SentX)
   *************************************************************/
  const currentToken = tokenMode === "manual" ? tokenManual : tokenSelect;

  useEffect(() => {
    if (!currentToken) {
      setFloorPrice(null);
      return;
    }
    if (!sentxApiKey) {
      console.warn(
        "REACT_APP_SENTX_KEY no definida. No se puede obtener el floor price."
      );
      setFloorPrice(null);
      return;
    }

    const fetchFloorPrice = async () => {
      try {
        const url = `https://api.sentx.io/v1/public/market/floor?apikey=${sentxApiKey}&token=${currentToken}`;
        console.log("SentX GET Floor URL:", url);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        const data = await response.json();
        if (data && data.success && data.floor !== undefined) {
          setFloorPrice(data.floor);
        } else {
          setFloorPrice("(no hay floor disponible)");
        }
      } catch (error) {
        console.error("Error al obtener floor price:", error);
        setFloorPrice("(error al obtener floor)");
      }
    };

    fetchFloorPrice();
  }, [currentToken]);

  /*************************************************************
   * 5) RENDER del componente
   *************************************************************/
  return (
    <div className="sniper-card">
      <h2 className="sniper-title">SNIPER</h2>

      {allowanceMessage && (
        <div
          style={{ marginBottom: "1rem", textAlign: "center", color: "#0bf" }}
        >
          {allowanceMessage}
        </div>
      )}

      <form className="sniper-form" onSubmit={(e) => e.preventDefault()}>
        {/* TOKEN ID */}
        <div className="field-group">
          <label className="field-label" htmlFor="tokenID">
            TOKEN ID
          </label>
          <div className="token-mode-container">
            <div className="token-mode-selector">
              <label>
                <input
                  type="radio"
                  name="tokenMode"
                  value="manual"
                  checked={tokenMode === "manual"}
                  onChange={() => setTokenMode("manual")}
                />
                Manual
              </label>
              <label>
                <input
                  type="radio"
                  name="tokenMode"
                  value="asociado"
                  checked={tokenMode === "asociado"}
                  onChange={() => setTokenMode("asociado")}
                />
                Asociado
              </label>
            </div>
          </div>
          {tokenMode === "manual" ? (
            <input
              id="tokenID"
              className="field-input"
              type="text"
              placeholder="Introduce el Token ID manualmente"
              value={tokenManual}
              onChange={(e) => setTokenManual(e.target.value)}
            />
          ) : (
            <select
              id="tokenID"
              className="select-input"
              value={tokenSelect}
              onChange={(e) => setTokenSelect(e.target.value)}
            >
              <option value="">Selecciona un Token</option>
              {tokenEntries.map(([nombre, id], idx) => (
                <option key={idx} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Floor Price sobre SNIPER TYPE */}
        {currentToken && (
          <div style={{ marginBottom: "1rem", textAlign: "center" }}>
            <strong style={{ color: "#20e0b1" }}>Floor price:</strong>{" "}
            <span style={{ color: "#fff" }}>
              {floorPrice !== null ? `${floorPrice} $HBAR` : "Cargando..."}
            </span>
          </div>
        )}

        {/* SNIPER TYPE */}
        <div className="field-group">
          <label className="field-label" htmlFor="sniperType">
            SNIPER TYPE
          </label>
          <select
            id="sniperType"
            className="select-input"
            value={sniperType}
            onChange={(e) => setSniperType(e.target.value)}
          >
            <option value="FIXED PRICE">FIXED PRICE</option>
          </select>
        </div>

        {/* HBAR TO PAY */}
        <div className="field-group">
          <label className="field-label" htmlFor="hbar">
            HBAR TO PAY
          </label>
          <input
            id="hbar"
            className="field-input"
            type="text"
            placeholder="Cantidad de HBAR"
            value={hbar}
            onChange={(e) => setHbar(e.target.value)}
          />
        </div>

        {/* Botón: si es móvil se muestra un botón de pulsación normal, sino el deslizador */}
        {isMobile ? (
          <button
            type="button"
            className="create-button"
            onClick={handleCreate}
            style={{
              width: "100%",
              padding: "1rem",
              fontSize: "16px",
              textAlign: "center",
              textTransform: "uppercase",
              fontWeight: "bold",
            }}
          >
            Crear Orden
          </button>
        ) : (
          <SwipeButton
            key={sliderKey}
            text="Desliza para crear"
            onSwipe={handleCreate}
          />
        )}
      </form>
    </div>
  );
}

export default SniperCard;
