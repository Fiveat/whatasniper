// src/components/Snips.js
import React, { useEffect, useState } from "react";
import "./Snips.css";

import { useWallet, useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import {
  KabilaConnector,
  HashpackConnector,
} from "@buidlerlabs/hashgraph-react-wallets/connectors";

import { supabase } from "../config/supabaseClient";

/* ===== Icons ===== */
import { CheckCircle, XCircle, Hourglass } from "lucide-react";

const ITEMS_PER_PAGE = 7;
const MAX_ROWS = 100;
const sentxApiKey = process.env.REACT_APP_SENTX_KEY;

/* -----------------------------------------------------------
 * Consulta rápida a Mirror Node para name / symbol
 * ---------------------------------------------------------*/
async function fetchTokenInfo(tokenId) {
  try {
    const res = await fetch(
      `https://mainnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { name: data.name, symbol: data.symbol };
  } catch (err) {
    console.error(`TokenInfo ${tokenId}:`, err.message);
    return { name: null, symbol: null };
  }
}

/* -----------------------------------------------------------
 * Consulta SentX para floor price
 * ---------------------------------------------------------*/
async function fetchFloor(tokenId) {
  if (!sentxApiKey) return null;
  try {
    const url = `https://api.sentx.io/v1/public/market/floor?apikey=${sentxApiKey}&token=${tokenId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data?.success ? data.floor : null;
  } catch (err) {
    console.error(`Floor ${tokenId}:`, err.message);
    return null;
  }
}

/* -------- Helper formato fecha -------- */
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => `${n}`.padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function Snips() {
  /* -------- Wallet -------- */
  const { isConnected: kc } = useWallet(KabilaConnector);
  const { isConnected: hc } = useWallet(HashpackConnector);
  const { data: accountIdKabila } = useAccountId({ connector: KabilaConnector });
  const { data: accountIdHashpack } = useAccountId({
    connector: HashpackConnector,
  });

  const accountId = accountIdKabila || accountIdHashpack;
  const isConnected = kc || hc;

  /* -------- Estados -------- */
  const [snips, setSnips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [filter, setFilter] = useState("Pending");
  const [tokenInfoMap, setTokenInfoMap] = useState({}); // id -> {name,symbol}
  const [floorMap, setFloorMap] = useState({}); // id -> floor

  /* -------- Cargar snips -------- */
  useEffect(() => {
    async function loadSnips() {
      if (!isConnected || !accountId) {
        setSnips([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setErrMsg("");
      setCurrentPage(0);

      try {
        const { data, error } = await supabase
          .from("snips")
          .select("id, token_id, max_price, estado, fecha_cierre")
          .eq("wallet_id", accountId)
          .limit(MAX_ROWS);

        if (error) throw error;

        setSnips(
          data.map((r) => ({
            id: r.id,
            tokenID: r.token_id,
            hbar: r.max_price,
            estado: r.estado, // 0=pending | 1=completed | 98=error | 4=cancelled
            fecha_cierre: r.fecha_cierre,
          }))
        );
      } catch (err) {
        console.error(err);
        setErrMsg(
          err?.message
            ? `Error loading your snips: ${err.message}`
            : "Error loading your snips."
        );
      } finally {
        setLoading(false);
      }
    }
    loadSnips();
  }, [isConnected, accountId]);

  /* -------- Obtener name / symbol -------- */
  useEffect(() => {
    const missing = [...new Set(snips.map((s) => s.tokenID))].filter(
      (id) => !tokenInfoMap[id]
    );
    if (!missing.length) return;

    (async () => {
      const entries = await Promise.all(
        missing.map(async (id) => [id, await fetchTokenInfo(id)])
      );
      setTokenInfoMap((prev) =>
        entries.reduce((acc, [id, info]) => ({ ...acc, [id]: info }), prev)
      );
    })();
  }, [snips, tokenInfoMap]);

  /* -------- Obtener floor price una sola vez -------- */
  useEffect(() => {
    if (!sentxApiKey) return;
    const missing = [...new Set(snips.map((s) => s.tokenID))].filter(
      (id) => floorMap[id] === undefined
    );
    if (!missing.length) return;

    (async () => {
      const entries = await Promise.all(
        missing.map(async (id) => [id, await fetchFloor(id)])
      );
      setFloorMap((prev) =>
        entries.reduce((acc, [id, price]) => ({ ...acc, [id]: price }), prev)
      );
    })();
  }, [snips, floorMap]);

  /* -------- Cancelar -------- */
  const handleCancel = async (snip) => {
    if (
      !window.confirm(
        `Cancel order #${snip.id}? This will mark it as cancelled.`
      )
    )
      return;
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("snips")
        .update({ estado: 4, fecha_cierre: nowIso })
        .eq("id", snip.id);
      if (error) throw error;
      setSnips((prev) =>
        prev.map((s) =>
          s.id === snip.id ? { ...s, estado: 4, fecha_cierre: nowIso } : s
        )
      );
    } catch (err) {
      console.error(err);
      alert("Error cancelling the order.");
    }
  };

  /* ------------- Ordenar / filtrar / paginar ------------- */
  const estadoPriority = (st) => (st === 0 ? 0 : st === 1 ? 1 : 2);
  const ordered = [...snips].sort((a, b) => {
    const p = estadoPriority(a.estado) - estadoPriority(b.estado);
    return p !== 0 ? p : b.id - a.id; // prioridad, luego id DESC
  });

  const filtered = ordered.filter((s) => {
    if (filter === "Pending") return s.estado === 0;
    if (filter === "Completed") return s.estado === 1;
    if (filter === "Cancelled") return s.estado === 4;
    return true;
  });

  /* ---- Completed ahora DESC para que pág 1 sea más nuevo ---- */
  const filteredSorted =
    filter === "Completed" ? filtered : filtered; // ya en id DESC

  const totalPages = Math.ceil(filteredSorted.length / ITEMS_PER_PAGE);
  const pageSnips = filteredSorted.slice(
    currentPage * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE + ITEMS_PER_PAGE
  );
  useEffect(() => setCurrentPage(0), [filter]);

  /* -------- Auxiliar -------- */
  const shortWallet = accountId
    ? `${accountId.slice(0, 6)}…${accountId.slice(-4)}`
    : "—";

  /* -------- Render -------- */
  return (
    <div className="my-snips-container">
      <div className="my-snips-header">
        <h2>My Snips</h2>
        <div className="active-label">{shortWallet}</div>
      </div>

      {/* Selector filtro */}
      <div className="filter-row">
        <select
          className="filter-select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>Pending</option>
          <option>Completed</option>
          <option>Cancelled</option>
        </select>
      </div>

      {loading && <div className="snips-msg">Loading…</div>}
      {!loading && errMsg && (
        <div className="snips-msg error-text">{errMsg}</div>
      )}
      {!loading && !errMsg && filtered.length === 0 && (
        <div className="snips-msg">No snips found for this filter.</div>
      )}

      <div className="snips-list">
        {pageSnips.map((snip) => {
          const info = tokenInfoMap[snip.tokenID] || {};
          const floor = floorMap[snip.tokenID];
          return (
            <div
              key={snip.id}
              className={`snip-item ${
                snip.estado === 1
                  ? "completed"
                  : snip.estado === 98
                  ? "error"
                  : snip.estado === 4
                  ? "cancelled"
                  : "pending"
              }`}
            >
              {/* Header */}
              <div className="snip-header">
                <div className="token-wrapper">
                  <span className="token-name" title={info.symbol || ""}>
                    {info.name || snip.tokenID}
                  </span>
                  <span className="token-id">({snip.tokenID})</span>
                </div>
              </div>

              {/* Footer */}
              <div className="snip-footer">
                {snip.estado === 0 ? (
                  <>
                    <span className="snip-amount">
                      shot on: {snip.hbar} HBAR
                    </span>
                    <span className="snip-floor">
                      floor{" "}
                      {floor !== null && floor !== undefined ? floor : "..."}{" "}
                      HBAR
                    </span>
                  </>
                ) : (
                  <span className="snip-amount">
                    price: {snip.hbar} HBAR
                  </span>
                )}

                {snip.estado === 1 && (
                  <>
                    <CheckCircle size={18} className="icon-check" />
                    &nbsp;&nbsp;&nbsp;
                    <Hourglass
                      size={12}
                      className="icon-hourglass"
                      onClick={() =>
                        alert(
                          snip.fecha_cierre
                            ? formatDate(snip.fecha_cierre)
                            : "Date not available"
                        )
                      }
                      style={{ cursor: "pointer" }}
                    />
                  </>
                )}
                {snip.estado === 98 && (
                  <span className="snip-status status-error">wallet error</span>
                )}
                {snip.estado === 4 && (
                  <span className="snip-status status-cancelled">cancelled</span>
                )}
              </div>

              {/* Cancel button debajo */}
              {snip.estado === 0 && (
                <div className="cancel-row">
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancel(snip)}
                    title="Cancel order"
                  >
                    <XCircle size={18} className="icon-cancel" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
            className="page-arrow"
          >
            ←
          </button>
          <span className="page-indicator">
            {currentPage + 1}/{totalPages}
          </span>
          <button
            disabled={currentPage === totalPages - 1}
            onClick={() =>
              setCurrentPage((p) => Math.min(p + 1, totalPages - 1))
            }
            className="page-arrow"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

export default Snips;
