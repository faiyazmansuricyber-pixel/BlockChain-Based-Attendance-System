/**
 * ActiveSessionQR.jsx
 *
 * Rotating 20-second QR code using an in-memory ephemeral wallet.
 * Every 20 s the component re-signs (sessionId, windowIndex) with the
 * ephemeral key and re-renders the QR payload — NO MetaMask popup.
 *
 * The teacher passes { ephemeralWallet } inside the `session` prop when
 * starting a new live session from TeacherDashboard.
 *
 * QR payload schema:
 *   { sessionId, windowIndex, signature }
 * Where signature is the 65-byte hex ECDSA sig of:
 *   keccak256(abi.encodePacked(sessionId, windowIndex))
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ethers } from 'ethers';
import { formatTimeLeft } from '../../utils/helpers';
import { useWeb3 } from '../../context/Web3Context';
import { QrCode, Clock, Users, Copy, Check, StopCircle, Sparkles, RotateCw, KeyRound, AlertTriangle } from 'lucide-react';

const QR_WINDOW_SECONDS = 20;

export const ActiveSessionQR = ({ session, subject, onEndSession }) => {
  const { provider, addToast } = useWeb3();
  const fallbackWalletRef = useRef(null);

  // ── Block-anchored countdown ─────────────────────────────────────────────
  const [timeLeft, setTimeLeft]         = useState(0);
  const blockOffsetRef                  = useRef(0);       // blockTs - Date.now()/1000
  const blockOffsetReady                = useRef(false);

  // ── Rotating QR state ─────────────────────────────────────────────────────
  const [windowIndex, setWindowIndex]   = useState(0);
  const [qrPayload, setQrPayload]       = useState(null);
  const [windowSecsLeft, setWsLeft]     = useState(QR_WINDOW_SECONDS);
  const [copied, setCopied]             = useState(false);
  const [signError, setSignError]       = useState(null);
  const inProgressRef                   = useRef(false);
  const lastSignedWindowRef             = useRef(null);

  // ── Fetch block timestamp offset once, then tick locally ─────────────────
  useEffect(() => {
    if (!session || !provider) return;
    let cancelled = false;

    const fetchOffset = async () => {
      try {
        const blk = await provider.getBlock('latest');
        if (!cancelled && blk) {
          blockOffsetRef.current  = blk.timestamp - Math.floor(Date.now() / 1000);
          blockOffsetReady.current = true;
        }
      } catch (err) {
        console.warn('Failed to fetch block timestamp offset:', err);
      }
    };

    fetchOffset();
    // Refresh offset every 30 s to stay calibrated
    const offsetTimer = setInterval(fetchOffset, 30_000);
    return () => { cancelled = true; clearInterval(offsetTimer); };
  }, [session?.sessionId, provider]);

  // ── Local tick (uses offset) ──────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const nowBlock = Math.floor(Date.now() / 1000) + blockOffsetRef.current;
      const remaining = Number(session.expiryTime) - nowBlock;
      setTimeLeft(remaining > 0 ? remaining : 0);

      const elapsed  = nowBlock - Number(session.startTime);
      const winIdx   = Math.max(0, Math.floor(elapsed / QR_WINDOW_SECONDS));
      const winSecs  = QR_WINDOW_SECONDS - (elapsed % QR_WINDOW_SECONDS);
      setWindowIndex(winIdx);
      setWsLeft(winSecs > 0 ? winSecs : QR_WINDOW_SECONDS);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.startTime, session?.expiryTime]);

  // ── Re-sign whenever windowIndex changes ─────────────────────────────────
  const signWindow = useCallback(async (winIdx) => {
    if (!session || !session.sessionId) return;
    if (inProgressRef.current && lastSignedWindowRef.current === winIdx) return;
    try {
      inProgressRef.current = true;
      const wallet = session.ephemeralWallet || fallbackWalletRef.current || (fallbackWalletRef.current = ethers.Wallet.createRandom());
      const msgHash = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256'],
        [session.sessionId, winIdx]
      );
      const sig = await wallet.signMessage(ethers.getBytes(msgHash));
      setQrPayload(JSON.stringify({
        sessionId:   session.sessionId,
        windowIndex: winIdx,
        signature:   sig,
        // Demo OTP included in payload for fallback scanning
        demoOtpFallback: session.otpCode || '',
      }));
      lastSignedWindowRef.current = winIdx;
      setSignError(null);
    } catch (err) {
      console.error('QR sign failed:', err);
      setSignError(err.message || 'Failed to sign QR window');
    } finally {
      inProgressRef.current = false;
    }
  }, [session?.sessionId, session?.ephemeralWallet, session?.otpCode]);

  useEffect(() => {
    signWindow(windowIndex);
  }, [windowIndex, signWindow]);

  if (!session) return null;

  // ── Ring progress for session countdown ──────────────────────────────────
  const totalDuration = Number(session.expiryTime) - Number(session.startTime);
  const progressPercent = totalDuration > 0
    ? Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100))
    : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // ── Window ring (20 s inner ring) ─────────────────────────────────────────
  const winProgress = (windowSecsLeft / QR_WINDOW_SECONDS) * 100;
  const innerRadius = 40;
  const innerCirc   = 2 * Math.PI * innerRadius;
  const innerOffset = innerCirc - (winProgress / 100) * innerCirc;

  const handleCopyOtp = () => {
    if (session.otpCode) {
      navigator.clipboard.writeText(session.otpCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="glass-panel p-6 lg:p-8 rounded-3xl border-2 border-cyan-500/40 shadow-2xl shadow-cyan-500/10 flex flex-col items-center text-center relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      {/* Header Badge */}
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-4">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span>Live — Rotating Ephemeral-Key QR  (20 s window)</span>
      </div>

      <h3 className="text-2xl font-heading font-bold text-white tracking-tight">
        {subject?.name || 'Class Session'} ({subject?.code || 'CS-401'})
      </h3>
      <p className="text-xs text-slate-400 mt-1 font-medium">Session ID: #{session.sessionId}</p>

      {/* Dual-ring QR display */}
      <div className="my-6 relative flex items-center justify-center">
        {/* Outer ring — session expiry */}
        <div className="relative w-64 h-64 flex items-center justify-center">
          <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 256 256">
            <circle cx="128" cy="128" r={radius * 2} stroke="#1e293b" strokeWidth="6" fill="transparent" />
            <circle
              cx="128" cy="128" r={radius * 2}
              stroke="#22d3ee" strokeWidth="6" fill="transparent"
              strokeDasharray={circumference * 2}
              strokeDashoffset={strokeDashoffset * 2}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
            {/* Inner ring — 20 s window */}
            <circle cx="128" cy="128" r={innerRadius * 2} stroke="#1e293b" strokeWidth="5" fill="transparent" />
            <circle
              cx="128" cy="128" r={innerRadius * 2}
              stroke="#a855f7" strokeWidth="5" fill="transparent"
              strokeDasharray={innerCirc * 2}
              strokeDashoffset={innerOffset * 2}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s linear' }}
            />
          </svg>

          {/* QR Code centred */}
          <div className="absolute p-3 rounded-2xl bg-white shadow-2xl flex items-center justify-center border-4 border-cyan-400">
            {qrPayload ? (
              <QRCodeSVG value={qrPayload} size={140} level="H" includeMargin={false} />
            ) : signError ? (
              <div className="w-[140px] h-[140px] flex flex-col items-center justify-center p-2 text-center">
                <AlertTriangle className="w-7 h-7 text-rose-500 mb-1" />
                <span className="text-[11px] text-rose-600 font-bold mb-1.5 leading-tight">Signing Failed</span>
                <button
                  type="button"
                  onClick={() => signWindow(windowIndex)}
                  className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold shadow transition-all"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="w-[140px] h-[140px] flex items-center justify-center">
                <RotateCw className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Window countdown badge */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs font-semibold text-purple-300">
          <RotateCw className={`w-3.5 h-3.5 text-purple-400 ${windowSecsLeft <= 5 ? 'animate-spin' : ''}`} />
          <span>QR rotates in <span className="font-mono font-bold text-white">{windowSecsLeft}s</span></span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300">
          <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
          <span>Window #{windowIndex}</span>
        </div>
      </div>

      {/* Session Timer (block-anchored) */}
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-4">
        <Clock className="w-4 h-4 text-cyan-400" />
        <span>On-Chain Time Remaining:</span>
        <span className={`font-mono font-bold ${timeLeft < 60 ? 'text-rose-400 animate-pulse' : 'text-cyan-300'}`}>
          {formatTimeLeft(timeLeft)}
        </span>
      </div>

      {/* Copy QR Data Button for Single-Laptop Testing */}
      {qrPayload && (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(qrPayload);
            if (addToast) addToast('📋 Copied QR Payload to clipboard!', 'success');
          }}
          className="w-full max-w-sm mb-4 px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold border border-purple-500/40 transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Copy className="w-4 h-4 text-purple-400" />
          <span>Copy QR Data (Single-Laptop Test)</span>
        </button>
      )}

      {/* Demo Fallback OTP */}
      {session.otpCode && (
        <div className="w-full max-w-sm glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-3 mb-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Demo Fallback 6-Digit OTP
            </span>
            <span className="font-mono text-3xl font-bold tracking-widest text-cyan-300 neon-gradient-text">
              {session.otpCode}
            </span>
          </div>
          <button
            onClick={handleCopyOtp}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold border border-cyan-500/40 transition-all flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      {/* Stats & End Session */}
      <div className="w-full flex items-center justify-between pt-4 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <Users className="w-4 h-4 text-purple-400" />
          <span>Present: <strong className="text-white">{session.totalPresent || 0} Students</strong></span>
        </div>
        <button
          onClick={onEndSession}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all flex items-center gap-1.5"
        >
          <StopCircle className="w-4 h-4 text-rose-400" />
          <span>End Session</span>
        </button>
      </div>
    </div>
  );
};
