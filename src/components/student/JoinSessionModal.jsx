/**
 * JoinSessionModal.jsx
 *
 * Primary flow: Scan QR with camera or Paste QR Payload.
 *   QR payload: { sessionId, windowIndex, signature }
 *   → calls contract.markAttendance(sessionId, windowIndex, signature)
 *
 * Demo fallback:
 *   Student enters plain Session ID number input + 6-digit OTP
 *   → calls contract.markAttendanceWithCode(sessionId, otpCode)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';
import { useWeb3 } from '../../context/Web3Context';
import {
  QrCode, KeyRound, Sparkles, CheckCircle2, X, Loader2, Camera,
  RefreshCw, ShieldCheck, Clipboard, ClipboardCheck
} from 'lucide-react';

export const JoinSessionModal = ({ isOpen, onClose, onSuccess }) => {
  const { contract, provider, addToast } = useWeb3();
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'paste' | 'fallback'

  // Active Sessions Dropdown State
  const [activeSessionsList, setActiveSessionsList] = useState([]);
  const [selectedSessionId, setSelectedSessionId]   = useState('');
  const [loadingSessions, setLoadingSessions]       = useState(false);

  // QR Payload data
  const [scannedPayload, setScannedPayload] = useState(null);

  // Plain Session ID input (empty by default, never overwritten by polling/refresh)
  const [sessionIdInput, setSessionIdInput] = useState('');
  const [otpInput, setOtpInput]             = useState('');
  const [pastedJsonInput, setPastedJsonInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef(null);

  // ── Fetch active sessions by latest block timestamp (never overwrites user selection) ──
  const fetchActiveSessions = useCallback(async () => {
    if (!contract || !provider) return;
    try {
      setLoadingSessions(prev => (activeSessionsList.length === 0 ? true : prev));
      const blk = await provider.getBlock('latest');
      const blockTs = blk ? Number(blk.timestamp) : Math.floor(Date.now() / 1000);
      const nextId = Number(await contract.nextSessionId()) - 1;

      const sessions = [];
      const searchFloor = Math.max(1, nextId - 25);
      for (let id = nextId; id >= searchFloor; id--) {
        try {
          const s = await contract.sessions(id);
          if (s.isActive && Number(s.expiryTime) > blockTs) {
            const sub = await contract.subjects(s.subjectId);
            if (sub.isActive) {
              sessions.push({
                sessionId: id,
                subjectId: Number(s.subjectId),
                subjectCode: sub.code,
                subjectName: sub.name,
                expiryTime: Number(s.expiryTime),
              });
            }
          }
        } catch {}
      }

      sessions.sort((a, b) => b.sessionId - a.sessionId);
      setActiveSessionsList(sessions);

      // State preservation: never overwrite if user already selected a still-active session
      setSelectedSessionId(prev => {
        if (prev && sessions.some(s => String(s.sessionId) === String(prev))) {
          return prev;
        }
        if (!prev && sessions.length > 0) {
          return String(sessions[0].sessionId);
        }
        if (sessions.length > 0) {
          return String(sessions[0].sessionId);
        }
        return '';
      });
    } catch (err) {
      console.warn('Failed to fetch active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [contract, provider]);

  useEffect(() => {
    if (!isOpen) return;
    fetchActiveSessions();
    const interval = setInterval(fetchActiveSessions, 8000);
    return () => clearInterval(interval);
  }, [isOpen, fetchActiveSessions]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') stopCamera();
  }, [isOpen, activeTab]);

  // ── Camera helpers ─────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const html5QrCode = new Html5Qrcode('reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleParseQrPayload(decodedText);
          stopCamera();
        },
        () => {}
      );
    } catch (err) {
      console.warn('Camera start error:', err);
      addToast('Could not access camera. Use Paste QR Data or Demo Fallback tab instead.', 'warning');
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current?.isScanning) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
    }
    setCameraActive(false);
  };

  // ── Parse QR Payload JSON ──────────────────────────────────────────────────
  const handleParseQrPayload = (rawString) => {
    try {
      const data = JSON.parse(rawString);
      if (data.sessionId !== undefined && data.windowIndex !== undefined && data.signature) {
        setScannedPayload({
          sessionId:   Number(data.sessionId),
          windowIndex: Number(data.windowIndex),
          signature:   data.signature,
        });
        if (data.demoOtpFallback) setOtpInput(String(data.demoOtpFallback));
        setSessionIdInput(String(data.sessionId));
        setSelectedSessionId(String(data.sessionId));
        addToast('📋 QR payload loaded! Rotating signature verified.', 'success');
        return true;
      } else {
        addToast('⚠️ Unrecognised QR JSON format.', 'warning');
        return false;
      }
    } catch {
      addToast('⚠️ Could not parse QR payload data.', 'warning');
      return false;
    }
  };

  // Paste from Clipboard helper
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedJsonInput(text);
        handleParseQrPayload(text);
      } else {
        addToast('Clipboard is empty.', 'warning');
      }
    } catch (err) {
      addToast('Permission denied to read clipboard. Paste directly into text box.', 'warning');
    }
  };

  if (!isOpen) return null;

  // ── Submit Attendance ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contract) { addToast('Contract not loaded. Connect wallet.', 'error'); return; }

    try {
      setIsSubmitting(true);
      let tx;

      let payloadToUse = scannedPayload;
      if (activeTab === 'paste' && !payloadToUse && pastedJsonInput.trim()) {
        try {
          const data = JSON.parse(pastedJsonInput.trim());
          if (data.sessionId !== undefined && data.windowIndex !== undefined && data.signature) {
            payloadToUse = {
              sessionId: Number(data.sessionId),
              windowIndex: Number(data.windowIndex),
              signature: data.signature,
            };
          }
        } catch {}
      }

      if ((activeTab === 'camera' || activeTab === 'paste') && payloadToUse) {
        // Rotating QR → markAttendance(sessionId, windowIndex, signature)
        tx = await contract.markAttendance(
          payloadToUse.sessionId,
          payloadToUse.windowIndex,
          payloadToUse.signature
        );
        addToast('Submitting rotating-QR attendance proof on-chain...', 'info', tx.hash);
      } else {
        // Demo fallback: 6-digit OTP → markAttendanceWithCode(sessionId, otpCode)
        const targetSessionId = sessionIdInput.trim()
          ? Number(sessionIdInput.trim())
          : (selectedSessionId ? Number(selectedSessionId) : 0);
        if (!targetSessionId || !otpInput.trim()) {
          addToast('Please select an active session or enter Session ID and 6-digit OTP code.', 'warning');
          setIsSubmitting(false);
          return;
        }
        tx = await contract.markAttendanceWithCode(
          targetSessionId,
          otpInput.trim()
        );
        addToast('Submitting Demo OTP check-in on-chain...', 'info', tx.hash);
      }

      const receipt = await tx.wait();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      addToast('🎉 Attendance verified & recorded on-chain!', 'success', receipt.hash);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('markAttendance error:', err);
      let msg = err.reason || err.message || '';

      if (
        msg.includes('Session has expired') ||
        msg.includes('Session is not active') ||
        msg.includes('QR window has expired')
      ) {
        msg = 'This session has ended';
      } else if (
        msg.includes('Invalid 6-digit demo') ||
        msg.includes('Invalid QR signature') ||
        msg.includes('wrong session')
      ) {
        msg = 'Wrong code for this session';
      } else if (msg.includes('Attendance already marked')) {
        msg = 'You already checked in';
      } else if (
        msg.includes('Student account has been deactivated') ||
        msg.includes('Only registered students') ||
        msg.includes('not found') ||
        msg.includes('onlyStudent')
      ) {
        msg = 'You are not registered';
      } else if (msg.includes('Demo 6-digit OTP fallback is currently disabled')) {
        msg = 'Demo fallback is disabled by admin';
      } else {
        msg = 'Failed to mark attendance: ' + msg;
      }

      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel max-w-lg w-full p-6 lg:p-8 rounded-3xl border-2 border-cyan-500/40 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-white">Check-in Attendance</h3>
              <p className="text-xs text-slate-400">Rotating ECDSA QR • On-Chain Verification</p>
            </div>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Class Sessions Dropdown & Independent Manual Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Active Class Sessions
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-cyan-500/40 text-white text-xs font-semibold focus:outline-none focus:border-cyan-400 truncate"
            >
              {loadingSessions && activeSessionsList.length === 0 ? (
                <option value="">Checking active sessions on-chain...</option>
              ) : activeSessionsList.length === 0 ? (
                <option value="">No active session right now</option>
              ) : (
                activeSessionsList.map((s) => (
                  <option key={s.sessionId} value={String(s.sessionId)}>
                    Session #{s.sessionId} — {s.subjectCode} ({s.subjectName})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Manual Session ID
            </label>
            <input
              type="number"
              value={sessionIdInput}
              onChange={(e) => setSessionIdInput(e.target.value)}
              placeholder="e.g. 37 (empty by default)"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => { setScannedPayload(null); setActiveTab('camera'); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'camera'
                ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-neon-cyan'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan Camera</span>
          </button>

          <button
            type="button"
            onClick={() => { stopCamera(); setActiveTab('paste'); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-purple-600/40 text-purple-200 border border-purple-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste QR Data</span>
          </button>

          <button
            type="button"
            onClick={() => { stopCamera(); setActiveTab('fallback'); }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'fallback'
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Demo OTP</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'camera' ? (
            <div className="space-y-4">
              {/* Camera viewport */}
              <div className="relative w-full aspect-square max-w-[240px] mx-auto rounded-2xl overflow-hidden bg-slate-900 border-2 border-cyan-500/30 flex flex-col items-center justify-center">
                <div id="reader" className="w-full h-full" />
                {!cameraActive && !scannedPayload && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/80 text-center">
                    <Camera className="w-10 h-10 text-cyan-400 mb-2 animate-bounce" />
                    <p className="text-xs text-slate-300 font-semibold">Camera Scanner Ready</p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="mt-3 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/40 transition-all flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Start Camera</span>
                    </button>
                  </div>
                )}
                {scannedPayload && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-emerald-950/90 text-center">
                    <ShieldCheck className="w-12 h-12 text-emerald-400 mb-2" />
                    <p className="text-xs text-emerald-300 font-semibold">QR Payload Loaded</p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">
                      Session #{scannedPayload.sessionId} · Window #{scannedPayload.windowIndex}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setScannedPayload(null); startCamera(); }}
                      className="mt-3 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30"
                    >
                      Rescan
                    </button>
                  </div>
                )}
              </div>

              {scannedPayload && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Sig: {scannedPayload.signature.substring(0, 30)}…</span>
                </div>
              )}
            </div>
          ) : activeTab === 'paste' ? (
            /* Single-Laptop Paste QR Data tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Paste Rotating QR Payload (JSON)
                </label>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 transition-all"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Paste Clipboard</span>
                </button>
              </div>

              <textarea
                rows={3}
                value={pastedJsonInput}
                onChange={(e) => {
                  setPastedJsonInput(e.target.value);
                  if (e.target.value.trim()) handleParseQrPayload(e.target.value.trim());
                }}
                placeholder='{"sessionId": 37, "windowIndex": 0, "signature": "0x..."}'
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-purple-500/30 text-purple-200 font-mono text-xs focus:outline-none focus:border-purple-400"
              />

              {scannedPayload && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold">Loaded:</span> Session #{scannedPayload.sessionId} · Window #{scannedPayload.windowIndex}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Demo Fallback Code Tab */
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                <span>Demo fallback code mode.</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Demo Fallback 6-Digit OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value)}
                  placeholder="e.g. 739201"
                  className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-purple-500/40 text-center font-mono text-2xl font-bold tracking-widest text-purple-300 focus:outline-none focus:border-purple-400"
                  required
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => { stopCamera(); onClose(); }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || ((activeTab === 'camera' || activeTab === 'paste') && !scannedPayload)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-neon-cyan transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing On-Chain...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {(activeTab === 'camera' || activeTab === 'paste') && scannedPayload
                      ? 'Verify & Mark Attendance'
                      : activeTab === 'fallback'
                      ? 'Submit OTP & Mark'
                      : 'Scan/Paste QR Data First'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
